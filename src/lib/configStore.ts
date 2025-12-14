import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createBackup } from "./autoBackup";
import {
  deleteEmployeeRecordFromSupabase,
  deleteStoreRecordFromSupabase,
  listEmployeesFromSupabase,
  listStoresFromSupabase,
  upsertEmployeeRecordToSupabase,
  upsertStoreRecordToSupabase,
} from "./supabaseDirectory";
import { getSupabaseServiceClient } from "./supabaseClient";
import type { Database } from "@/types/supabase";
// Supabase-based storage (replaces filesystem for production)
import * as supabaseLogs from "./supabaseLogs";
import * as supabaseCategories from "./supabaseCategories";
import * as supabaseBranding from "./supabaseBranding";
import { listProductCatalog as _listProductCatalog } from "./supabaseProducts";
import { getLeaves as _getLeaves } from "./supabaseLeaves";


const DATA_PATH = path.join(process.cwd(), "data/app-data.json");
const LOG_LIMIT = 300;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_LOOKBACK_DAYS = 7;
const PERFORMANCE_TIMELINE_DAYS = 14;

const DASHBOARD_TIME_ZONE =
  process.env.GOOGLE_SHEETS_TIMEZONE?.trim() ||
  process.env.APP_TIMEZONE?.trim() ||
  "Asia/Bangkok";

export type BrandingSettings = {
  logoPath: string | null;
  updatedAt: string;
};

const DEFAULT_BRANDING: BrandingSettings = {
  logoPath: null,
  updatedAt: new Date(0).toISOString(),
};

export type DashboardRangeMode = "day" | "week" | "month" | "year";

export type DashboardFilterOptions = {
  range?: {
    mode?: DashboardRangeMode;
    value?: string | null;
  };
  store?: string | null;
  employee?: string | null;
  attendanceStatus?: "all" | "check-in" | "check-out";
  salesStatus?: string | null;
  timeFrom?: string | null;
  timeTo?: string | null;
};

export type DashboardAppliedFilters = {
  rangeMode: DashboardRangeMode;
  rangeValue: string;
  store: string | null;
  employee: string | null;
  attendanceStatus: "all" | "check-in" | "check-out";
  salesStatus: string;
  timeFrom: string | null;
  timeTo: string | null;
};

export type DashboardMetrics = {
  filters: DashboardAppliedFilters & {
    rangeLabel: string;
    rangeStartIso: string;
    rangeEndIso: string;
  };
  attendance: {
    total: number;
    checkIns: number;
    checkOuts: number;
    uniqueEmployees: number;
    timeline: Array<{
      dateKey: string;
      label: string;
      checkIns: number;
      checkOuts: number;
    }>;
  };
  sales: {
    totalRevenue: number;
    totalQuantity: number;
    transactions: number;
    averageTicket: number;
    timeline: Array<{
      dateKey: string;
      label: string;
      total: number;
      quantity: number;
      transactions: number;
    }>;
    byStore: Array<{
      label: string;
      total: number;
      transactions: number;
      quantity: number;
    }>;
    byEmployee: Array<{
      label: string;
      total: number;
      transactions: number;
      quantity: number;
    }>;
    statuses: Array<{
      status: string;
      transactions: number;
      total: number;
      quantity: number;
    }>;
    availableStatuses: string[];
  };
};

const DEFAULT_RANGE_MODE: DashboardRangeMode = "month";

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function padNumber(value: number) {
  return value.toString().padStart(2, "0");
}

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number.parseInt(lookup.get("year") ?? "0", 10),
    month: Number.parseInt(lookup.get("month") ?? "0", 10),
    day: Number.parseInt(lookup.get("day") ?? "0", 10),
    hour: Number.parseInt(lookup.get("hour") ?? "0", 10),
    minute: Number.parseInt(lookup.get("minute") ?? "0", 10),
    second: Number.parseInt(lookup.get("second") ?? "0", 10),
  };
}

function getDayKey(parts: ZonedDateParts) {
  return `${parts.year}-${padNumber(parts.month)}-${padNumber(parts.day)}`;
}

function formatDayLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone,
    day: "numeric",
    month: "short",
  }).format(date);
}

function percentChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return 0;
  }
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type EmployeeRecord = {
  id: string;
  name: string;
  employeeCode?: string | null;
  phone?: string | null;
  regularDayOff?: string | null;
  province?: string | null;
  region?: string | null;
  defaultStoreId?: string | null;
  storeIds?: string[]; // New: multi-store support
  createdAt: string;
  updatedAt: string;
};

export type StoreRecord = {
  id: string;
  name: string;
  province?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type LeaveRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: "scheduled" | "approved" | "rejected" | "cancelled";
  createdAt: string;
  updatedAt: string;
  note?: string | null;
};

export type CategoryRecord = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductRecord = {
  id: string;
  code: string;
  name: string;
  unitPrice: number;
  categoryId?: string | null;
  sku?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductAssignmentRecord = {
  id: string;
  employeeId: string;
  storeId: string | null;
  productId: string;
  createdAt: string;
  updatedAt: string;
};

export type LogScope = "employee" | "store" | "product" | "attendance" | "sales" | "leave" | "system";

export type LogEntry = {
  id: string;
  scope: LogScope;
  action: string;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
  // Enhanced tracking fields
  userId?: string;
  userName?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  browser?: string;
  location?: string;
};

type AppData = {
  employees: EmployeeRecord[];
  stores: StoreRecord[];
  categories: CategoryRecord[];
  products: ProductRecord[];
  productAssignments: ProductAssignmentRecord[];
  leaves: LeaveRecord[];
  logs: LogEntry[];
  branding: BrandingSettings;
};

const DEFAULT_DATA: AppData = {
  employees: [],
  stores: [],
  categories: [],
  products: [],
  productAssignments: [],
  leaves: [],
  logs: [],
  branding: { ...DEFAULT_BRANDING },
};

const FILESYSTEM_FALLBACK_ENABLED =
  process.env.ENABLE_LOCAL_DATA_FALLBACK === "true" ||
  process.env.NODE_ENV !== "production";

async function ensureDataFile() {
  try {
    await fs.access(DATA_PATH);
  } catch {
    try {
      await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
      await fs.writeFile(DATA_PATH, JSON.stringify(DEFAULT_DATA, null, 2), "utf8");
    } catch (error) {
      console.warn("[configStore] Unable to initialize data file; falling back to Supabase only", error);
      throw error;
    }
  }
}

function normalizeBranding(value: unknown): BrandingSettings {
  if (!value || typeof value !== "object" || value === null) {
    return { ...DEFAULT_BRANDING };
  }
  const record = value as Record<string, unknown>;
  const logoPathRaw =
    typeof record.logoPath === "string" && record.logoPath.trim().length > 0
      ? record.logoPath.trim()
      : null;
  const updatedAtRaw =
    typeof record.updatedAt === "string" && record.updatedAt.trim().length > 0
      ? record.updatedAt.trim()
      : DEFAULT_BRANDING.updatedAt;
  const updatedAtDate = new Date(updatedAtRaw);
  const updatedAt = Number.isNaN(updatedAtDate.valueOf())
    ? DEFAULT_BRANDING.updatedAt
    : updatedAtRaw;
  return {
    logoPath: logoPathRaw,
    updatedAt,
  };
}

function _normalizeProductAssignments(
  value: unknown,
  source: Partial<AppData>,
): ProductAssignmentRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const employees = Array.isArray(source.employees) ? source.employees : [];
  const stores = Array.isArray(source.stores) ? source.stores : [];
  const products = Array.isArray(source.products) ? source.products : [];
  const employeeSet = new Set(employees.map((employee) => employee.id));
  const storeSet = new Set(stores.map((store) => store.id));
  const productSet = new Map(products.map((product) => [product.id, product]));

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const employeeId = typeof record.employeeId === "string" ? record.employeeId : null;
      const productId = typeof record.productId === "string" ? record.productId : null;
      if (!employeeId || !productId) {
        return null;
      }
      if (!employeeSet.has(employeeId) || !productSet.has(productId)) {
        return null;
      }
      const rawStoreId = record.storeId;
      const storeId =
        typeof rawStoreId === "string" && rawStoreId.length > 0
          ? storeSet.has(rawStoreId)
            ? rawStoreId
            : null
          : null;
      const createdAtRaw = typeof record.createdAt === "string" ? record.createdAt : null;
      const updatedAtRaw = typeof record.updatedAt === "string" ? record.updatedAt : null;
      const createdAt = new Date(createdAtRaw ?? 0).toISOString();
      const updatedAt = new Date(updatedAtRaw ?? createdAt).toISOString();
      const id = typeof record.id === "string" ? record.id : randomUUID();
      return {
        id,
        employeeId,
        storeId,
        productId,
        createdAt,
        updatedAt,
      } satisfies ProductAssignmentRecord;
    })
    .filter((assignment): assignment is ProductAssignmentRecord => assignment !== null);
}

async function readData(): Promise<AppData> {
  const [supabaseEmployees, supabaseStores] = await Promise.all([
    listEmployeesFromSupabase(),
    listStoresFromSupabase(),
  ]);

  const supabaseEmployeesList =
    supabaseEmployees?.map((employee) => ({ ...employee })) ?? [];
  const supabaseStoresList =
    supabaseStores?.map((store) => ({ ...store })) ?? [];

  const supabaseOnlyResult: AppData = {
    employees: supabaseEmployeesList
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "th")),
    stores: supabaseStoresList
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "th")),
    categories: [],
    products: [],
    productAssignments: [],
    leaves: [],
    logs: [],
    branding: { ...DEFAULT_BRANDING },
  };

  if (!FILESYSTEM_FALLBACK_ENABLED) {
    return supabaseOnlyResult;
  }

  try {
    await ensureDataFile();
  } catch {
    return supabaseOnlyResult;
  }

  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppData>;

    const employeesFromFile = Array.isArray(parsed.employees) ? parsed.employees : [];
    const storesFromFile = Array.isArray(parsed.stores) ? parsed.stores : [];

    const employees = (
      supabaseEmployeesList.length > 0 ? supabaseEmployeesList : employeesFromFile
    ).map((employee) => ({ ...employee }));

    const stores = (
      supabaseStoresList.length > 0 ? supabaseStoresList : storesFromFile
    ).map((store) => ({ ...store }));

    return {
      employees: employees.sort((a, b) => a.name.localeCompare(b.name, "th")),
      stores: stores.sort((a, b) => a.name.localeCompare(b.name, "th")),
      // DEPRECATED: Categories now read from Supabase via supabaseCategories module
      categories: [],
      // DEPRECATED: Products now read from Supabase via supabaseProducts module
      products: [],
      // DEPRECATED: Product assignments now read from Supabase via supabaseProducts module
      productAssignments: [],
      // DEPRECATED: Leaves now read from Supabase via supabaseLeaves module
      leaves: [],
      // Logs now written to Supabase via supabaseLogs module
      // Kept here for backward compatibility with dashboard fallback
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      branding: normalizeBranding(parsed.branding),
    };
  } catch (error) {
    console.error("[configStore] read error, resetting data file", error);

    try {
      await fs.writeFile(DATA_PATH, JSON.stringify(DEFAULT_DATA, null, 2), "utf8");
    } catch (writeError) {
      console.warn("[configStore] Failed to reset data file; continuing with Supabase data", writeError);
    }

    return supabaseOnlyResult;
  }
}



// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function writeData(next: AppData) {
  // Create backup before writing (fire-and-forget, don't block on errors)
  createBackup().catch((err) => console.error("Backup failed:", err));

  await fs.writeFile(DATA_PATH, JSON.stringify(next, null, 2), "utf8");
}

export async function getBranding() {
  // Use Supabase instead of filesystem
  return await supabaseBranding.getBranding();
}

export async function updateBrandingLogo(logoPath: string | null) {
  // Use Supabase instead of filesystem
  const updated = await supabaseBranding.updateBranding({ logoPath });

  // Log the change
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "system",
    action: logoPath ? "update" : "delete",
    details: logoPath ? "อัปเดตโลโก้ระบบ" : "รีเซ็ตโลโก้ระบบ",
    metadata: { logoPath: logoPath ?? null },
  });

  return updated;
}

