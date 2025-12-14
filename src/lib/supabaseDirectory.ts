import type { EmployeeRecord as ConfigEmployeeRecord, StoreRecord as ConfigStoreRecord } from "@/lib/configStore";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// Re-export types for convenience
export type EmployeeRecord = ConfigEmployeeRecord;
export type StoreRecord = ConfigStoreRecord;

type StoreRow = Database["public"]["Tables"]["stores"]["Row"];
type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];
type StoreInsert = Database["public"]["Tables"]["stores"]["Insert"];
type EmployeeInsert = Database["public"]["Tables"]["employees"]["Insert"];

function getClientOrNull(): SupabaseClient<Database> | null {
  try {
    return getSupabaseServiceClient();
  } catch (error) {
    console.warn("[supabase] skipping directory sync:", (error as Error).message);
    return null;
  }
}

function normalizeTimestamp(value?: string): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

async function upsertWithColumnFallback<T extends keyof Database["public"]["Tables"]>(
  client: SupabaseClient<Database>,
  table: T,
  payload: Database["public"]["Tables"][T]["Insert"],
  options?: { onConflict?: string },
): Promise<void> {
  const droppedColumns = new Set<string>();
  // eslint-disable-next-line prefer-const
  let currentPayload: Record<string, unknown> = { ...(payload as Record<string, unknown>) };

  while (true) {
    // Workaround for Supabase client type inference issue with generic table parameter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client as any).from(table).upsert(currentPayload, options ?? {});
    if (!error) {
      if (droppedColumns.size > 0) {
        console.warn(
          `[supabase] upsert ${String(table)} succeeded after dropping columns: ${Array.from(droppedColumns).join(", ")}`,
        );
      }
      return;
    }

    const missingColumnMatch =
      error.code === "PGRST204" && typeof error.message === "string"
        ? /'([^']+)'/.exec(error.message)
        : null;

    if (missingColumnMatch) {
      const missingColumn = missingColumnMatch[1];
      if (!Object.prototype.hasOwnProperty.call(currentPayload, missingColumn)) {
        console.error(`[supabase] failed to upsert ${String(table)}`, error);
        return;
      }
      if (droppedColumns.has(missingColumn)) {
        console.error(`[supabase] failed to upsert ${String(table)}`, error);
        return;
      }
      delete currentPayload[missingColumn];
      droppedColumns.add(missingColumn);
      continue;
    }

    console.error(`[supabase] failed to upsert ${String(table)}`, error);
    return;
  }
}

export async function upsertStoreRecordToSupabase(store: StoreRecord): Promise<void> {
  const client = getClientOrNull();
  if (!client) return;
  const basePayload: StoreInsert = {
    id: store.id,
    name: store.name,
    province: store.province ?? null,
    address: store.address ?? null,
    latitude: store.latitude ?? null,
    longitude: store.longitude ?? null,
    radius: store.radius ?? null,
    created_at: normalizeTimestamp(store.createdAt),
    updated_at: normalizeTimestamp(store.updatedAt),
  };

  await upsertWithColumnFallback(client, "stores", basePayload, { onConflict: "id" });
}

export async function deleteStoreRecordFromSupabase(storeId: string): Promise<void> {
  const client = getClientOrNull();
  if (!client) return;
  const { error } = await client.from("stores").delete().eq("id", storeId);
  if (error) {
    console.error("[supabase] failed to delete store", storeId, error);
  }
}

export async function upsertEmployeeRecordToSupabase(employee: ConfigEmployeeRecord): Promise<void> {
  const client = getClientOrNull();
  if (!client) return;
  const basePayload: EmployeeInsert = {
    id: employee.id,
    name: employee.name,
    employee_code: employee.employeeCode ?? null,
    phone: employee.phone ?? null,
    regular_day_off: employee.regularDayOff ?? null,
    province: employee.province ?? null,
    region: employee.region ?? null,
    default_store_id: employee.defaultStoreId ?? null,
    created_at: normalizeTimestamp(employee.createdAt),
    updated_at: normalizeTimestamp(employee.updatedAt),
  };

  await upsertWithColumnFallback(client, "employees", basePayload, { onConflict: "id" });
}

export async function deleteEmployeeRecordFromSupabase(employeeId: string): Promise<void> {
  const client = getClientOrNull();
  if (!client) return;
  const { error } = await client.from("employees").delete().eq("id", employeeId);
  if (error) {
    console.error("[supabase] failed to delete employee", employeeId, error);
  }
}

function sanitizeNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function toIsoString(value?: string | null): string {
  if (!value) {
    return new Date().toISOString();
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function mapStoreRow(row: StoreRow): StoreRecord {
  return {
    id: row.id,
    name: row.name,
    province: row.province ?? null,
    address: row.address ?? null,
    latitude: sanitizeNumber(row.latitude),
    longitude: sanitizeNumber(row.longitude),
    radius: sanitizeNumber(row.radius),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapEmployeeRow(row: EmployeeRow): EmployeeRecord {
  return {
    id: row.id,
    name: row.name,
    employeeCode: row.employee_code ?? null,
    phone: row.phone ?? null,
    regularDayOff: row.regular_day_off ?? null,
    province: row.province ?? null,
    region: row.region ?? null,
    defaultStoreId: row.default_store_id ?? null,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export async function listStoresFromSupabase(): Promise<ConfigStoreRecord[] | null> {
  const client = getClientOrNull();
  if (!client) return null;
  const { data, error } = await client
    .from("stores")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.error("[supabase] failed to fetch stores", error);
    return null;
  }
  return (data ?? []).map(mapStoreRow);
}

export async function listEmployeesFromSupabase(): Promise<ConfigEmployeeRecord[] | null> {
  const client = getClientOrNull();
  if (!client) return null;
  const { data, error } = await client
    .from("employees")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.error("[supabase] failed to fetch employees", error);
    return null;
  }
  return (data ?? []).map(mapEmployeeRow);
}
