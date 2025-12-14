import { NextResponse } from "next/server";
import { listEmployeesFromSupabase, listStoresFromSupabase } from "@/lib/supabaseDirectory";
import {
  
  
  
  type StoreRecord,
} from "@/lib/supabaseDirectory";
import { getBranding } from "@/lib/supabaseBranding";
import { fetchSalesSheetRows } from "@/lib/supabaseData";
import {
  expandRangesToIsoDates,
  formatRangeLabel,
  formatRangeSummary,
  normalizeRangesFromParams,
} from "@/lib/reportRangeUtils";
import { listMonthlyTargets } from "@/lib/monthlyTargets";
import ExcelJS from "exceljs";
import { stringify } from "csv-stringify/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_ZONE =
  process.env.GOOGLE_SHEETS_TIMEZONE?.trim() ||
  process.env.APP_TIMEZONE?.trim() ||
  "Asia/Bangkok";

const DATE_LABEL = new Intl.DateTimeFormat("th-TH", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
});

const ISO_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const CURRENCY_FORMATTER = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 2,
});

function getCurrentDateParts() {
  const [year, month, day] = ISO_DAY_FORMATTER.format(new Date()).split("-");
  return {
    year: Number.parseInt(year, 10),
    month: Number.parseInt(month, 10),
    day: Number.parseInt(day, 10),
  };
}

function parseInteger(value: string | null, min: number, max: number) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function padNumber(value: number) {
  return value.toString().padStart(2, "0");
}

function formatCurrency(value: number) {
  return CURRENCY_FORMATTER.format(Number.isFinite(value) ? value : 0).replace("฿", "฿ ");
}

function getZonedDateParts(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00" + getTimeZoneOffset());
  const formatted = ISO_DAY_FORMATTER.format(date);
  const [year, month, day] = formatted.split("-");
  return {
    year: Number.parseInt(year, 10),
    month: Number.parseInt(month, 10),
    day: Number.parseInt(day, 10),
  };
}

function getTimeZoneOffset() {
  // Get timezone offset for Asia/Bangkok (UTC+7)
  return "+07:00";
}

// Parse sales data from Supabase rows
type SalesSheetRow = {
  date: string;         // Column A (index 0)
  time: string;         // Column B (index 1)
  employeeName: string; // Column C (index 2)
  storeName: string;    // Column D (index 3)
  productCode: string;  // Column E (index 4)
  productName: string;  // Column F (index 5)
  quantity: number;     // Column G (index 6)
  unitPrice: number;    // Column H (index 7)
  total: number;        // Column I (index 8)
  // Removed: unitPriceCompany, totalCompany (old index 9-10)
  unitName: string;         // Column J (index 9, was L/11)
  assignmentId: string | null; // Column K (index 10, was M/12)
  unitId: string | null;       // Column L (index 11, was N/13)
  timestamp?: string;          // Column M (index 12, was O/14)
};

type SaleUnitDetail = {
  unitName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  // Removed: unitPriceCompany, totalCompany
};



type DailySaleEntry = {
  timestamp: number;
  time: string;
  storeName: string | null;
  productName: string | null;
  productCode: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unitName: string;
  assignmentId: string | null;
  unitId: string | null;
};

type ProcessedSalesRow = {
  timestamp: number;
  dateIso: string;
  dateLabel: string;
  dayOfWeek: string;
  time: string;
  storeName: string | null;
  productName: string | null;
  productCode: string;
  units: SaleUnitDetail[];
  quantity: number;
  unitPrice: number;
  total: number;
  unitName: string;
  assignmentId: string | null;
  unitId: string | null;
  isFirstOfDay: boolean;
  isEmpty?: boolean;
};

function getDayOfWeekThai(dateIso: string): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayIndex = date.getUTCDay();
  const thaiDays = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  return thaiDays[dayIndex] || "";
}