export async function getEmployees() {
  const data = await readData();
  return data.employees
    .map((employee) => ({
      ...employee,
      employeeCode: employee.employeeCode ?? null,
      phone: employee.phone ?? null,
      regularDayOff: employee.regularDayOff ?? null,
      province: employee.province ?? null,
      region: employee.region ?? null,
      defaultStoreId: employee.defaultStoreId ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
}

export async function getStores() {
  const data = await readData();
  return data.stores
    .map((store) => ({
      ...store,
      province: store.province ?? null,
      address: store.address ?? null,
      latitude: store.latitude ?? null,
      longitude: store.longitude ?? null,
      radius: store.radius ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
}

type StoreInput = {
  name: string;
  province?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius?: number | null;
};

type EmployeeInput = {
  name: string;
  employeeCode?: string | null;
  phone?: string | null;
  regularDayOff?: string | null;
  province?: string | null;
  region?: string | null;
  defaultStoreId?: string | null;
};

function normalizeNullable(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function createEmployee(input: EmployeeInput) {
  const trimmedName = (input.name ?? "").trim();
  if (!trimmedName) {
    throw new Error("กรุณาระบุชื่อพนักงาน");
  }
  const now = new Date().toISOString();
  const data = await readData();
  const defaultStoreIdRaw =
    typeof input.defaultStoreId === "string" ? input.defaultStoreId.trim() : "";
  let defaultStoreId: string | null = null;
  if (defaultStoreIdRaw) {
    const storeExists = data.stores.some((store) => store.id === defaultStoreIdRaw);
    if (!storeExists) {
      throw new Error("ไม่พบร้าน/หน่วยงานที่ต้องการผูกกับพนักงาน");
    }
    defaultStoreId = defaultStoreIdRaw;
  }
  const exists = data.employees.some(
    (employee) => employee.name.toLocaleLowerCase("th") === trimmedName.toLocaleLowerCase("th"),
  );
  if (exists) {
    throw new Error("มีชื่อพนักงานนี้อยู่แล้ว");
  }

  // Validate employee code uniqueness if provided
  const employeeCode = normalizeNullable(input.employeeCode);
  if (employeeCode) {
    const codeExists = data.employees.some(
      (employee) => employee.employeeCode?.toLowerCase() === employeeCode.toLowerCase(),
    );
    if (codeExists) {
      throw new Error("รหัสพนักงานนี้มีการใช้งานแล้ว กรุณาใช้รหัสอื่น");
    }
  }

  const employee: EmployeeRecord = {
    id: randomUUID(),
    name: trimmedName,
    employeeCode,
    phone: normalizeNullable(input.phone),
    regularDayOff: normalizeNullable(input.regularDayOff),
    province: normalizeNullable(input.province),
    region: normalizeNullable(input.region),
    defaultStoreId,
    createdAt: now,
    updatedAt: now,
  };
  data.employees.push(employee);
  // await writeData(data); // Disabled: Netlify read-only filesystem
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "employee",
    action: "create",
    details: `เพิ่มพนักงานใหม่: ${employee.name}`,
    metadata: { employeeId: employee.id },
  });
  await upsertEmployeeRecordToSupabase(employee);
  return employee;
}

export async function createStore(input: StoreInput) {
  const trimmed = (input.name ?? "").trim();
  if (!trimmed) {
    throw new Error("กรุณาระบุชื่อร้าน/หน่วยงาน");
  }
  const now = new Date().toISOString();
  const data = await readData();
  const exists = data.stores.some(
    (store) => store.name.toLocaleLowerCase("th") === trimmed.toLocaleLowerCase("th"),
  );
  if (exists) {
    throw new Error("มีชื่อร้าน/หน่วยงานนี้อยู่แล้ว");
  }
  const store: StoreRecord = {
    id: randomUUID(),
    name: trimmed,
    province: normalizeNullable(input.province),
    address: normalizeNullable(input.address),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    radius: input.radius ?? null,
    createdAt: now,
    updatedAt: now,
  };
  data.stores.push(store);
  // await writeData(data); // Disabled: Netlify read-only filesystem
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "store",
    action: "create",
    details: `เพิ่มร้าน/หน่วยงาน: ${store.name}`,
    metadata: { storeId: store.id, province: store.province ?? undefined },
  });
  await upsertStoreRecordToSupabase(store);
  return store;
}

export async function updateEmployee(id: string, input: EmployeeInput) {
  const trimmedName = (input.name ?? "").trim();
  if (!trimmedName) {
    throw new Error("กรุณาระบุชื่อพนักงาน");
  }
  const data = await readData();
  const index = data.employees.findIndex((employee) => employee.id === id);
  if (index === -1) {
    throw new Error("ไม่พบพนักงานที่ต้องการแก้ไข");
  }
  const duplicate = data.employees.some(
    (employee) =>
      employee.id !== id &&
      employee.name.toLocaleLowerCase("th") === trimmedName.toLocaleLowerCase("th"),
  );
  if (duplicate) {
    throw new Error("มีชื่อพนักงานนี้อยู่แล้ว");
  }

  // Validate employee code uniqueness if provided
  const employeeCode = normalizeNullable(input.employeeCode);
  if (employeeCode) {
    const codeExists = data.employees.some(
      (employee) =>
        employee.id !== id &&
        employee.employeeCode?.toLowerCase() === employeeCode.toLowerCase(),
    );
    if (codeExists) {
      throw new Error("รหัสพนักงานนี้มีการใช้งานแล้ว กรุณาใช้รหัสอื่น");
    }
  }

  let defaultStoreId = data.employees[index].defaultStoreId ?? null;
  if (input.defaultStoreId !== undefined) {
    const raw =
      typeof input.defaultStoreId === "string" ? input.defaultStoreId.trim() : "";
    if (!raw) {
      defaultStoreId = null;
    } else {
      const storeExists = data.stores.some((store) => store.id === raw);
      if (!storeExists) {
        throw new Error("ไม่พบร้าน/หน่วยงานที่ต้องการผูกกับพนักงาน");
      }
      defaultStoreId = raw;
    }
  }
  const updatedAt = new Date().toISOString();
  data.employees[index] = {
    ...data.employees[index],
    name: trimmedName,
    employeeCode,
    phone: normalizeNullable(input.phone),
    regularDayOff: normalizeNullable(input.regularDayOff),
    province: normalizeNullable(input.province),
    region: normalizeNullable(input.region),
    defaultStoreId,
    updatedAt,
  };
  // await writeData(data); // Disabled: Netlify read-only filesystem
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "employee",
    action: "update",
    details: `ปรับปรุงข้อมูลพนักงาน: ${trimmedName}`,
    metadata: { employeeId: id },
  });
  await upsertEmployeeRecordToSupabase(data.employees[index]);
  return data.employees[index];
}

export async function updateStore(id: string, input: StoreInput) {
  const trimmed = (input.name ?? "").trim();
  if (!trimmed) {
    throw new Error("กรุณาระบุชื่อร้าน/หน่วยงาน");
  }
  const data = await readData();
  const index = data.stores.findIndex((store) => store.id === id);
  if (index === -1) {
    throw new Error("ไม่พบร้าน/หน่วยงานที่ต้องการแก้ไข");
  }
  const duplicate = data.stores.some(
    (store) =>
      store.id !== id &&
      store.name.toLocaleLowerCase("th") === trimmed.toLocaleLowerCase("th"),
  );
  if (duplicate) {
    throw new Error("มีชื่อร้าน/หน่วยงานนี้อยู่แล้ว");
  }
  data.stores[index] = {
    ...data.stores[index],
    name: trimmed,
    province: normalizeNullable(input.province),
    address: normalizeNullable(input.address),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    radius: input.radius ?? null,
    updatedAt: new Date().toISOString(),
  };
  // await writeData(data); // Disabled: Netlify read-only filesystem
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "store",
    action: "update",
    details: `ปรับปรุงร้าน/หน่วยงาน: ${trimmed}`,
    metadata: {
      storeId: id,
      province: data.stores[index].province ?? undefined,
    },
  });
  await upsertStoreRecordToSupabase(data.stores[index]);
  return data.stores[index];
}

export async function deleteEmployee(id: string) {
  const data = await readData();
  const existing = data.employees.find((employee) => employee.id === id);
  if (!existing) {
    throw new Error("ไม่พบพนักงานที่ต้องการลบ");
  }
  data.employees = data.employees.filter((employee) => employee.id !== id);
  if (data.leaves.length > 0) {
    data.leaves = data.leaves.filter((leave) => leave.employeeId !== id);
  }
  if (data.productAssignments.length > 0) {
    data.productAssignments = data.productAssignments.filter(
      (assignment) => assignment.employeeId !== id,
    );
  }
  // await writeData(data); // Disabled: Netlify read-only filesystem
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "employee",
    action: "delete",
    details: `ลบพนักงาน: ${existing.name}`,
    metadata: { employeeId: id },
  });
  await deleteEmployeeRecordFromSupabase(id);
}

export async function deleteStore(id: string) {
  const data = await readData();
  const existing = data.stores.find((store) => store.id === id);
  if (!existing) {
    throw new Error("ไม่พบร้าน/หน่วยงานที่ต้องการลบ");
  }
  const affectedEmployees: string[] = [];
  const updatedEmployees = data.employees.map((employee) => {
    if (employee.defaultStoreId === id) {
      affectedEmployees.push(employee.id);
      return {
        ...employee,
        defaultStoreId: null,
        updatedAt: new Date().toISOString(),
      };
    }
    return employee;
  });
  if (affectedEmployees.length > 0) {
    data.employees = updatedEmployees;
  }
  if (data.productAssignments.length > 0) {
    data.productAssignments = data.productAssignments.filter(
      (assignment) => assignment.storeId !== id,
    );
  }
  data.stores = data.stores.filter((store) => store.id !== id);
  // await writeData(data); // Disabled: Netlify read-only filesystem
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "store",
    action: "delete",
    details: `ลบร้าน/หน่วยงาน: ${existing.name}`,
    metadata: {
      storeId: id,
      affectedEmployees: affectedEmployees.length > 0 ? affectedEmployees : undefined,
    },
  });
  await deleteStoreRecordFromSupabase(id);
  if (affectedEmployees.length > 0) {
    const affectedMap = new Map(data.employees.map((emp) => [emp.id, emp]));
    await Promise.all(
      affectedEmployees
        .map((employeeId) => affectedMap.get(employeeId))
        .filter((employee) => Boolean(employee))
        .map((employee) => upsertEmployeeRecordToSupabase(employee!)),
    );
  }
}

const LEAVE_STATUS_SET = new Set<LeaveRecord["status"]>([
  "scheduled",
  "approved",
  "rejected",
  "cancelled",
]);

type _LeaveInput = {
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  note?: string | null;
  status?: LeaveRecord["status"];
};

function _parseDate(value: string, field: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`กรุณาระบุ${field}`);
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`${field} ไม่ถูกต้อง`);
  }
  return trimmed;
}

function _validateLeaveWindow(startDate: string, endDate: string) {
  if (new Date(startDate) > new Date(endDate)) {
    throw new Error("วันเริ่มต้นต้องไม่มากกว่าวันสิ้นสุด");
  }
}

function _ensureLeaveStatus(status: string | undefined | null): LeaveRecord["status"] {
  if (!status) return "scheduled";
  return LEAVE_STATUS_SET.has(status as LeaveRecord["status"])
    ? (status as LeaveRecord["status"])
    : "scheduled";
}

// DEPRECATED: Use supabaseLeaves.getLeaves() instead
// export async function getLeaves() { ... }

// DEPRECATED: Use supabaseLeaves.createLeave() instead
// DEPRECATED: Use supabaseLeaves.updateLeave() instead
// DEPRECATED: Use supabaseLeaves.deleteLeave() instead

export async function getProducts() {
  const data = await readData();
  return data.products
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code, "th") || a.name.localeCompare(b.name, "th"));
}

export type ProductAssignmentDetail = ProductAssignmentRecord & {
  employeeName: string;
  storeName: string | null;
  productCode: string;
  productName: string;
};

export async function getProductAssignments() {
  const data = await readData();
  return data.productAssignments.slice();
}

export async function getProductAssignmentDetails(): Promise<ProductAssignmentDetail[]> {
  const data = await readData();
  const employees = new Map(data.employees.map((employee) => [employee.id, employee]));
  const stores = new Map(data.stores.map((store) => [store.id, store]));
  const products = new Map(data.products.map((product) => [product.id, product]));

  return data.productAssignments
    .map((assignment) => {
      const employee = employees.get(assignment.employeeId);
      const product = products.get(assignment.productId);
      if (!employee || !product) {
        return null;
      }
      const store = assignment.storeId ? stores.get(assignment.storeId) : null;
      return {
        ...assignment,
        employeeName: employee.name,
        storeName: store?.name ?? null,
        productCode: product.code,
        productName: product.name,
      } satisfies ProductAssignmentDetail;
    })
    .filter((detail): detail is ProductAssignmentDetail => detail !== null)
    .sort((a, b) => {
      const employeeSort = a.employeeName.localeCompare(b.employeeName, "th");
      if (employeeSort !== 0) return employeeSort;
      const storeSort = (a.storeName ?? "").localeCompare(b.storeName ?? "", "th");
      if (storeSort !== 0) return storeSort;
      return a.productCode.localeCompare(b.productCode, "th");
    });
}

export async function createProductAssignments({
  employeeId,
  storeId,
  productIds,
}: {
  employeeId: string;
  storeId?: string | null;
  productIds: string[];
}) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new Error("กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");
  }
  const data = await readData();
  const employee = data.employees.find((item) => item.id === employeeId);
  if (!employee) {
    throw new Error("ไม่พบพนักงานที่ต้องการผูกสินค้า");
  }
  let normalizedStoreId: string | null = null;
  if (typeof storeId === "string" && storeId.trim().length > 0) {
    const store = data.stores.find((item) => item.id === storeId);
    if (!store) {
      throw new Error("ไม่พบร้าน/หน่วยงานที่ต้องการผูกสินค้า");
    }
    normalizedStoreId = store.id;
  }
  const productMap = new Map(data.products.map((product) => [product.id, product]));
  const validProducts = productIds
    .map((id) => productMap.get(id))
    .filter((product): product is ProductRecord => Boolean(product));
  if (validProducts.length === 0) {
    throw new Error("กรุณาเลือกสินค้าให้ถูกต้อง");
  }

  const existingKeys = new Set(
    data.productAssignments.map(
      (assignment) => `${assignment.employeeId}::${assignment.storeId ?? ""}::${assignment.productId}`,
    ),
  );

  const now = new Date().toISOString();
  const created: ProductAssignmentRecord[] = [];
  for (const product of validProducts) {
    const key = `${employee.id}::${normalizedStoreId ?? ""}::${product.id}`;
    if (existingKeys.has(key)) {
      continue;
    }
    const record: ProductAssignmentRecord = {
      id: randomUUID(),
      employeeId: employee.id,
      storeId: normalizedStoreId,
      productId: product.id,
      createdAt: now,
      updatedAt: now,
    };
    created.push(record);
    data.productAssignments.push(record);
    existingKeys.add(key);
  }

  if (created.length === 0) {
    return [];
  }

  // await writeData(data); // Disabled: Netlify read-only filesystem
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "product",
    action: "assign",
    details: `ผูกสินค้า ${created.length} รายการกับ ${employee.name}${normalizedStoreId ? ` (สาขา ${data.stores.find((store) => store.id === normalizedStoreId)?.name ?? "ไม่ระบุ"})` : ""}`,
    metadata: {
      employeeId: employee.id,
      storeId: normalizedStoreId ?? undefined,
      productIds: created.map((record) => record.productId),
    },
  });
  return created;
}

export async function deleteProductAssignment(id: string) {
  const data = await readData();
  const index = data.productAssignments.findIndex((assignment) => assignment.id === id);
  if (index === -1) {
    throw new Error("ไม่พบการผูกสินค้าที่ต้องการลบ");
  }
  const [removed] = data.productAssignments.splice(index, 1);
  const employeeName = data.employees.find((employee) => employee.id === removed.employeeId)?.name;
  const product = data.products.find((item) => item.id === removed.productId);
  const storeName = removed.storeId
    ? data.stores.find((store) => store.id === removed.storeId)?.name
    : null;
  // await writeData(data); // Disabled: Netlify read-only filesystem
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "product",
    action: "unassign",
    details: `ยกเลิกการผูกสินค้า ${product?.code ?? removed.productId} กับ ${employeeName ?? removed.employeeId}`,
    metadata: {
      assignmentId: removed.id,
      employeeId: removed.employeeId,
      storeId: removed.storeId ?? undefined,
      productId: removed.productId,
      employeeName,
      storeName,
      productCode: product?.code,
    },
  });
}

export async function getProductsForEmployee(
  employeeId: string,
  storeId?: string | null,
) {
  const data = await readData();
  const employee = data.employees.find((item) => item.id === employeeId);
  if (!employee) {
    throw new Error("ไม่พบพนักงานที่เลือก");
  }

  const normalizedStoreId = storeId && storeId.trim().length > 0 ? storeId : null;
  const assignmentsForEmployee = data.productAssignments.filter(
    (assignment) => assignment.employeeId === employeeId,
  );

  if (assignmentsForEmployee.length === 0) {
    return data.products
      .slice()
      .sort(
        (a, b) =>
          a.code.localeCompare(b.code, "th") || a.name.localeCompare(b.name, "th"),
      );
  }

  const globalAssignments = assignmentsForEmployee.filter((assignment) => assignment.storeId === null);
  const storeSpecific = normalizedStoreId
    ? assignmentsForEmployee.filter((assignment) => assignment.storeId === normalizedStoreId)
    : [];

  let effectiveAssignments: ProductAssignmentRecord[] = [];
  if (normalizedStoreId) {
    effectiveAssignments = [...globalAssignments, ...storeSpecific];
  } else {
    effectiveAssignments = [...assignmentsForEmployee];
  }

  if (effectiveAssignments.length === 0) {
    effectiveAssignments = [...globalAssignments];
  }

  if (effectiveAssignments.length === 0) {
    return [] as ProductRecord[];
  }

  const allowedIds = new Set(effectiveAssignments.map((assignment) => assignment.productId));

  if (allowedIds.size === 0) {
    return [] as ProductRecord[];
  }

  return data.products
    .filter((product) => allowedIds.has(product.id))
    .sort((a, b) => a.code.localeCompare(b.code, "th") || a.name.localeCompare(b.name, "th"));
}

function normalizePrice(value: number) {
  if (Number.isNaN(value) || !Number.isFinite(value) || value < 0) {
    throw new Error("ราคาต่อหน่วยไม่ถูกต้อง");
  }
  return Number(value.toFixed(2));
}

export async function createProduct({
  code,
  name,
  unitPrice,
  categoryId,
  sku,
  description,
  imageUrl,
  isActive,
}: {
  code: string;
  name: string;
  unitPrice: number;
  categoryId?: string | null;
  sku?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
}) {
  const trimmedCode = code.trim();
  const trimmedName = name.trim();
  if (!trimmedCode || !trimmedName) {
    throw new Error("กรุณาระบุรหัสสินค้าและชื่อสินค้า");
  }
  const price = normalizePrice(unitPrice);
  const now = new Date().toISOString();
  const data = await readData();
  const codeExists = data.products.some(
    (product) => product.code.toLocaleLowerCase("th") === trimmedCode.toLocaleLowerCase("th"),
  );
  if (codeExists) {
    throw new Error("มีรหัสสินค้านี้อยู่แล้ว");
  }
  const nameExists = data.products.some(
    (product) => product.name.toLocaleLowerCase("th") === trimmedName.toLocaleLowerCase("th"),
  );
  if (nameExists) {
    throw new Error("มีชื่อสินค้านี้อยู่แล้ว");
  }

  // Validate categoryId if provided
  if (categoryId && !data.categories.some((cat) => cat.id === categoryId)) {
    throw new Error("ไม่พบหมวดหมู่ที่เลือก");
  }

  const product: ProductRecord = {
    id: randomUUID(),
    code: trimmedCode,
    name: trimmedName,
    unitPrice: price,
    categoryId: categoryId || null,
    sku: normalizeNullable(sku),
    description: normalizeNullable(description),
    imageUrl: normalizeNullable(imageUrl),
    isActive: isActive !== undefined ? isActive : true,
    createdAt: now,
    updatedAt: now,
  };
  data.products.push(product);
  // await writeData(data); // Disabled: Netlify read-only filesystem
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "product",
    action: "create",
    details: `เพิ่มสินค้าใหม่: ${product.code} - ${product.name}`,
    metadata: { productId: product.id },
  });
  return product;
}

export async function updateProduct(
  id: string,
  input: {
    code: string;
    name: string;
    unitPrice: number;
    categoryId?: string | null;
    sku?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    isActive?: boolean;
  },
) {
  const trimmedCode = input.code.trim();
  const trimmedName = input.name.trim();
  if (!trimmedCode || !trimmedName) {
    throw new Error("กรุณาระบุรหัสสินค้าและชื่อสินค้า");
  }
  const price = normalizePrice(input.unitPrice);
  const data = await readData();
  const index = data.products.findIndex((product) => product.id === id);
  if (index === -1) {
    throw new Error("ไม่พบสินค้าที่ต้องการแก้ไข");
  }
  const duplicateCode = data.products.some(
    (product) =>
      product.id !== id &&
      product.code.toLocaleLowerCase("th") === trimmedCode.toLocaleLowerCase("th"),
  );
  if (duplicateCode) {
    throw new Error("มีรหัสสินค้านี้อยู่แล้ว");
  }
  const duplicateName = data.products.some(
    (product) =>
      product.id !== id &&
      product.name.toLocaleLowerCase("th") === trimmedName.toLocaleLowerCase("th"),
  );
  if (duplicateName) {
    throw new Error("มีชื่อสินค้านี้อยู่แล้ว");
  }

  // Validate categoryId if provided
  if (input.categoryId && !data.categories.some((cat) => cat.id === input.categoryId)) {
    throw new Error("ไม่พบหมวดหมู่ที่เลือก");
  }

  data.products[index] = {
    ...data.products[index],
    code: trimmedCode,
    name: trimmedName,
    unitPrice: price,
    categoryId: input.categoryId !== undefined ? (input.categoryId || null) : data.products[index].categoryId,
    sku: input.sku !== undefined ? normalizeNullable(input.sku) : data.products[index].sku,
    description: input.description !== undefined ? normalizeNullable(input.description) : data.products[index].description,
    imageUrl: input.imageUrl !== undefined ? normalizeNullable(input.imageUrl) : data.products[index].imageUrl,
    isActive: input.isActive !== undefined ? input.isActive : data.products[index].isActive,
    updatedAt: new Date().toISOString(),
  };
  // await writeData(data); // Disabled: Netlify read-only filesystem
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "product",
    action: "update",
    details: `ปรับปรุงสินค้า: ${trimmedCode} - ${trimmedName}`,
    metadata: { productId: id },
  });
  return data.products[index];
}

export async function deleteProduct(id: string) {
  const data = await readData();
  const existing = data.products.find((product) => product.id === id);
  if (!existing) {
    throw new Error("ไม่พบสินค้าที่ต้องการลบ");
  }
  data.products = data.products.filter((product) => product.id !== id);
  if (data.productAssignments.length > 0) {
    data.productAssignments = data.productAssignments.filter(
      (assignment) => assignment.productId !== id,
    );
  }
  // await writeData(data); // Disabled: Netlify read-only filesystem
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "product",
    action: "delete",
    details: `ลบสินค้า: ${existing.code} - ${existing.name}`,
    metadata: { productId: id },
  });
}

type AppendLogArgs = {
  scope: LogScope;
  action: string;
  message: string;
  meta?: Record<string, unknown>;
};

export async function appendLog({ scope, action, message, meta }: AppendLogArgs) {
  const data = await readData();
  const log: LogEntry = {
    id: randomUUID(),
    scope,
    action,
    message,
    timestamp: new Date().toISOString(),
    meta,
  };
  data.logs = [log, ...data.logs].slice(0, LOG_LIMIT);
  // await writeData(data); // Disabled: Netlify read-only filesystem
  return log;
}

export async function getLogs(limit = 50) {
  const data = await readData();
  return data.logs.slice(0, limit);
}

export async function getAllLogs() {
  const data = await readData();
  return data.logs;
}

type DashboardAttendanceRecord = {
  timestamp: Date;
  dayKey: string;
  storeName: string;
  employeeName: string;
  status: "check-in" | "check-out";
  parts: ZonedDateParts;
};

type DashboardSalesRecord = {
  timestamp: Date;
  dayKey: string;
  storeName: string;
  employeeName: string;
  productName: string;
  productCode: string;
  total: number;
  quantity: number;
  status: string;
  parts: ZonedDateParts;
};