function parseSalesSheetRow(values: unknown[]): SalesSheetRow | null {
  if (!values || values.length < 13) return null; // Changed from 15 to 13

  const stringValues = values.map((v) => String(v ?? ""));
  const unitName = stringValues[9] || "";       // Changed from 11
  const assignmentId = stringValues[10]?.trim() || ""; // Changed from 12
  const unitId = stringValues[11]?.trim() || ""; // Changed from 13

  return {
    date: stringValues[0] || "",
    time: stringValues[1] || "",
    employeeName: stringValues[2] || "",
    storeName: stringValues[3] || "",
    productCode: stringValues[4] || "",
    productName: stringValues[5] || "",
    quantity: parseFloat(stringValues[6]) || 0,
    unitPrice: parseFloat(stringValues[7]) || 0,
    total: parseFloat(stringValues[8]) || 0,
    // Removed: unitPriceCompany (old index 9), totalCompany (old index 10)
    unitName,
    assignmentId: assignmentId.length > 0 ? assignmentId : null,
    unitId: unitId.length > 0 ? unitId : null,
    timestamp: stringValues[12] || "", // Changed from 14
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    const employeeId = url.searchParams.get("employeeId");
    if (!employeeId) {
      return NextResponse.json(
        { ok: false, message: "กรุณาเลือกพนักงานที่ต้องการออกรายงาน" },
        { status: 400 },
      );
    }

    // Validate format if provided
    if (format && format !== "csv" && format !== "excel") {
      return NextResponse.json(
        { ok: false, message: "รูปแบบไฟล์ไม่ถูกต้อง (รองรับ csv และ excel เท่านั้น)" },
        { status: 400 },
      );
    }

    // Parse groupBy parameter (detail | daily | monthly | quarterly | yearly)
    const groupByParam = url.searchParams.get("groupBy") || "detail";
    const groupBy: "detail" | "daily" | "monthly" | "quarterly" | "yearly" =
      groupByParam === "daily" || groupByParam === "monthly" || groupByParam === "quarterly" || groupByParam === "yearly"
        ? groupByParam
        : "detail";

    const current = getCurrentDateParts();
    const monthParam = parseInteger(url.searchParams.get("month"), 1, 12);
    const yearParam = parseInteger(url.searchParams.get("year"), 2000, 3000);
    const dayParam = url.searchParams.has("day")
      ? parseInteger(url.searchParams.get("day"), 1, 31)
      : null;

    const page = parseInteger(url.searchParams.get("page"), 1, 1000) ?? 1;
    const pageSize = parseInteger(url.searchParams.get("pageSize"), 10, 200) ?? 20;
    const showAllDays = url.searchParams.get("showAllDays") === "true";

    const rangeValues = url.searchParams.getAll("range");
    let ranges = normalizeRangesFromParams(rangeValues, TIME_ZONE);
    if (ranges.length === 0) {
      const year = yearParam ?? current.year;
      const month = monthParam ?? current.month;
      const dayCount = getDaysInMonth(year, month);
      if (dayParam && (dayParam < 1 || dayParam > dayCount)) {
        return NextResponse.json(
          { ok: false, message: "วันที่ที่เลือกไม่อยู่ในช่วงที่กำหนด" },
          { status: 400 },
        );
      }
      let startDay = 1;
      let endDay = dayCount;
      if (dayParam && dayParam >= 1 && dayParam <= dayCount) {
        startDay = dayParam;
        endDay = dayParam;
      }
      const startIso = `${year.toString().padStart(4, "0")}-${padNumber(month)}-${padNumber(startDay)}`;
      const endIso = `${year.toString().padStart(4, "0")}-${padNumber(month)}-${padNumber(endDay)}`;
      const startDate = new Date(Date.UTC(year, month - 1, startDay));
      const endDate = new Date(Date.UTC(year, month - 1, endDay));
      ranges = [
        {
          startIso,
          endIso,
          label: formatRangeLabel(startDate, endDate, TIME_ZONE),
          startDate,
          endDate,
        },
      ];
    }

    const rangeSummary = formatRangeSummary(ranges);
    const isoDates = expandRangesToIsoDates(ranges);
    const isoDateSet = new Set(isoDates);

    const sortedIsoDates = Array.from(isoDateSet).sort();
    const rangeStartIso = sortedIsoDates[0];
    const rangeEndIso = sortedIsoDates[sortedIsoDates.length - 1];
    if (!rangeStartIso || !rangeEndIso) {
      return NextResponse.json(
        { ok: false, message: "ไม่พบวันที่ที่เลือก" },
        { status: 400 },
      );
    }

    // Get effective month from first range for target lookup
    const firstRangeDate = ranges[0].startDate;
    const effectiveMonth = `${firstRangeDate.getUTCFullYear()}-${padNumber(firstRangeDate.getUTCMonth() + 1)}`;

    const [employees, stores, branding, targets] = await Promise.all([
      listEmployeesFromSupabase(),
      listStoresFromSupabase(),
      getBranding(),
      listMonthlyTargets({ month: effectiveMonth }),
    ]);

    const employee = employees?.find((item) => item.id === employeeId);
    if (!employee) {
      return NextResponse.json(
        { ok: false, message: "ไม่พบพนักงานที่ต้องการออกรายงาน" },
        { status: 404 },
      );
    }

    // Get target for this employee
    const targetRecord = targets.find((t) => t.employee_id === employee.id);
    const targetRevenuePC = targetRecord?.target_revenue_pc ?? null;

    const defaultStoreId = employee.defaultStoreId ?? null;
    const storeMapById = new Map(stores?.map((store) => [store.id, store]));
    const storeIdRaw = url.searchParams.get("storeId");
    const hasStoreParam = url.searchParams.has("storeId");
    const explicitStoreId =
      storeIdRaw && storeIdRaw.trim().length > 0 ? storeIdRaw.trim() : null;
    const resolvedStoreId =
      explicitStoreId ?? (!hasStoreParam ? defaultStoreId : null);
    const selectedStore: StoreRecord | null =
      resolvedStoreId && storeMapById.has(resolvedStoreId)
        ? storeMapById.get(resolvedStoreId)!
        : null;
    const storeNameFilter = selectedStore?.name ?? null;

    // Fetch sales data from Supabase once for the requested range
    const dataRows = await fetchSalesSheetRows({
      startDate: rangeStartIso,
      endDate: rangeEndIso,
      employeeName: employee.name,
      storeName: storeNameFilter,
    });

    // Process and filter rows
    const salesByDay = new Map<string, DailySaleEntry[]>();

    if (showAllDays) {
      isoDates.forEach((iso) => {
        salesByDay.set(iso, []);
      });
    }

    // Process sheet data
    dataRows.forEach((row,_rowIndex) => {
      const sheetRow = parseSalesSheetRow(row);
      if (!sheetRow) return;

      // Filter by employee name
      if (sheetRow.employeeName.trim() !== employee.name.trim()) return;

      // Parse date
      if (!sheetRow.date) return;
      const parts = getZonedDateParts(sheetRow.date);
      const isoKey = `${parts.year.toString().padStart(4, "0")}-${padNumber(parts.month)}-${padNumber(parts.day)}`;
      if (!isoDateSet.has(isoKey)) return;

      if (storeNameFilter && sheetRow.storeName !== storeNameFilter) return;

      // Create timestamp for sorting
      const timestamp = new Date(sheetRow.date + "T" + (sheetRow.time || "00:00:00")).getTime();

      // Format time from HH:mm:ss to HH:mm
      const time = sheetRow.time ? sheetRow.time.substring(0, 5) : "";


      // Add to the day's sales
      if (!salesByDay.has(isoKey)) {
        salesByDay.set(isoKey, []);
      }

      salesByDay.get(isoKey)!.push({
        timestamp,
        time,
        storeName: sheetRow.storeName || null,
        productName: sheetRow.productName || null,
        productCode: sheetRow.productCode,
        quantity: sheetRow.quantity,
        unitPrice: sheetRow.unitPrice,
        total: sheetRow.total,
        unitName: sheetRow.unitName,
        assignmentId: sheetRow.assignmentId,
        unitId: sheetRow.unitId,
      });
    });


    // Build final rows with date grouping
    const processedRows: ProcessedSalesRow[] = [];
    const sortedDays = Array.from(salesByDay.keys()).sort();

    // Determine if we should use global groups (for monthly, quarterly, yearly)
    const useGlobalGroups = groupBy === "monthly" || groupBy === "quarterly" || groupBy === "yearly";

    // For monthly grouping, we need to group across all days
    const globalGroups = new Map<string, {
      timestamp: number;
      time: string;
      storeName: string | null;
      productName: string | null;
      productCode: string;
      units: SaleUnitDetail[];
      quantity: number;
      total: number;
      unitPrice: number;
      assignmentId: string | null;
      unitId: string | null;
      dateIso: string; // Track which date this group belongs to for display
    }>();

    const globalOrderedGroups: Array<{
      timestamp: number;
      time: string;
      storeName: string | null;
      productName: string | null;
      productCode: string;
      units: SaleUnitDetail[];
      quantity: number;
      total: number;
      unitPrice: number;
      assignmentId: string | null;
      unitId: string | null;
      dateIso: string;
    }> = [];

    sortedDays.forEach((iso) => {
      const daySales = salesByDay.get(iso)!;
      daySales.sort((a, b) => a.timestamp - b.timestamp);

      const [yearStr, monthStr, dayStr] = iso.split("-");
      const yearNum = Number.parseInt(yearStr, 10);
      const monthNum = Number.parseInt(monthStr, 10);
      const dayNum = Number.parseInt(dayStr, 10);
      const dateForLabel = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
      const dayLabel = DATE_LABEL.format(dateForLabel);

      // For detail and daily modes, create new groups per day
      // For monthly, quarterly, and yearly modes, use global groups across all days
      const groups = useGlobalGroups ? globalGroups : new Map<string, {
        timestamp: number;
        time: string;
        storeName: string | null;
        productName: string | null;
        productCode: string;
        units: SaleUnitDetail[];
        quantity: number;
        total: number;
        unitPrice: number;
        assignmentId: string | null;
        unitId: string | null;
        dateIso?: string;
      }>();

      const orderedGroups = useGlobalGroups ? globalOrderedGroups : [] as Array<{
        timestamp: number;
        time: string;
        storeName: string | null;
        productName: string | null;
        productCode: string;
        units: SaleUnitDetail[];
        quantity: number;
        total: number;
        unitPrice: number;
        assignmentId: string | null;
        unitId: string | null;
        dateIso?: string;
      }>;



      daySales.forEach((sale) => {

        // Create grouping key based on groupBy mode
        let key: string;
        if (groupBy === "detail") {
          // Detail mode: separate by exact timestamp
          key = `${sale.timestamp}|${sale.productCode}|${sale.storeName ?? ''}|${sale.productName ?? ''}`;
        } else if (groupBy === "daily") {
          // Daily mode: group by date (remove timestamp)
          key = `${iso}|${sale.productCode}|${sale.storeName ?? ''}|${sale.productName ?? ''}`;
        } else if (groupBy === "monthly") {
          // Monthly mode: group by year-month
          const yearMonth = iso.substring(0, 7); // Extract YYYY-MM from YYYY-MM-DD
          key = `${yearMonth}|${sale.productCode}|${sale.storeName ?? ''}|${sale.productName ?? ''}`;
        } else if (groupBy === "quarterly") {
          // Quarterly mode: group by year-quarter
          const [yearStr, monthStr] = iso.split("-");
          const month = parseInt(monthStr, 10);
          const quarter = Math.ceil(month / 3); // Q1: 1-3, Q2: 4-6, Q3: 7-9, Q4: 10-12
          const yearQuarter = `${yearStr}-Q${quarter}`;
          key = `${yearQuarter}|${sale.productCode}|${sale.storeName ?? ''}|${sale.productName ?? ''}`;
        } else {
          // Yearly mode: group by year
          const year = iso.substring(0, 4); // Extract YYYY from YYYY-MM-DD
          key = `${year}|${sale.productCode}|${sale.storeName ?? ''}|${sale.productName ?? ''}`;
        }

        let group = groups.get(key);

        if (!group) {

          group = {

            timestamp: sale.timestamp,

            time: groupBy === "detail" ? sale.time : "-",

            storeName: sale.storeName,

            productName: sale.productName,

            productCode: sale.productCode,

            units: [],

            quantity: 0,

            total: 0,

            unitPrice: 0,

            assignmentId: sale.assignmentId,

            unitId: sale.unitId,

            dateIso: iso,

          };

          groups.set(key, group);

          orderedGroups.push(group);

        }



        group.units.push({

          unitName: sale.unitName,

          quantity: sale.quantity,

          unitPrice: sale.unitPrice,

          total: sale.total,

        });

        group.quantity += sale.quantity;

        group.total += sale.total;

        group.unitPrice = group.quantity > 0 ? group.total / group.quantity : 0;

        if (!group.assignmentId) group.assignmentId = sale.assignmentId;

        if (!group.unitId) group.unitId = sale.unitId;

      });



      // For detail and daily modes, push rows immediately
      // For monthly, quarterly, and yearly modes, we'll push after all days are processed
      if (!useGlobalGroups) {
        orderedGroups.forEach((group, _groupIndex) => {

          processedRows.push({

            timestamp: group.timestamp,

            dateIso: iso,

            dateLabel: _groupIndex === 0 ? dayLabel : '',

            dayOfWeek: getDayOfWeekThai(iso),

            time: group.time,

            storeName: group.storeName,
            productName: group.productName,
            productCode: group.productCode,
            units: group.units,
            quantity: group.quantity,
            unitPrice: group.unitPrice,
            total: group.total,
            unitName: group.units[0]?.unitName || "",
            assignmentId: group.assignmentId,
            unitId: group.unitId,
            isFirstOfDay: _groupIndex === 0,
          });

        });
      }

      if (daySales.length === 0 && showAllDays && !useGlobalGroups) {
        processedRows.push({
          timestamp: dateForLabel.getTime(),
          dateIso: iso,
          dateLabel: dayLabel,
          dayOfWeek: getDayOfWeekThai(iso),
          time: "",
          storeName: null,
          productName: null,
          productCode: "",
          units: [],
          quantity: 0,
          unitPrice: 0,
          total: 0,
          unitName: "",
          assignmentId: null,
          unitId: null,
          isFirstOfDay: true,
          isEmpty: true,
        });
      }
    });

    // For monthly, quarterly, and yearly modes, push all grouped results after processing all days
    if (useGlobalGroups) {
      let previousPeriod = "";

      globalOrderedGroups.forEach((group, _groupIndex) => {
        // Get the first dateIso from the group (or use the stored dateIso)
        const groupDateIso = group.dateIso || sortedDays[0] || "";
        const [yearStr, monthStr] = groupDateIso.split("-");

        let currentPeriod = "";
        let periodLabel = "";

        if (groupBy === "monthly") {
          currentPeriod = `${yearStr}-${monthStr}`;
          const monthDate = new Date(Date.UTC(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1));
          periodLabel = new Intl.DateTimeFormat("th-TH", {
            timeZone: TIME_ZONE,
            year: "numeric",
            month: "short",
          }).format(monthDate);
        } else if (groupBy === "quarterly") {
          const month = parseInt(monthStr, 10);
          const quarter = Math.ceil(month / 3);
          currentPeriod = `${yearStr}-Q${quarter}`;
          periodLabel = `ไตรมาส ${quarter} ${yearStr}`;
        } else if (groupBy === "yearly") {
          currentPeriod = yearStr;
          periodLabel = `ปี ${yearStr}`;
        }

        // Show period label when period changes
        const isFirstOfPeriod = currentPeriod !== previousPeriod;
        previousPeriod = currentPeriod;

        processedRows.push({
          timestamp: group.timestamp,
          dateIso: groupDateIso,
          dateLabel: isFirstOfPeriod ? periodLabel : '',
          dayOfWeek: "",
          time: group.time,
          storeName: group.storeName,
          productName: group.productName,
          productCode: group.productCode,
          units: group.units,
          quantity: group.quantity,
          unitPrice: group.unitPrice,
          total: group.total,
          unitName: group.units[0]?.unitName || "",
          assignmentId: group.assignmentId,
          unitId: group.unitId,
          isFirstOfDay: isFirstOfPeriod,
        });
      });
    }

    // Calculate totals before pagination
    const totals = processedRows.reduce(
      (acc, row) => {
        acc.quantity += row.quantity;
        acc.amount += row.total;
        return acc;
      },
      { quantity: 0, amount: 0 },
    );

    // Calculate achievement percentage
    const achievementPercent = targetRevenuePC && targetRevenuePC > 0
      ? (totals.amount / targetRevenuePC) * 100
      : null;

    // Calculate unit breakdown totals before pagination
    const unitTotals = {
      box: { quantity: 0, totalPc: 0 },
      pack: { quantity: 0, totalPc: 0 },
      piece: { quantity: 0, totalPc: 0 },
    };

    processedRows.forEach((row) => {
      if (row.units) {
        row.units.forEach((unit) => {
          const unitNameLower = unit.unitName.toLowerCase().trim();

          if (unitNameLower.includes('กล่อง') || unitNameLower.includes('box') || unitNameLower.includes('ลัง')) {
            unitTotals.box.quantity += unit.quantity;
            unitTotals.box.totalPc += unit.total;
          } else if (unitNameLower.includes('แพ็ค') || unitNameLower.includes('pack') || unitNameLower.includes('แพค')) {
            unitTotals.pack.quantity += unit.quantity;
            unitTotals.pack.totalPc += unit.total;
          } else if (unitNameLower.includes('ปี๊บ') || unitNameLower.includes('ซอง') || unitNameLower.includes('ชิ้น') ||
                     unitNameLower.includes('piece') || unitNameLower.includes('bottle')) {
            unitTotals.piece.quantity += unit.quantity;
            unitTotals.piece.totalPc += unit.total;
          }
        });
      }
    });

    // Apply pagination
    const totalRows = processedRows.length;
    const totalPages = totalRows > 0 ? Math.ceil(totalRows / pageSize) : 1;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedRows = processedRows.slice(startIndex, endIndex);

    // Handle export formats
    if (format === "csv" || format === "excel") {
      // Prepare export rows (flatten units for export)
      const exportRows = processedRows.flatMap((row) => {
        if (row.units.length === 0) {
          // Empty row for days with no sales
          return [{
            date: row.dateLabel,
            time: row.time,
            store: row.storeName || "",
            productCode: row.productCode,
            productName: row.productName || "",
            unit: row.unitName,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            totalPrice: row.total,
          }];
        }

        // Create one row per unit
        return row.units.map((unit) => ({
          date: row.dateLabel,
          time: row.time,
          store: row.storeName || "",
          productCode: row.productCode,
          productName: row.productName || "",
          unit: unit.unitName,
          quantity: unit.quantity,
          unitPrice: unit.unitPrice,
          totalPrice: unit.total,
        }));
      });

      const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
      const fileBaseName = `sales-report-${employee.name}-${timestamp}`;

      if (format === "excel") {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("รายงานการขาย");

        // Define columns
        worksheet.columns = [
          { header: "วันที่", key: "date", width: 15 },
          { header: "เวลา", key: "time", width: 10 },
          { header: "ร้าน", key: "store", width: 25 },
          { header: "รหัสสินค้า", key: "productCode", width: 15 },
          { header: "ชื่อสินค้า", key: "productName", width: 30 },
          { header: "หน่วย", key: "unit", width: 15 },
          { header: "จำนวน", key: "quantity", width: 10 },
          { header: "ราคาต่อหน่วย", key: "unitPrice", width: 15 },
          { header: "ราคารวม", key: "totalPrice", width: 15 },
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };

        // Add data rows
        for (const row of exportRows) {
          worksheet.addRow({
            date: row.date,
            time: row.time,
            store: row.store,
            productCode: row.productCode,
            productName: row.productName,
            unit: row.unit,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            totalPrice: row.totalPrice,
          });
        }

        // Add totals row
        const totalsRow = worksheet.addRow({
          date: "รวมทั้งหมด",
          time: "",
          store: "",
          productCode: "",
          productName: "",
          unit: "",
          quantity: totals.quantity,
          unitPrice: "",
          totalPrice: totals.amount,
        });
        totalsRow.font = { bold: true };

        const buffer = await workbook.xlsx.writeBuffer();
        const filename = `${fileBaseName}.xlsx`;

        return new Response(buffer, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      } else {
        // CSV format
        const csvRows: Array<{
          "วันที่": string;
          "เวลา": string;
          "ร้าน": string;
          "รหัสสินค้า": string;
          "ชื่อสินค้า": string;
          "หน่วย": string;
          "จำนวน": number | string;
          "ราคาต่อหน่วย": number | string;
          "ราคารวม": number | string;
        }> = exportRows.map((row) => ({
          "วันที่": row.date,
          "เวลา": row.time,
          "ร้าน": row.store,
          "รหัสสินค้า": row.productCode,
          "ชื่อสินค้า": row.productName,
          "หน่วย": row.unit,
          "จำนวน": row.quantity,
          "ราคาต่อหน่วย": row.unitPrice,
          "ราคารวม": row.totalPrice,
        }));

        // Add totals row
        csvRows.push({
          "วันที่": "รวมทั้งหมด",
          "เวลา": "",
          "ร้าน": "",
          "รหัสสินค้า": "",
          "ชื่อสินค้า": "",
          "หน่วย": "",
          "จำนวน": totals.quantity,
          "ราคาต่อหน่วย": "",
          "ราคารวม": totals.amount,
        });

        const csv = stringify(csvRows, {
          header: true,
          bom: true,
        });

        const csvWithBom = "\uFEFF" + csv;
        const filename = `${fileBaseName}.csv`;

        return new Response(csvWithBom, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        employee: {
          id: employee.id,
          name: employee.name,
          phone: employee.phone ?? null,
          province: employee.province ?? null,
          region: employee.region ?? null,
          defaultStoreId,
        },
        store: selectedStore
          ? {
              id: selectedStore.id,
              name: selectedStore.name,
              province: selectedStore.province ?? null,
            }
          : null,
        branding: {
          logoPath: branding.logoPath,
          updatedAt: branding.updatedAt,
        },
        filters: {
          storeId: selectedStore?.id ?? null,
          showAllDays,
          ranges: ranges.map((range) => ({
            startIso: range.startIso,
            endIso: range.endIso,
            label: range.label,
          })),
          rangeSummary,
        },
        rows: paginatedRows,
        totals: {
          quantity: totals.quantity,
          amount: totals.amount,
          amountDisplay: formatCurrency(totals.amount),
          targetRevenuePC: targetRevenuePC,
          targetRevenuePCDisplay: targetRevenuePC ? formatCurrency(targetRevenuePC) : null,
          achievementPercent: achievementPercent ? Math.round(achievementPercent * 10) / 10 : null,
        },
        unitTotals: {
          box: {
            quantity: unitTotals.box.quantity,
            totalPc: unitTotals.box.totalPc,
          },
          pack: {
            quantity: unitTotals.pack.quantity,
            totalPc: unitTotals.pack.totalPc,
          },
          piece: {
            quantity: unitTotals.piece.quantity,
            totalPc: unitTotals.piece.totalPc,
          },
        },
        pagination: {
          page,
          pageSize,
          totalRows,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("[reports] sales report error", error);
    return NextResponse.json(
      { ok: false, message: "ไม่สามารถสร้างรายงานได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}