function normalizeDisplayValue(
  value: unknown,
  fallback: string,
) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeSalesStatus(value: unknown) {
  if (typeof value !== "string") {
    return "completed";
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : "completed";
}

type IsoDateRangeInput = {
  start: string;
  end?: string | null;
};

type NormalizedDateRange = {
  start: Date;
  end: Date; // exclusive
  startIso: string;
  endIso: string;
  label: string;
};

type ProductSalesReportOptions = {
  dateRanges?: IsoDateRangeInput[];
  employeeIds?: string[];
  storeIds?: string[];
};

// Unit-level breakdown for Box/Pack/Piece
export type UnitBreakdown = {
  quantity: number;
  revenuePC: number;
};

export type ProductSalesReport = {
  filters: {
    timeZone: string;
    ranges: Array<{
      startIso: string;
      endIso: string;
      label: string;
    }>;
    employees: Array<{
      id: string;
      name: string;
    }>;
    stores: Array<{
      id: string;
      name: string;
    }>;
    rangeSummary: string;
  };
  summary: {
    totalRevenue: number;
    totalRevenuePC: number; // PC pricing total
    totalQuantity: number;
    transactions: number;
    averageUnitPrice: number;
    uniqueProducts: number;
    uniqueEmployees: number;
    uniqueStores: number;
    allStores: string[];
    // Unit breakdown in summary
    unitBreakdown: {
      box: UnitBreakdown;
      pack: UnitBreakdown;
      piece: UnitBreakdown;
    };
  };
  products: Array<{
    productKey: string;
    productCode: string;
    productName: string;
    // NEW: Per-unit-type data
    unitData: {
      box: UnitBreakdown;
      pack: UnitBreakdown;
      piece: UnitBreakdown;
    };
    // Aggregated totals
    totalRevenue: number;
    totalRevenuePC: number;
    totalQuantity: number;
    transactions: number;
    averageUnitPrice: number;
    contributionPercent: number;
    // Store breakdown with unit details
    storeBreakdown: Array<{
      storeName: string;
      unitData: {
        box: UnitBreakdown;
        pack: UnitBreakdown;
        piece: UnitBreakdown;
      };
      totalRevenue: number;
      totalRevenuePC: number;
      totalQuantity: number;
    }>;
    bestRegion: string | null;
    topEmployees: Array<{
      name: string;
      totalRevenue: number;
      totalQuantity: number;
    }>;
    topStores: Array<{
      name: string;
      totalRevenue: number;
      totalQuantity: number;
    }>;
    lastSoldAt: string | null;
  }>;
  timeline: Array<{
    dateIso: string;
    label: string;
    totalRevenue: number;
    totalQuantity: number;
    transactions: number;
  }>;
  generatedAt: string;
};

function parseIsoDateString(value: string | undefined | null) {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [rawYear, rawMonth, rawDay] = parts;
  const year = Number.parseInt(rawYear, 10);
  const month = Number.parseInt(rawMonth, 10);
  const day = Number.parseInt(rawDay, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

function formatIsoDay(date: Date, timeZone: string) {
  const parts = getZonedDateParts(date, timeZone);
  return `${parts.year}-${padNumber(parts.month)}-${padNumber(parts.day)}`;
}

function formatCustomRangeLabel(start: Date, endInclusive: Date, timeZone: string) {
  const sameDay = formatIsoDay(start, timeZone) === formatIsoDay(endInclusive, timeZone);
  const sameMonth = sameDay
    ? true
    : getZonedDateParts(start, timeZone).month === getZonedDateParts(endInclusive, timeZone).month &&
      getZonedDateParts(start, timeZone).year === getZonedDateParts(endInclusive, timeZone).year;
  const sameYear = getZonedDateParts(start, timeZone).year ===
    getZonedDateParts(endInclusive, timeZone).year;

  if (sameDay) {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(start);
  }

  if (sameMonth) {
    const startLabel = new Intl.DateTimeFormat("th-TH", {
      timeZone,
      day: "numeric",
    }).format(start);
    const endLabel = new Intl.DateTimeFormat("th-TH", {
      timeZone,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(endInclusive);
    return `${startLabel} – ${endLabel}`;
  }

  if (sameYear) {
    const startLabel = new Intl.DateTimeFormat("th-TH", {
      timeZone,
      day: "numeric",
      month: "short",
    }).format(start);
    const endLabel = new Intl.DateTimeFormat("th-TH", {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(endInclusive);
    return `${startLabel} – ${endLabel}`;
  }

  const startLabel = new Intl.DateTimeFormat("th-TH", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("th-TH", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(endInclusive);
  return `${startLabel} – ${endLabel}`;
}

function normalizeRanges(
  inputs: IsoDateRangeInput[] | undefined,
  timeZone: string,
): NormalizedDateRange[] {
  if (!inputs || inputs.length === 0) {
    return [];
  }

  const ranges: NormalizedDateRange[] = [];

  for (const input of inputs) {
    const startParts = parseIsoDateString(input.start);
    if (!startParts) {
      continue;
    }
    const startDate = makeZonedDate(timeZone, startParts.year, startParts.month, startParts.day);
    let endDate: Date;
    if (input.end) {
      const endParts = parseIsoDateString(input.end) ?? startParts;
      const inclusiveEnd = makeZonedDate(timeZone, endParts.year, endParts.month, endParts.day);
      // Ensure end is not before start
      if (inclusiveEnd.getTime() < startDate.getTime()) {
        endDate = addDays(startDate, 1);
      } else {
        endDate = addDays(inclusiveEnd, 1);
      }
    } else {
      endDate = addDays(startDate, 1);
    }

    const inclusiveEndForLabel = addDays(endDate, -1);
    ranges.push({
      start: startDate,
      end: endDate,
      startIso: formatIsoDay(startDate, timeZone),
      endIso: formatIsoDay(inclusiveEndForLabel, timeZone),
      label: formatCustomRangeLabel(startDate, inclusiveEndForLabel, timeZone),
    });
  }

  return ranges;
}

// Helper: Parse unit type from unit_name (backwards compatibility)
function parseUnitType(unitName: string | null | undefined): "box" | "pack" | "piece" {
  if (!unitName) return "piece";
  const normalized = unitName.toLowerCase().trim();
  if (normalized.includes("กล่อง") || normalized.includes("box") || normalized.includes("ลัง")) return "box";
  if (normalized.includes("แพ็ค") || normalized.includes("pack")) return "pack";
  // "ปี๊บ", "ซอง", "ชิ้น" และหน่วยอื่นๆ จะเป็น "piece"
  return "piece";
}

// Helper: Create empty unit breakdown
function createEmptyUnitBreakdown(): UnitBreakdown {
  return {
    quantity: 0,
    revenuePC: 0,
  };
}

export async function getProductSalesReport(
  options: ProductSalesReportOptions = {},
): Promise<ProductSalesReport> {
  const data = await readData();
  const now = new Date();

  const employeeLookup = new Map(data.employees.map((employee) => [employee.id, employee]));
  const storeLookup = new Map(data.stores.map((store) => [store.id, store]));

  const selectedEmployees = (options.employeeIds ?? [])
    .map((id) => employeeLookup.get(id))
    .filter((value): value is EmployeeRecord => Boolean(value));
  const selectedStores = (options.storeIds ?? [])
    .map((id) => storeLookup.get(id))
    .filter((value): value is StoreRecord => Boolean(value));

  const employeeNameFilter = new Set(
    selectedEmployees.map((employee) => employee.name),
  );

  const storeNameFilter = new Set(
    selectedStores.map((store) => store.name),
  );

  // Normalize ranges – default to the last 30 days if none provided
  let ranges = normalizeRanges(options.dateRanges, DASHBOARD_TIME_ZONE);
  if (ranges.length === 0) {
    const nowParts = getZonedDateParts(now, DASHBOARD_TIME_ZONE);
    const endDefault = addDays(
      makeZonedDate(DASHBOARD_TIME_ZONE, nowParts.year, nowParts.month, nowParts.day),
      1,
    );
    const startDefault = addDays(endDefault, -30);
    ranges = [
      {
        start: startDefault,
        end: endDefault,
        startIso: formatIsoDay(startDefault, DASHBOARD_TIME_ZONE),
        endIso: formatIsoDay(addDays(endDefault, -1), DASHBOARD_TIME_ZONE),
        label: formatCustomRangeLabel(startDefault, addDays(endDefault, -1), DASHBOARD_TIME_ZONE),
      },
    ];
  }

  // Try to fetch from Supabase first
  let salesRecordsFromSupabase: Database["public"]["Tables"]["sales_records"]["Row"][] = [];
  let useSupabase = false;

  try {
    const client = getSupabaseServiceClient();

    // Query all ranges
    const allRecords: Database["public"]["Tables"]["sales_records"]["Row"][] = [];
    for (const range of ranges) {
      let query = client
        .from("sales_records")
        .select("*")
        .gte("recorded_date", range.startIso)
        .lte("recorded_date", range.endIso)
        .order("recorded_date", { ascending: true });

      if (employeeNameFilter.size > 0) {
        const employeeNames = Array.from(employeeNameFilter);
        query = query.in("employee_name", employeeNames);
      }

      if (storeNameFilter.size > 0) {
        const storeNames = Array.from(storeNameFilter);
        query = query.in("store_name", storeNames);
      }

      const { data: rangeData, error } = await query;
      if (error) {
        console.error("[getProductSalesReport] Supabase query error:", error);
        break;
      }
      if (rangeData) {
        allRecords.push(...rangeData);
      }
    }

    if (allRecords.length > 0 || ranges.length > 0) {
      salesRecordsFromSupabase = allRecords;
      useSupabase = true;
    }
  } catch (err) {
    console.error("[getProductSalesReport] Error querying Supabase, falling back to logs:", err);
  }

  // Data aggregation structures
  type ProductMapEntry = {
    productCode: string;
    productName: string;
    // Unit-specific data
    unitData: {
      box: {
        quantity: number;
        revenuePC: number;
        transactions: number;
      };
      pack: {
        quantity: number;
        revenuePC: number;
        transactions: number;
      };
      piece: {
        quantity: number;
        revenuePC: number;
        transactions: number;
      };
    };
    employees: Map<string, { name: string; totalRevenue: number; totalQuantity: number }>;
    stores: Map<string, {
      name: string;
      unitData: {
        box: { quantity: number; revenuePC: number };
        pack: { quantity: number; revenuePC: number };
        piece: { quantity: number; revenuePC: number };
      };
    }>;
    lastSoldAt: Date | null;
  };

  const productMap = new Map<string, ProductMapEntry>();

  const timelineBuckets = new Map<
    string,
    {
      label: string;
      totalRevenue: number;
      totalQuantity: number;
      transactions: number;
    }
  >();
  const timelineKeys: string[] = [];

  for (const range of ranges) {
    for (let cursor = new Date(range.start); cursor < range.end; cursor = addDays(cursor, 1)) {
      const iso = formatIsoDay(cursor, DASHBOARD_TIME_ZONE);
      if (timelineBuckets.has(iso)) continue;
      const label = new Intl.DateTimeFormat("th-TH", {
        timeZone: DASHBOARD_TIME_ZONE,
        day: "2-digit",
        month: "short",
      }).format(cursor);
      timelineBuckets.set(iso, {
        label,
        totalRevenue: 0,
        totalQuantity: 0,
        transactions: 0,
      });
      timelineKeys.push(iso);
    }
  }

  // Summary totals
  let totalRevenue = 0;
  let totalRevenuePC = 0;
  let totalQuantity = 0;
  let transactions = 0;

  // Summary unit breakdown
  const summaryUnitBreakdown = {
    box: { quantity: 0, revenuePC: 0, transactions: 0 },
    pack: { quantity: 0, revenuePC: 0, transactions: 0 },
    piece: { quantity: 0, revenuePC: 0, transactions: 0 },
  };

  if (useSupabase) {
    // Process Supabase records

    for (const record of salesRecordsFromSupabase) {
      const timestamp = new Date(`${record.recorded_date}T${record.recorded_time}`);
      const dayKey = record.recorded_date;

      // Parse unit type
      const unitType = parseUnitType(record.unit_name);

      // Calculate revenue from PC price
      const pricePC = record.unit_price || 0;
      const quantity = record.quantity || 0;

      const revenuePC = pricePC * quantity;

      // Update totals
      totalRevenue += revenuePC;
      totalRevenuePC += revenuePC;
      totalQuantity += quantity;
      transactions += 1;

      // Update summary unit breakdown
      summaryUnitBreakdown[unitType].quantity += quantity;
      summaryUnitBreakdown[unitType].revenuePC += revenuePC;
      summaryUnitBreakdown[unitType].transactions += 1;

      // Update product map
      const productKey = `${record.product_code || "unknown"}::${record.product_name}`;
      let productEntry = productMap.get(productKey);
      if (!productEntry) {
        productEntry = {
          productCode: record.product_code || "",
          productName: record.product_name,
          unitData: {
            box: { quantity: 0, revenuePC: 0, transactions: 0 },
            pack: { quantity: 0, revenuePC: 0, transactions: 0 },
            piece: { quantity: 0, revenuePC: 0, transactions: 0 },
          },
          employees: new Map(),
          stores: new Map(),
          lastSoldAt: null,
        };
        productMap.set(productKey, productEntry);
      }

      // Update unit data
      productEntry.unitData[unitType].quantity += quantity;
      productEntry.unitData[unitType].revenuePC += revenuePC;
      productEntry.unitData[unitType].transactions += 1;

      if (!productEntry.lastSoldAt || timestamp > productEntry.lastSoldAt) {
        productEntry.lastSoldAt = timestamp;
      }

      // Update employee stats
      const employeeKey = record.employee_name || "ไม่ระบุ";
      const employeeEntry = productEntry.employees.get(employeeKey) ?? {
        name: record.employee_name,
        totalRevenue: 0,
        totalQuantity: 0,
      };
      employeeEntry.totalRevenue += revenuePC;
      employeeEntry.totalQuantity += quantity;
      productEntry.employees.set(employeeKey, employeeEntry);

      // Update store stats with unit breakdown
      const storeKey = record.store_name || "ไม่ระบุ";
      let storeEntry = productEntry.stores.get(storeKey);
      if (!storeEntry) {
        storeEntry = {
          name: record.store_name || "ไม่ระบุ",
          unitData: {
            box: { quantity: 0, revenuePC: 0 },
            pack: { quantity: 0, revenuePC: 0 },
            piece: { quantity: 0, revenuePC: 0 },
          },
        };
        productEntry.stores.set(storeKey, storeEntry);
      }
      storeEntry.unitData[unitType].quantity += quantity;
      storeEntry.unitData[unitType].revenuePC += revenuePC;

      // Update timeline
      const dayBucket = timelineBuckets.get(dayKey);
      if (dayBucket) {
        dayBucket.totalRevenue += revenuePC;
        dayBucket.totalQuantity += quantity;
        dayBucket.transactions += 1;
      }
    }

  } else {
    // Fallback to logs
    const { salesRecords } = collectDashboardRecords(data.logs, DASHBOARD_TIME_ZONE);
    const rangeChecks = ranges.map((range) => ({
      start: range.start.getTime(),
      end: range.end.getTime(),
    }));

    for (const record of salesRecords) {
      const timestamp = record.timestamp.getTime();
      const inRange = rangeChecks.some((range) => timestamp >= range.start && timestamp < range.end);
      if (!inRange) continue;

      if (
        employeeNameFilter.size > 0 &&
        !employeeNameFilter.has(record.employeeName)
      ) {
        continue;
      }

      if (storeNameFilter.size > 0 && !storeNameFilter.has(record.storeName)) {
        continue;
      }

      // In logs, we don't have unit breakdown, so default to "piece"
      const unitType = "piece";
      const quantity = record.quantity;
      const revenuePC = record.total;

      totalRevenue += revenuePC;
      totalRevenuePC += revenuePC;
      totalQuantity += quantity;
      transactions += 1;

      summaryUnitBreakdown[unitType].quantity += quantity;
      summaryUnitBreakdown[unitType].revenuePC += revenuePC;
      summaryUnitBreakdown[unitType].transactions += 1;

      const productKey = `${record.productCode || "unknown"}::${record.productName}`;
      let productEntry = productMap.get(productKey);
      if (!productEntry) {
        productEntry = {
          productCode: record.productCode,
          productName: record.productName,
          unitData: {
            box: { quantity: 0, revenuePC: 0, transactions: 0 },
            pack: { quantity: 0, revenuePC: 0, transactions: 0 },
            piece: { quantity: 0, revenuePC: 0, transactions: 0 },
          },
          employees: new Map(),
          stores: new Map(),
          lastSoldAt: null,
        };
        productMap.set(productKey, productEntry);
      }

      productEntry.unitData[unitType].quantity += quantity;
      productEntry.unitData[unitType].revenuePC += revenuePC;
      productEntry.unitData[unitType].transactions += 1;

      if (!productEntry.lastSoldAt || record.timestamp > productEntry.lastSoldAt) {
        productEntry.lastSoldAt = record.timestamp;
      }

      const employeeKey = record.employeeName || "ไม่ระบุ";
      const employeeEntry = productEntry.employees.get(employeeKey) ?? {
        name: record.employeeName,
        totalRevenue: 0,
        totalQuantity: 0,
      };
      employeeEntry.totalRevenue += revenuePC;
      employeeEntry.totalQuantity += quantity;
      productEntry.employees.set(employeeKey, employeeEntry);

      const storeKey = record.storeName || "ไม่ระบุ";
      let storeEntry = productEntry.stores.get(storeKey);
      if (!storeEntry) {
        storeEntry = {
          name: record.storeName,
          unitData: {
            box: { quantity: 0, revenuePC: 0 },
            pack: { quantity: 0, revenuePC: 0 },
            piece: { quantity: 0, revenuePC: 0 },
          },
        };
        productEntry.stores.set(storeKey, storeEntry);
      }
      storeEntry.unitData[unitType].quantity += quantity;
      storeEntry.unitData[unitType].revenuePC += revenuePC;

      const dayBucket = timelineBuckets.get(record.dayKey);
      if (dayBucket) {
        dayBucket.totalRevenue += revenuePC;
        dayBucket.totalQuantity += quantity;
        dayBucket.transactions += 1;
      }
    }
  }

  // Build products array
  const uniqueEmployees = new Set<string>();
  const uniqueStores = new Set<string>();
  const allStoresInPeriod = new Set<string>();

  const products = Array.from(productMap.entries())
    .map(([productKey, entry]) => {
      const employeesArray = Array.from(entry.employees.values());
      const storesArray = Array.from(entry.stores.values());

      employeesArray.forEach((employee) => uniqueEmployees.add(employee.name));
      storesArray.forEach((store) => {
        uniqueStores.add(store.name);
        allStoresInPeriod.add(store.name);
      });

      // Calculate totals per product
      const productTotalQuantity =
        entry.unitData.box.quantity +
        entry.unitData.pack.quantity +
        entry.unitData.piece.quantity;
      const productTotalRevenuePC =
        entry.unitData.box.revenuePC +
        entry.unitData.pack.revenuePC +
        entry.unitData.piece.revenuePC;
      const productTotalRevenue = productTotalRevenuePC;

      // Build unit breakdown
      const unitData = {
        box: {
          ...createEmptyUnitBreakdown(),
          quantity: entry.unitData.box.quantity,
          revenuePC: entry.unitData.box.revenuePC,
        },
        pack: {
          ...createEmptyUnitBreakdown(),
          quantity: entry.unitData.pack.quantity,
          revenuePC: entry.unitData.pack.revenuePC,
        },
        piece: {
          ...createEmptyUnitBreakdown(),
          quantity: entry.unitData.piece.quantity,
          revenuePC: entry.unitData.piece.revenuePC,
        },
      };

      const topEmployees = employeesArray.sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 3);
      const topStores = storesArray
        .map((store) => ({
          name: store.name,
          totalRevenue:
            store.unitData.box.revenuePC +
            store.unitData.pack.revenuePC +
            store.unitData.piece.revenuePC,
          totalQuantity:
            store.unitData.box.quantity +
            store.unitData.pack.quantity +
            store.unitData.piece.quantity,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 3);

      // Build store breakdown
      const storeBreakdown = storesArray
        .map((store) => {
          const storeTotalRevenuePC =
            store.unitData.box.revenuePC +
            store.unitData.pack.revenuePC +
            store.unitData.piece.revenuePC;
          const storeTotalQuantity =
            store.unitData.box.quantity +
            store.unitData.pack.quantity +
            store.unitData.piece.quantity;

          return {
            storeName: store.name,
            unitData: {
              box: {
                ...createEmptyUnitBreakdown(),
                quantity: store.unitData.box.quantity,
                revenuePC: store.unitData.box.revenuePC,
              },
              pack: {
                ...createEmptyUnitBreakdown(),
                quantity: store.unitData.pack.quantity,
                revenuePC: store.unitData.pack.revenuePC,
              },
              piece: {
                ...createEmptyUnitBreakdown(),
                quantity: store.unitData.piece.quantity,
                revenuePC: store.unitData.piece.revenuePC,
              },
            },
            totalRevenue: Number(storeTotalRevenuePC.toFixed(2)),
            totalRevenuePC: Number(storeTotalRevenuePC.toFixed(2)),
            totalQuantity: Number(storeTotalQuantity.toFixed(2)),
          };
        })
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      // Calculate best region
      const regionMap = new Map<string, number>();
      for (const employee of employeesArray) {
        const employeeRecord = employeeLookup.get(
          data.employees.find((emp) => emp.name === employee.name)?.id ?? ""
        );
        const region = employeeRecord?.region?.trim() || "ไม่ระบุเขต";
        regionMap.set(region, (regionMap.get(region) ?? 0) + employee.totalRevenue);
      }

      let bestRegion: string | null = null;
      let maxRegionRevenue = 0;
      for (const [region, revenue] of regionMap.entries()) {
        if (revenue > maxRegionRevenue) {
          maxRegionRevenue = revenue;
          bestRegion = region;
        }
      }

      const averageUnitPrice = productTotalQuantity > 0 ? productTotalRevenue / productTotalQuantity : 0;

      return {
        productKey,
        productCode: entry.productCode,
        productName: entry.productName,
        unitData,
        totalRevenue: Number(productTotalRevenue.toFixed(2)),
        totalRevenuePC: Number(productTotalRevenuePC.toFixed(2)),
        totalQuantity: Number(productTotalQuantity.toFixed(2)),
        transactions:
          entry.unitData.box.transactions +
          entry.unitData.pack.transactions +
          entry.unitData.piece.transactions,
        averageUnitPrice: Number(averageUnitPrice.toFixed(2)),
        contributionPercent:
          totalRevenue > 0 ? Number(((productTotalRevenue / totalRevenue) * 100).toFixed(2)) : 0,
        storeBreakdown,
        bestRegion,
        topEmployees,
        topStores,
        lastSoldAt: entry.lastSoldAt ? entry.lastSoldAt.toISOString() : null,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const timeline = timelineKeys
    .map((key) => {
      const bucket = timelineBuckets.get(key)!;
      return {
        dateIso: key,
        label: bucket.label,
        totalRevenue: Number(bucket.totalRevenue.toFixed(2)),
        totalQuantity: Number(bucket.totalQuantity.toFixed(2)),
        transactions: bucket.transactions,
      };
    })
    .filter((entry) => entry.totalRevenue > 0 || entry.totalQuantity > 0 || entry.transactions > 0);

  const summaryAverageUnitPrice = totalQuantity > 0 ? totalRevenue / totalQuantity : 0;

  const rangeSummary = ranges.map((range) => range.label).join(", ");

  return {
    filters: {
      timeZone: DASHBOARD_TIME_ZONE,
      ranges: ranges.map((range) => ({
        startIso: range.startIso,
        endIso: range.endIso,
        label: range.label,
      })),
      employees: selectedEmployees.map((employee) => ({ id: employee.id, name: employee.name })),
      stores: selectedStores.map((store) => ({ id: store.id, name: store.name })),
      rangeSummary,
    },
    summary: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalRevenuePC: Number(totalRevenuePC.toFixed(2)),
      totalQuantity: Number(totalQuantity.toFixed(2)),
      transactions,
      averageUnitPrice: Number(summaryAverageUnitPrice.toFixed(2)),
      uniqueProducts: products.length,
      uniqueEmployees: uniqueEmployees.size,
      uniqueStores: uniqueStores.size,
      allStores: Array.from(allStoresInPeriod).sort((a, b) => a.localeCompare(b, "th")),
      unitBreakdown: {
        box: {
          ...createEmptyUnitBreakdown(),
          quantity: summaryUnitBreakdown.box.quantity,
          revenuePC: Number(summaryUnitBreakdown.box.revenuePC.toFixed(2)),
        },
        pack: {
          ...createEmptyUnitBreakdown(),
          quantity: summaryUnitBreakdown.pack.quantity,
          revenuePC: Number(summaryUnitBreakdown.pack.revenuePC.toFixed(2)),
        },
        piece: {
          ...createEmptyUnitBreakdown(),
          quantity: summaryUnitBreakdown.piece.quantity,
          revenuePC: Number(summaryUnitBreakdown.piece.revenuePC.toFixed(2)),
        },
      },
    },
    products,
    timeline,
    generatedAt: now.toISOString(),
  };
}

function collectDashboardRecords(
  logs: LogEntry[],
  timeZone: string,
) {
  const attendanceRecords: DashboardAttendanceRecord[] = [];
  const salesRecords: DashboardSalesRecord[] = [];

  for (const log of logs) {
    if (log.scope === "attendance") {
      const meta = log.meta ?? {};
      const timestampRaw =
        typeof meta.timestamp === "string" && meta.timestamp ? meta.timestamp : log.timestamp;
      const timestamp = timestampRaw ? new Date(timestampRaw) : null;
      if (!timestamp || Number.isNaN(timestamp.valueOf())) {
        continue;
      }
      const parts = getZonedDateParts(timestamp, timeZone);
      const dayKey = getDayKey(parts);
      const statusRaw =
        typeof meta.status === "string" ? meta.status.toLowerCase() : "check-in";
      const status: DashboardAttendanceRecord["status"] =
        statusRaw === "check-out" ? "check-out" : "check-in";
      const employeeName = normalizeDisplayValue(meta.employeeName, "ไม่ระบุ");
      const storeName = normalizeDisplayValue(meta.storeName, "ไม่ระบุ");
      attendanceRecords.push({
        timestamp,
        dayKey,
        storeName,
        employeeName,
        status,
        parts,
      });
    } else if (log.scope === "sales") {
      const meta = log.meta ?? {};
      const timestampRaw =
        typeof meta.timestamp === "string" && meta.timestamp ? meta.timestamp : log.timestamp;
      const timestamp = timestampRaw ? new Date(timestampRaw) : null;
      if (!timestamp || Number.isNaN(timestamp.valueOf())) {
        continue;
      }
      const parts = getZonedDateParts(timestamp, timeZone);
      const dayKey = getDayKey(parts);

      const storeName = normalizeDisplayValue(meta.storeName, "ไม่ระบุ");
      const employeeName = normalizeDisplayValue(meta.employeeName, "ไม่ระบุ");
      const status = normalizeSalesStatus(meta.status);

      const metaItems = Array.isArray(meta.items) ? meta.items : null;
      if (metaItems && metaItems.length > 0) {
        for (const item of metaItems) {
          const itemTotalRaw =
            typeof item?.total === "number"
              ? item.total
              : Number.parseFloat(String(item?.total ?? "0"));
          const itemQuantityRaw =
            typeof item?.quantity === "number"
              ? item.quantity
              : Number.parseFloat(String(item?.quantity ?? "0"));
          if (!Number.isFinite(itemTotalRaw) || !Number.isFinite(itemQuantityRaw)) {
            continue;
          }
          const productName = normalizeDisplayValue(item?.productName, "ไม่ระบุ");
          const productCode =
            typeof item?.productCode === "string" && item.productCode.trim()
              ? item.productCode.trim()
              : "";
          salesRecords.push({
            timestamp,
            dayKey,
            storeName,
            employeeName,
            productName,
            productCode,
            total: itemTotalRaw,
            quantity: itemQuantityRaw,
            status,
            parts,
          });
        }
        continue;
      }

      const rawTotal =
        typeof meta.total === "number"
          ? meta.total
          : Number.parseFloat(String(meta.total ?? "0"));
      if (!Number.isFinite(rawTotal)) continue;
      const rawQuantity =
        typeof meta.quantity === "number"
          ? meta.quantity
          : Number.parseFloat(String(meta.quantity ?? "0"));
      if (!Number.isFinite(rawQuantity)) continue;
      const productName = normalizeDisplayValue(meta.productName, "ไม่ระบุ");
      const productCode =
        typeof meta.productCode === "string" && meta.productCode.trim()
          ? meta.productCode.trim()
          : "";
      salesRecords.push({
        timestamp,
        dayKey,
        storeName,
        employeeName,
        productName,
        productCode,
        total: rawTotal,
        quantity: rawQuantity,
        status,
        parts,
      });
    }
  }

  return { attendanceRecords, salesRecords };
}

function makeZonedDate(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
) {
  const utc = Date.UTC(year, month - 1, day, hour, minute, second);
  const instant = new Date(utc);
  const parts = getZonedDateParts(instant, timeZone);
  const adjustedUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const diff = adjustedUtc - utc;
  return new Date(utc - diff);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

function formatRangeLabel(
  mode: DashboardRangeMode,
  start: Date,
  end: Date,
  timeZone: string,
) {
  if (mode === "year") {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone,
      year: "numeric",
    }).format(start);
  }
  if (mode === "month") {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone,
      month: "long",
      year: "numeric",
    }).format(start);
  }
  const startLabel = new Intl.DateTimeFormat("th-TH", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: mode === "day" ? "numeric" : undefined,
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("th-TH", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: mode === "day" ? "numeric" : undefined,
  }).format(addDays(end, -1));
  if (mode === "day") {
    return startLabel;
  }
  return `${startLabel} – ${endLabel}`;
}

const WEEKDAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function computeDefaultRangeValue(
  mode: DashboardRangeMode,
  now: Date,
  timeZone: string,
) {
  const nowParts = getZonedDateParts(now, timeZone);
  if (mode === "year") {
    return `${nowParts.year}`;
  }
  if (mode === "month") {
    return `${nowParts.year}-${padNumber(nowParts.month)}`;
  }
  if (mode === "day") {
    return `${nowParts.year}-${padNumber(nowParts.month)}-${padNumber(nowParts.day)}`;
  }
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });
  const weekdayLabel = weekdayFormatter.format(now);
  const weekdayIndex = WEEKDAY_ORDER.indexOf(weekdayLabel as (typeof WEEKDAY_ORDER)[number]);
  const daysFromMonday = weekdayIndex === -1 ? 0 : (weekdayIndex + 6) % 7;
  const start = addDays(now, -daysFromMonday);
  const startParts = getZonedDateParts(start, timeZone);
  return `${startParts.year}-${padNumber(startParts.month)}-${padNumber(startParts.day)}`;
}

function parseYearString(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}$/.test(trimmed)) {
    return null;
  }
  const year = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(year)) return null;
  return year;
}

function parseMonthString(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

function parseDateString(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);
  const day = Number.parseInt(match[3]!, 10);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

function computeRangeWindow(
  mode: DashboardRangeMode,
  rawValue: string | null | undefined,
  now: Date,
  timeZone: string,
) {
  const fallbackValue = computeDefaultRangeValue(mode, now, timeZone);
  let value = rawValue && rawValue.trim().length > 0 ? rawValue.trim() : fallbackValue;

  let start: Date;
  let end: Date;

  if (mode === "year") {
    const parsedYear = parseYearString(value) ?? parseYearString(fallbackValue) ?? now.getUTCFullYear();
    value = `${parsedYear}`;
    start = makeZonedDate(timeZone, parsedYear, 1, 1);
    end = makeZonedDate(timeZone, parsedYear + 1, 1, 1);
  } else if (mode === "month") {
    const parsed = parseMonthString(value) ?? parseMonthString(fallbackValue);
    const year = parsed?.year ?? now.getUTCFullYear();
    const month = parsed?.month ?? getZonedDateParts(now, timeZone).month;
    value = `${year}-${padNumber(month)}`;
    start = makeZonedDate(timeZone, year, month, 1);
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    end = makeZonedDate(timeZone, nextYear, nextMonth, 1);
  } else if (mode === "week") {
    const parsed = parseDateString(value) ?? parseDateString(fallbackValue);
    const year = parsed?.year ?? getZonedDateParts(now, timeZone).year;
    const month = parsed?.month ?? getZonedDateParts(now, timeZone).month;
    const day = parsed?.day ?? getZonedDateParts(now, timeZone).day;
    value = `${year}-${padNumber(month)}-${padNumber(day)}`;
    start = makeZonedDate(timeZone, year, month, day);
    end = addDays(start, 7);
  } else {
    const parsed = parseDateString(value) ?? parseDateString(fallbackValue);
    const year = parsed?.year ?? getZonedDateParts(now, timeZone).year;
    const month = parsed?.month ?? getZonedDateParts(now, timeZone).month;
    const day = parsed?.day ?? getZonedDateParts(now, timeZone).day;
    value = `${year}-${padNumber(month)}-${padNumber(day)}`;
    start = makeZonedDate(timeZone, year, month, day);
    end = addDays(start, 1);
  }

  return {
    value,
    start,
    end,
    label: formatRangeLabel(mode, start, end, timeZone),
  };
}

function sanitizeTimeInput(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function timeStringToMinutes(value: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(":").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function matchesTimeWindow(
  parts: ZonedDateParts,
  fromMinutes: number | null,
  toMinutes: number | null,
) {
  if (fromMinutes === null && toMinutes === null) {
    return true;
  }
  const minutes = parts.hour * 60 + parts.minute;
  if (fromMinutes !== null && minutes < fromMinutes) {
    return false;
  }
  if (toMinutes !== null && minutes > toMinutes) {
    return false;
  }
  return true;
}

type ResolvedDashboardFilters = {
  applied: DashboardAppliedFilters;
  rangeStart: Date;
  rangeEnd: Date;
  rangeLabel: string;
  rangeStartIso: string;
  rangeEndIso: string;
  timeFromMinutes: number | null;
  timeToMinutes: number | null;
};

function resolveDashboardFilters(
  options: DashboardFilterOptions | undefined,
  now: Date,
  timeZone: string,
): ResolvedDashboardFilters {
  const rangeModeCandidate = options?.range?.mode ?? DEFAULT_RANGE_MODE;
  const rangeMode: DashboardRangeMode =
    rangeModeCandidate === "day" ||
    rangeModeCandidate === "week" ||
    rangeModeCandidate === "year"
      ? rangeModeCandidate
      : "month";
  const rangeWindow = computeRangeWindow(
    rangeMode,
    options?.range?.value ?? null,
    now,
    timeZone,
  );

  const store =
    typeof options?.store === "string" && options.store.trim() ? options.store.trim() : null;
  const employee =
    typeof options?.employee === "string" && options.employee.trim()
      ? options.employee.trim()
      : null;
  const attendanceStatusCandidate = options?.attendanceStatus ?? "all";
  const attendanceStatus: DashboardAppliedFilters["attendanceStatus"] =
    attendanceStatusCandidate === "check-in" || attendanceStatusCandidate === "check-out"
      ? attendanceStatusCandidate
      : "all";
  const salesStatusRaw =
    typeof options?.salesStatus === "string" && options.salesStatus.trim()
      ? options.salesStatus.trim()
      : "all";
  const salesStatus =
    salesStatusRaw.toLowerCase() === "all" ? "all" : salesStatusRaw;
  const timeFrom = sanitizeTimeInput(options?.timeFrom);
  const timeTo = sanitizeTimeInput(options?.timeTo);

  const timeFromMinutes = timeStringToMinutes(timeFrom);
  const timeToMinutes = timeStringToMinutes(timeTo);

  return {
    applied: {
      rangeMode,
      rangeValue: rangeWindow.value,
      store,
      employee,
      attendanceStatus,
      salesStatus,
      timeFrom,
      timeTo,
    },
    rangeStart: rangeWindow.start,
    rangeEnd: rangeWindow.end,
    rangeLabel: rangeWindow.label,
    rangeStartIso: rangeWindow.start.toISOString(),
    rangeEndIso: rangeWindow.end.toISOString(),
    timeFromMinutes,
    timeToMinutes,
  };
}

export async function getDashboardSnapshot() {
  const data = await readData();
  const now = new Date();

  // Define time periods
  // ✅ Changed: Show ALL TIME revenue instead of 7 days
  const currentPeriodEnd = now;
  const currentPeriodStart = new Date(2000, 0, 1); // Start from year 2000 (all time)

  // Previous period = 7 days before current for comparison
  const previousPeriodEnd = new Date(now.getTime() - DASHBOARD_LOOKBACK_DAYS * DAY_IN_MS);
  const previousPeriodStart = new Date(previousPeriodEnd.getTime() - DASHBOARD_LOOKBACK_DAYS * DAY_IN_MS);

  // Try to fetch from Supabase first
  let attendanceRecords: DashboardAttendanceRecord[] = [];
  let salesRecords: DashboardSalesRecord[] = [];
  let useSupabase = false;

  try {
    const supabase = getSupabaseServiceClient();

    // Fetch attendance records from Supabase
    const startDateIso = formatIsoDay(previousPeriodStart, DASHBOARD_TIME_ZONE);
    const endDateIso = formatIsoDay(currentPeriodEnd, DASHBOARD_TIME_ZONE);

    const [attendanceResponse, salesResponse] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("recorded_date, recorded_time, status, employee_name, store_name")
        .gte("recorded_date", startDateIso)
        .lte("recorded_date", endDateIso)
        .order("recorded_date", { ascending: true }),
      supabase
        .from("sales_records")
        .select("recorded_date, recorded_time, employee_name, store_name, product_name, product_code, quantity, total")
        .gte("recorded_date", startDateIso)
        .lte("recorded_date", endDateIso)
        .order("recorded_date", { ascending: true })
    ]);

    if (!attendanceResponse.error && !salesResponse.error) {
      useSupabase = true;

      // Convert Supabase attendance records to dashboard format
      attendanceRecords = (attendanceResponse.data ?? []).map(record => {
        const timestamp = new Date(`${record.recorded_date}T${record.recorded_time}`);
        const parts = getZonedDateParts(timestamp, DASHBOARD_TIME_ZONE);
        return {
          timestamp,
          dayKey: getDayKey(parts),
          storeName: record.store_name ?? "ไม่ระบุ",
          employeeName: record.employee_name ?? "ไม่ระบุ",
          status: (record.status?.toLowerCase() === "check-out" ? "check-out" : "check-in") as "check-in" | "check-out",
          parts,
        };
      });

      // Convert Supabase sales records to dashboard format
      salesRecords = (salesResponse.data ?? []).map(record => {
        const timestamp = new Date(`${record.recorded_date}T${record.recorded_time}`);
        const parts = getZonedDateParts(timestamp, DASHBOARD_TIME_ZONE);
        return {
          timestamp,
          dayKey: getDayKey(parts),
          storeName: record.store_name ?? "ไม่ระบุ",
          employeeName: record.employee_name ?? "ไม่ระบุ",
          productName: record.product_name ?? "ไม่ระบุ",
          productCode: record.product_code ?? "",
          total: record.total ?? 0,
          quantity: record.quantity ?? 0,
          status: "completed",
          parts,
        };
      });
    }
  } catch (error) {
    console.error("[getDashboardSnapshot] Error fetching from Supabase, falling back to logs:", error);
  }

  // Fallback to logs if Supabase failed
  if (!useSupabase) {
    const logsData = collectDashboardRecords(data.logs, DASHBOARD_TIME_ZONE);
    attendanceRecords = logsData.attendanceRecords;
    salesRecords = logsData.salesRecords;
  }

  const currentAttendance = attendanceRecords.filter(
    (record) => record.timestamp >= currentPeriodStart && record.timestamp < currentPeriodEnd,
  );
  const previousAttendance = attendanceRecords.filter(
    (record) => record.timestamp >= previousPeriodStart && record.timestamp < previousPeriodEnd,
  );
  const currentSales = salesRecords.filter(
    (record) => record.timestamp >= currentPeriodStart && record.timestamp < currentPeriodEnd,
  );
  const previousSales = salesRecords.filter(
    (record) => record.timestamp >= previousPeriodStart && record.timestamp < previousPeriodEnd,
  );

  const currentCheckIns = currentAttendance.filter((record) => record.status === "check-in").length;
  const previousCheckIns = previousAttendance.filter((record) => record.status === "check-in").length;

  const currentSalesTotal = currentSales.reduce((sum, record) => sum + record.total, 0);
  const previousSalesTotal = previousSales.reduce((sum, record) => sum + record.total, 0);

  const currentSalesTransactions = currentSales.length;
  const previousSalesTransactions = previousSales.length;

  const currentAverageTicket =
    currentSalesTransactions > 0 ? currentSalesTotal / currentSalesTransactions : 0;
  const previousAverageTicket =
    previousSalesTransactions > 0 ? previousSalesTotal / previousSalesTransactions : 0;

  const activeEmployeesCurrent = new Set(
    currentAttendance.filter((record) => record.status === "check-in").map((record) => record.employeeName),
  );

  const kpiAlerts: string[] = [];
  if (percentChange(currentSalesTotal, previousSalesTotal) < -20) {
    kpiAlerts.push("ยอดขายลดลงมากกว่า 20% เมื่อเทียบกับช่วงก่อนหน้า");
  }
  if (percentChange(currentCheckIns, previousCheckIns) < -15) {
    kpiAlerts.push("จำนวนการเช็กอินลดลงมากกว่า 15%");
  }

  const timelineBuckets = new Map<
    string,
    {
      dateKey: string;
      label: string;
      iso: string;
      salesTotal: number;
      salesCount: number;
      salesQuantity: number;
      checkIns: number;
      checkOuts: number;
    }
  >();
  const timelineKeys: string[] = [];

  for (let offset = PERFORMANCE_TIMELINE_DAYS - 1; offset >= 0; offset -= 1) {
    const anchor = new Date(now);
    anchor.setUTCDate(anchor.getUTCDate() - offset);
    const parts = getZonedDateParts(anchor, DASHBOARD_TIME_ZONE);
    const dayKey = getDayKey(parts);
    if (!timelineBuckets.has(dayKey)) {
      timelineBuckets.set(dayKey, {
        dateKey: dayKey,
        label: formatDayLabel(anchor, DASHBOARD_TIME_ZONE),
        iso: new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).toISOString(),
        salesTotal: 0,
        salesCount: 0,
        salesQuantity: 0,
        checkIns: 0,
        checkOuts: 0,
      });
      timelineKeys.push(dayKey);
    }
  }

  type StoreSegment = {
    key: string;
    label: string;
    salesTotal: number;
    salesCount: number;
    salesQuantity: number;
    checkIns: number;
    checkOuts: number;
    employees: Set<string>;
  };

  type EmployeeSegment = {
    key: string;
    label: string;
    checkIns: number;
    checkOuts: number;
    stores: Set<string>;
  };

  const storeSegments = new Map<string, StoreSegment>();
  const employeeSegments = new Map<string, EmployeeSegment>();

  function ensureStoreSegment(keyRaw: string) {
    const key = keyRaw || "ไม่ระบุ";
    if (!storeSegments.has(key)) {
      storeSegments.set(key, {
        key,
        label: key,
        salesTotal: 0,
        salesCount: 0,
        salesQuantity: 0,
        checkIns: 0,
        checkOuts: 0,
        employees: new Set<string>(),
      });
    }
    return storeSegments.get(key)!;
  }

  function ensureEmployeeSegment(keyRaw: string) {
    const key = keyRaw || "ไม่ระบุ";
    if (!employeeSegments.has(key)) {
      employeeSegments.set(key, {
        key,
        label: key,
        checkIns: 0,
        checkOuts: 0,
        stores: new Set<string>(),
      });
    }
    return employeeSegments.get(key)!;
  }

  for (const record of attendanceRecords) {
    const bucket = timelineBuckets.get(record.dayKey);
    if (bucket) {
      if (record.status === "check-in") {
        bucket.checkIns += 1;
      } else {
        bucket.checkOuts += 1;
      }
    }

    const storeSegment = ensureStoreSegment(record.storeName);
    if (record.status === "check-in") {
      storeSegment.checkIns += 1;
      storeSegment.employees.add(record.employeeName);
    } else {
      storeSegment.checkOuts += 1;
    }

    const employeeSegment = ensureEmployeeSegment(record.employeeName);
    if (record.status === "check-in") {
      employeeSegment.checkIns += 1;
      employeeSegment.stores.add(record.storeName);
    } else {
      employeeSegment.checkOuts += 1;
    }
  }

  const productMap = new Map<string, { name: string; total: number; quantity: number }>();

  for (const record of salesRecords) {
    const bucket = timelineBuckets.get(record.dayKey);
    if (bucket) {
      bucket.salesTotal += record.total;
      bucket.salesCount += 1;
      bucket.salesQuantity += record.quantity;
    }

    const storeSegment = ensureStoreSegment(record.storeName);
    storeSegment.salesTotal += record.total;
    storeSegment.salesCount += 1;
    storeSegment.salesQuantity += record.quantity;

    if (record.timestamp >= currentPeriodStart && record.timestamp < currentPeriodEnd) {
      const entry = productMap.get(record.productName) ?? {
        name: record.productName,
        total: 0,
        quantity: 0,
      };
      entry.total += record.total;
      entry.quantity += record.quantity;
      productMap.set(record.productName, entry);
    }
  }

  const timeline = timelineKeys.map((key) => {
    const bucket = timelineBuckets.get(key)!;
    return {
      ...bucket,
      salesTotal: Number(bucket.salesTotal.toFixed(2)),
      salesAverage:
        bucket.salesCount > 0 ? Number((bucket.salesTotal / bucket.salesCount).toFixed(2)) : 0,
      salesQuantity: Number(bucket.salesQuantity.toFixed(2)),
    };
  });

  const weekly: Array<{
    label: string;
    startIso: string;
    endIso: string;
    salesTotal: number;
    salesQuantity: number;
    checkIns: number;
  }> = [];

  if (timeline.length >= 7) {
    const currentWeek = timeline.slice(-7);
    const previousWeek = timeline.slice(-14, -7);
    if (previousWeek.length > 0) {
      weekly.push({
        label: "สัปดาห์ก่อน",
        startIso: previousWeek[0]!.iso,
        endIso: previousWeek[previousWeek.length - 1]!.iso,
        salesTotal: previousWeek.reduce((sum, point) => sum + point.salesTotal, 0),
        salesQuantity: previousWeek.reduce((sum, point) => sum + point.salesQuantity, 0),
        checkIns: previousWeek.reduce((sum, point) => sum + point.checkIns, 0),
      });
    }
    weekly.push({
      label: "สัปดาห์นี้",
      startIso: currentWeek[0]!.iso,
      endIso: currentWeek[currentWeek.length - 1]!.iso,
      salesTotal: currentWeek.reduce((sum, point) => sum + point.salesTotal, 0),
      salesQuantity: currentWeek.reduce((sum, point) => sum + point.salesQuantity, 0),
      checkIns: currentWeek.reduce((sum, point) => sum + point.checkIns, 0),
    });
  }

  const storeSegmentsList = Array.from(storeSegments.values()).map((segment) => ({
    id: segment.key || "unknown-store",
    label: segment.label,
    salesTotal: Number(segment.salesTotal.toFixed(2)),
    salesCount: segment.salesCount,
    salesQuantity: Number(segment.salesQuantity.toFixed(2)),
    checkIns: segment.checkIns,
    checkOuts: segment.checkOuts,
    activeEmployees: segment.employees.size,
  }));

  const employeeSegmentsList = Array.from(employeeSegments.values()).map((segment) => ({
    id: segment.key || "unknown-employee",
    label: segment.label,
    checkIns: segment.checkIns,
    checkOuts: segment.checkOuts,
    stores: Array.from(segment.stores),
  }));

  const dailyTrend =
    timeline.length > 0
      ? timeline.slice(-DASHBOARD_LOOKBACK_DAYS).map((point) => ({
          total: point.salesTotal,
          quantity: point.salesQuantity,
          display: point.label,
        }))
      : [];

  const salesTopProducts = Array.from(productMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((product) => ({
      name: product.name,
      total: Number(product.total.toFixed(2)),
      quantity: Number(product.quantity.toFixed(2)),
    }));

  const currentSalesQuantity = currentSales.reduce((sum, record) => sum + record.quantity, 0);

  return {
    totals: {
      employees: data.employees.length,
      stores: data.stores.length,
      products: data.products.length,
      logs: data.logs.length,
    },
    kpis: {
      period: {
        currentStart: currentPeriodStart.toISOString(),
        currentEnd: currentPeriodEnd.toISOString(),
        previousStart: previousPeriodStart.toISOString(),
        previousEnd: previousPeriodEnd.toISOString(),
      },
      alerts: kpiAlerts,
      attendance: {
        value: currentCheckIns,
        previous: previousCheckIns,
        deltaPercent: percentChange(currentCheckIns, previousCheckIns),
      },
      sales: {
        value: Number(currentSalesTotal.toFixed(2)),
        previous: Number(previousSalesTotal.toFixed(2)),
        deltaPercent: percentChange(currentSalesTotal, previousSalesTotal),
      },
      averageTicket: {
        value: Number(currentAverageTicket.toFixed(2)),
        previous: Number(previousAverageTicket.toFixed(2)),
        deltaPercent: percentChange(currentAverageTicket, previousAverageTicket),
      },
      salesTransactions: {
        value: currentSalesTransactions,
        previous: previousSalesTransactions,
        deltaPercent: percentChange(currentSalesTransactions, previousSalesTransactions),
      },
    },
    performance: {
      timeline,
      weekly,
      segments: {
        store: storeSegmentsList,
        employee: employeeSegmentsList,
      },
      metadata: {
        lookbackDays: PERFORMANCE_TIMELINE_DAYS,
        timeZone: DASHBOARD_TIME_ZONE,
        generatedAt: now.toISOString(),
      },
    },
    attendance: {
      totalCheckIns: currentCheckIns,
      activeEmployees: activeEmployeesCurrent.size,
    },
    sales: {
      dailyTrend:
        dailyTrend.length > 0
          ? dailyTrend
          : Array.from({ length: DASHBOARD_LOOKBACK_DAYS }).map((_, index) => {
              const anchor = new Date(currentPeriodStart);
              anchor.setDate(currentPeriodStart.getDate() + index);
              return {
                total: 0,
                quantity: 0,
                display: anchor.toLocaleDateString("th-TH", {
                  day: "numeric",
                  month: "short",
                }),
              };
            }),
      topProducts: salesTopProducts,
      totalRevenue: Number(currentSalesTotal.toFixed(2)),
      totalQuantity: Number(currentSalesQuantity.toFixed(2)),
    },
    updatedAt: now.toISOString(),
  };
}

export async function getDashboardMetrics(
  options: DashboardFilterOptions = {},
): Promise<DashboardMetrics> {
  const data = await readData();
  const now = new Date();
  const resolved = resolveDashboardFilters(options, now, DASHBOARD_TIME_ZONE);

  // Try to fetch from Supabase first
  let attendanceRecords: DashboardAttendanceRecord[] = [];
  let salesRecords: DashboardSalesRecord[] = [];
  let useSupabase = false;

  try {
    const supabase = getSupabaseServiceClient();

    // Fetch from Supabase within the resolved date range
    const startDateIso = formatIsoDay(resolved.rangeStart, DASHBOARD_TIME_ZONE);
    const endDateIso = formatIsoDay(resolved.rangeEnd, DASHBOARD_TIME_ZONE);

    const [attendanceResponse, salesResponse] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("recorded_date, recorded_time, status, employee_name, store_name")
        .gte("recorded_date", startDateIso)
        .lte("recorded_date", endDateIso)
        .order("recorded_date", { ascending: true }),
      supabase
        .from("sales_records")
        .select("recorded_date, recorded_time, employee_name, store_name, product_name, product_code, quantity, total")
        .gte("recorded_date", startDateIso)
        .lte("recorded_date", endDateIso)
        .order("recorded_date", { ascending: true })
    ]);

    if (!attendanceResponse.error && !salesResponse.error) {
      useSupabase = true;

      // Convert Supabase attendance records to dashboard format
      attendanceRecords = (attendanceResponse.data ?? []).map(record => {
        const timestamp = new Date(`${record.recorded_date}T${record.recorded_time}`);
        const parts = getZonedDateParts(timestamp, DASHBOARD_TIME_ZONE);
        return {
          timestamp,
          dayKey: getDayKey(parts),
          storeName: record.store_name ?? "ไม่ระบุ",
          employeeName: record.employee_name ?? "ไม่ระบุ",
          status: (record.status?.toLowerCase() === "check-out" ? "check-out" : "check-in") as "check-in" | "check-out",
          parts,
        };
      });

      // Convert Supabase sales records to dashboard format
      salesRecords = (salesResponse.data ?? []).map(record => {
        const timestamp = new Date(`${record.recorded_date}T${record.recorded_time}`);
        const parts = getZonedDateParts(timestamp, DASHBOARD_TIME_ZONE);
        return {
          timestamp,
          dayKey: getDayKey(parts),
          storeName: record.store_name ?? "ไม่ระบุ",
          employeeName: record.employee_name ?? "ไม่ระบุ",
          productName: record.product_name ?? "ไม่ระบุ",
          productCode: record.product_code ?? "",
          total: record.total ?? 0,
          quantity: record.quantity ?? 0,
          status: "completed",
          parts,
        };
      });
    }
  } catch (error) {
    console.error("[getDashboardMetrics] Error fetching from Supabase, falling back to logs:", error);
  }

  // Fallback to logs if Supabase failed
  if (!useSupabase) {
    const logsData = collectDashboardRecords(data.logs, DASHBOARD_TIME_ZONE);
    attendanceRecords = logsData.attendanceRecords;
    salesRecords = logsData.salesRecords;
  }

  const storeFilter = resolved.applied.store
    ? resolved.applied.store.toLocaleLowerCase("th")
    : null;
  const employeeFilter = resolved.applied.employee
    ? resolved.applied.employee.toLocaleLowerCase("th")
    : null;
  const attendanceStatusFilter = resolved.applied.attendanceStatus;
  const salesStatusFilter = resolved.applied.salesStatus.toLocaleLowerCase("th");
  const timeFromMinutes = resolved.timeFromMinutes;
  const timeToMinutes = resolved.timeToMinutes;

  const filteredAttendance = attendanceRecords.filter((record) => {
    if (record.timestamp < resolved.rangeStart || record.timestamp >= resolved.rangeEnd) {
      return false;
    }
    if (storeFilter && record.storeName.toLocaleLowerCase("th") !== storeFilter) {
      return false;
    }
    if (employeeFilter && record.employeeName.toLocaleLowerCase("th") !== employeeFilter) {
      return false;
    }
    if (attendanceStatusFilter !== "all" && record.status !== attendanceStatusFilter) {
      return false;
    }
    if (!matchesTimeWindow(record.parts, timeFromMinutes, timeToMinutes)) {
      return false;
    }
    return true;
  });

  const filteredSales = salesRecords.filter((record) => {
    if (record.timestamp < resolved.rangeStart || record.timestamp >= resolved.rangeEnd) {
      return false;
    }
    if (storeFilter && record.storeName.toLocaleLowerCase("th") !== storeFilter) {
      return false;
    }
    if (employeeFilter && record.employeeName.toLocaleLowerCase("th") !== employeeFilter) {
      return false;
    }
    if (
      salesStatusFilter !== "all" &&
      record.status.toLocaleLowerCase("th") !== salesStatusFilter
    ) {
      return false;
    }
    if (!matchesTimeWindow(record.parts, timeFromMinutes, timeToMinutes)) {
      return false;
    }
    return true;
  });

  let attendanceCheckIns = 0;
  let attendanceCheckOuts = 0;
  const attendanceEmployees = new Set<string>();

  for (const record of filteredAttendance) {
    if (record.status === "check-in") {
      attendanceCheckIns += 1;
      attendanceEmployees.add(record.employeeName);
    } else if (record.status === "check-out") {
      attendanceCheckOuts += 1;
    }
  }

  const timelineBuckets = new Map<
    string,
    {
      label: string;
      checkIns: number;
      checkOuts: number;
      salesTotal: number;
      salesQuantity: number;
      salesTransactions: number;
    }
  >();
  const timelineKeys: string[] = [];

  for (
    let cursor = new Date(resolved.rangeStart.getTime());
    cursor < resolved.rangeEnd;
    cursor = addDays(cursor, 1)
  ) {
    const parts = getZonedDateParts(cursor, DASHBOARD_TIME_ZONE);
    const dayKey = getDayKey(parts);
    if (timelineBuckets.has(dayKey)) {
      continue;
    }
    timelineKeys.push(dayKey);
    timelineBuckets.set(dayKey, {
      label: formatDayLabel(cursor, DASHBOARD_TIME_ZONE),
      checkIns: 0,
      checkOuts: 0,
      salesTotal: 0,
      salesQuantity: 0,
      salesTransactions: 0,
    });
  }

  for (const record of filteredAttendance) {
    const bucket = timelineBuckets.get(record.dayKey);
    if (!bucket) {
      continue;
    }
    if (record.status === "check-in") {
      bucket.checkIns += 1;
    } else if (record.status === "check-out") {
      bucket.checkOuts += 1;
    }
  }

  const salesByStore = new Map<
    string,
    { label: string; total: number; transactions: number; quantity: number }
  >();
  const salesByEmployee = new Map<
    string,
    { label: string; total: number; transactions: number; quantity: number }
  >();
  const salesStatuses = new Map<
    string,
    { status: string; total: number; transactions: number; quantity: number }
  >();
  const availableSalesStatuses = new Set<string>(["completed"]);

  let salesTotalRevenue = 0;
  let salesTotalQuantity = 0;

  for (const record of filteredSales) {
    const bucket = timelineBuckets.get(record.dayKey);
    if (bucket) {
      bucket.salesTotal += record.total;
      bucket.salesQuantity += record.quantity;
      bucket.salesTransactions += 1;
    }

    salesTotalRevenue += record.total;
    salesTotalQuantity += record.quantity;

    const storeKey = record.storeName || "ไม่ระบุ";
    const storeEntry =
      salesByStore.get(storeKey) ??
      {
        label: storeKey,
        total: 0,
        transactions: 0,
        quantity: 0,
      };
    storeEntry.total += record.total;
    storeEntry.transactions += 1;
    storeEntry.quantity += record.quantity;
    salesByStore.set(storeKey, storeEntry);

    const employeeKey = record.employeeName || "ไม่ระบุ";
    const employeeEntry =
      salesByEmployee.get(employeeKey) ??
      {
        label: employeeKey,
        total: 0,
        transactions: 0,
        quantity: 0,
      };
    employeeEntry.total += record.total;
    employeeEntry.transactions += 1;
    employeeEntry.quantity += record.quantity;
    salesByEmployee.set(employeeKey, employeeEntry);

    const statusLabel = record.status || "completed";
    const statusKey = statusLabel.toLocaleLowerCase("th");
    const statusEntry =
      salesStatuses.get(statusKey) ??
      {
        status: statusLabel,
        total: 0,
        transactions: 0,
        quantity: 0,
      };
    statusEntry.total += record.total;
    statusEntry.transactions += 1;
    statusEntry.quantity += record.quantity;
    salesStatuses.set(statusKey, statusEntry);
    availableSalesStatuses.add(statusLabel);
  }

  for (const record of salesRecords) {
    availableSalesStatuses.add(record.status);
  }

  const attendanceTimeline = timelineKeys.map((key) => {
    const bucket = timelineBuckets.get(key)!;
    return {
      dateKey: key,
      label: bucket.label,
      checkIns: bucket.checkIns,
      checkOuts: bucket.checkOuts,
    };
  });

  const salesTimeline = timelineKeys.map((key) => {
    const bucket = timelineBuckets.get(key)!;
    return {
      dateKey: key,
      label: bucket.label,
      total: Number(bucket.salesTotal.toFixed(2)),
      quantity: Number(bucket.salesQuantity.toFixed(2)),
      transactions: bucket.salesTransactions,
    };
  });

  const salesByStoreList = Array.from(salesByStore.values())
    .map((entry) => ({
      label: entry.label,
      total: Number(entry.total.toFixed(2)),
      transactions: entry.transactions,
      quantity: Number(entry.quantity.toFixed(2)),
    }))
    .sort((a, b) => b.total - a.total);

  const salesByEmployeeList = Array.from(salesByEmployee.values())
    .map((entry) => ({
      label: entry.label,
      total: Number(entry.total.toFixed(2)),
      transactions: entry.transactions,
      quantity: Number(entry.quantity.toFixed(2)),
    }))
    .sort((a, b) => b.total - a.total);

  const salesStatusesList = Array.from(salesStatuses.values())
    .map((entry) => ({
      status: entry.status,
      total: Number(entry.total.toFixed(2)),
      transactions: entry.transactions,
      quantity: Number(entry.quantity.toFixed(2)),
    }))
    .sort((a, b) => b.total - a.total);

  const availableStatuses = Array.from(availableSalesStatuses)
    .map((status) => status || "completed")
    .filter((status, index, self) => self.indexOf(status) === index)
    .sort((a, b) => a.localeCompare(b, "th"));

  const salesTransactions = filteredSales.length;
  const averageTicket =
    salesTransactions > 0 ? Number((salesTotalRevenue / salesTransactions).toFixed(2)) : 0;

  return {
    filters: {
      ...resolved.applied,
      rangeLabel: resolved.rangeLabel,
      rangeStartIso: resolved.rangeStartIso,
      rangeEndIso: resolved.rangeEndIso,
    },
    attendance: {
      total: filteredAttendance.length,
      checkIns: attendanceCheckIns,
      checkOuts: attendanceCheckOuts,
      uniqueEmployees: attendanceEmployees.size,
      timeline: attendanceTimeline,
    },
    sales: {
      totalRevenue: Number(salesTotalRevenue.toFixed(2)),
      totalQuantity: Number(salesTotalQuantity.toFixed(2)),
      transactions: salesTransactions,
      averageTicket,
      timeline: salesTimeline,
      byStore: salesByStoreList,
      byEmployee: salesByEmployeeList,
      statuses: salesStatusesList,
      availableStatuses,
    },
  };
}

export async function getProductById(id: string) {
  const data = await readData();
  return data.products.find((product) => product.id === id) ?? null;
}

export async function getProductByCode(code: string) {
  const data = await readData();
  return (
    data.products.find(
      (product) => product.code.toLocaleLowerCase("th") === code.toLocaleLowerCase("th"),
    ) ?? null
  );
}

// ==================== Category Management ====================

export async function getCategories() {
  const data = await readData();
  return data.categories
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
}

export async function createCategory({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("กรุณาระบุชื่อหมวดหมู่");
  }
  const now = new Date().toISOString();
  const data = await readData();
  const exists = data.categories.some(
    (category) => category.name.toLocaleLowerCase("th") === trimmedName.toLocaleLowerCase("th"),
  );
  if (exists) {
    throw new Error("มีชื่อหมวดหมู่นี้อยู่แล้ว");
  }
  const category: CategoryRecord = {
    id: randomUUID(),
    name: trimmedName,
    color: color || "#3b82f6",
    createdAt: now,
    updatedAt: now,
  };
  data.categories.push(category);
  // await writeData(data); // Disabled: Netlify read-only filesystem
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "product",
    action: "create",
    details: `เพิ่มหมวดหมู่ใหม่: ${category.name}`,
    metadata: { categoryId: category.id },
  });
  return category;
}

export async function updateCategory(
  id: string,
  { name, color }: { name: string; color: string },
) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("กรุณาระบุชื่อหมวดหมู่");
  }
  const data = await readData();
  const index = data.categories.findIndex((category) => category.id === id);
  if (index === -1) {
    throw new Error("ไม่พบหมวดหมู่ที่ต้องการแก้ไข");
  }
  const duplicate = data.categories.some(
    (category) =>
      category.id !== id &&
      category.name.toLocaleLowerCase("th") === trimmedName.toLocaleLowerCase("th"),
  );
  if (duplicate) {
    throw new Error("มีชื่อหมวดหมู่นี้อยู่แล้ว");
  }
  data.categories[index] = {
    ...data.categories[index],
    name: trimmedName,
    color: color || "#3b82f6",
    updatedAt: new Date().toISOString(),
  };
  // await writeData(data); // Disabled: Netlify read-only filesystem
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "product",
    action: "update",
    details: `ปรับปรุงหมวดหมู่: ${trimmedName}`,
    metadata: { categoryId: id },
  });
  return data.categories[index];
}

export async function deleteCategory(id: string) {
  // Get category name for logging
  const existing = await supabaseCategories.getCategory(id);
  if (!existing) {
    throw new Error("ไม่พบหมวดหมู่ที่ต้องการลบ");
  }

  // TODO: If products are still in JSON, need to update them here
  // For now, assuming products will handle category deletion via cascade/set null
  // If products are still in data/app-data.json, uncomment below:
  /*
  const data = await readData();
  data.products = data.products.map((product) => ({
    ...product,
    categoryId: product.categoryId === id ? null : product.categoryId,
    updatedAt: product.categoryId === id ? new Date().toISOString() : product.updatedAt,
  }));
  // await writeData(data); // Disabled: Netlify read-only filesystem
  */

  // Delete from Supabase
  await supabaseCategories.deleteCategory(id);

  // Log the change
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: "product",
    action: "delete",
    details: `ลบหมวดหมู่: ${existing.name}`,
    metadata: { categoryId: id },
  });
}
