import { NextResponse } from "next/server";
import { listEmployeesFromSupabase, listStoresFromSupabase } from "@/lib/supabaseDirectory";
import {
  
  
  
} from "@/lib/supabaseDirectory";
import { getBranding } from "@/lib/supabaseBranding";
import { fetchAttendanceSheetRows, fetchSalesSheetRows } from "@/lib/supabaseData";
import {
  expandRangesToIsoDates,
  formatRangeSummary,
  normalizeRangesFromParams,
} from "@/lib/reportRangeUtils";
import { listMonthlyTargets } from "@/lib/monthlyTargets";
import { promises as fs } from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { stringify } from "csv-stringify/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_ZONE =
  process.env.GOOGLE_SHEETS_TIMEZONE?.trim() ||
  process.env.APP_TIMEZONE?.trim() ||
  "Asia/Bangkok";

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
  const date = new Date(dateStr + "T00:00:00+07:00");
  const formatted = ISO_DAY_FORMATTER.format(date);
  const [year, month, day] = formatted.split("-");
  return {
    year: Number.parseInt(year, 10),
    month: Number.parseInt(month, 10),
    day: Number.parseInt(day, 10),
  };
}

type AttendanceSheetRow = {
  date: string;
  time: string;
  status: string;
  employeeName: string;
};

type SalesSheetRow = {
  date: string;
  time: string;
  employeeName: string;
  storeName: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type ExpenseRecord = {
  id: string;
  employeeId: string;
  name: string;
  baseline: number;
  effectiveMonth: string;
  items?: Array<{
    id: string;
    label: string;
    amount: number;
  }>;
};

type ExpenseDetail = {
  baselineExpenses: number;
  dailyAllowance: number;
  daysWithFullAttendance: number;
  items: Array<{
    label: string;
    amount: number;
  }>;
  total: number;
};

type EmployeeSummary = {
  employeeId: string;
  employeeName: string;
  storeName: string | null;
  workingDays: number;
  workingHours: number;
  totalSales: number;
  targetRevenuePC: number | null;
  achievementPercent: number | null;
  monthlyExpenses: number;
  expenseDetail: ExpenseDetail;
  netIncome: number;
  avgIncomePerDay: number;
  avgIncomePerHour: number;
};

function parseAttendanceSheetRow(values: unknown[]): AttendanceSheetRow | null {
  if (!values || values.length < 4) return null;

  const stringValues = values.map(v => String(v || ""));

  return {
    date: stringValues[0] || "",
    time: stringValues[1] || "",
    status: stringValues[2] || "",
    employeeName: stringValues[3] || "",
  };
}

function parseSalesSheetRow(values: unknown[]): SalesSheetRow | null {
  if (!values || values.length < 9) return null;

  const stringValues = values.map(v => String(v || ""));

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
  };
}

async function getExpenses(): Promise<ExpenseRecord[]> {
  try {
    const expensesPath = path.join(process.cwd(), "data", "expenses.json");
    const expensesData = await fs.readFile(expensesPath, "utf-8");
    return JSON.parse(expensesData) as ExpenseRecord[];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    const searchQuery = url.searchParams.get("search")?.trim().toLowerCase() || null;

    // Validate format if provided
    if (format && format !== "csv" && format !== "excel") {
      return NextResponse.json(
        { ok: false, message: "รูปแบบไฟล์ไม่ถูกต้อง (รองรับ csv และ excel เท่านั้น)" },
        { status: 400 },
      );
    }

    const current = getCurrentDateParts();
    const rangeValues = url.searchParams.getAll("range");
    let ranges = normalizeRangesFromParams(rangeValues, TIME_ZONE);

    // Default to current month if no ranges specified
    if (ranges.length === 0) {
      const year = current.year;
      const month = current.month;
      const dayCount = getDaysInMonth(year, month);
      const startIso = `${year.toString().padStart(4, "0")}-${padNumber(month)}-01`;
      const endIso = `${year.toString().padStart(4, "0")}-${padNumber(month)}-${padNumber(dayCount)}`;
      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate = new Date(Date.UTC(year, month - 1, dayCount));
      ranges = [
        {
          startIso,
          endIso,
          label: `${month}/${year}`,
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

    // Get effective month from first range for expense lookup
    const firstRangeDate = ranges[0].startDate;
    const effectiveMonth = `${firstRangeDate.getUTCFullYear()}-${padNumber(firstRangeDate.getUTCMonth() + 1)}`;

    const [
      employees,
      stores,
      branding,
      expenses,
      targets,
      attendanceRows,
      salesRows,
    ] = await Promise.all([
      listEmployeesFromSupabase(),
      listStoresFromSupabase(),
      getBranding(),
      getExpenses(),
      listMonthlyTargets({ month: effectiveMonth }),
      fetchAttendanceSheetRows({
        startDate: rangeStartIso,
        endDate: rangeEndIso,
      }),
      fetchSalesSheetRows({
        startDate: rangeStartIso,
        endDate: rangeEndIso,
      }),
    ]);
    // Filter employees by search query
    const filteredEmployees = searchQuery
      ? employees?.filter((emp) => emp.name.toLowerCase().includes(searchQuery))
      : employees;

    const attendanceData = attendanceRows;
    const salesData = salesRows;

    // Create expense lookup map (by employeeId and effective month)
    const expenseMap = new Map<string, ExpenseRecord>();
    expenses.forEach((expense) => {
      if (expense.effectiveMonth === effectiveMonth) {
        expenseMap.set(expense.employeeId, expense);
      }
    });

    // Create target lookup map (by employeeId)
    const targetMap = new Map<string, typeof targets[0]>();
    targets.forEach((target) => {
      targetMap.set(target.employee_id, target);
    });

    // Create store lookup map
    const storeMap = new Map(stores?.map((store) => [store.id, store.name]));

    // Process data for each employee
    const summaries: EmployeeSummary[] = [];

    filteredEmployees?.forEach((employee) => {
      // Calculate working days and hours from attendance
      const employeeAttendance = new Map<string, { checkIn: Date | null; checkOut: Date | null }>();

      attendanceData.forEach((row) => {
        const attendance = parseAttendanceSheetRow(row);
        if (!attendance || attendance.employeeName.trim() !== employee.name.trim()) return;

        if (!attendance.date) return;
        const parts = getZonedDateParts(attendance.date);
        const isoKey = `${parts.year.toString().padStart(4, "0")}-${padNumber(parts.month)}-${padNumber(parts.day)}`;
        if (!isoDateSet.has(isoKey)) return;

        const timestamp = new Date(attendance.date + "T" + (attendance.time || "00:00:00"));

        if (!employeeAttendance.has(isoKey)) {
          employeeAttendance.set(isoKey, { checkIn: null, checkOut: null });
        }

        const dayRecord = employeeAttendance.get(isoKey)!;
        if (attendance.status.toLowerCase().includes("check-in") || attendance.status.toLowerCase().includes("เข้า")) {
          if (!dayRecord.checkIn || timestamp < dayRecord.checkIn) {
            dayRecord.checkIn = timestamp;
          }
        } else if (attendance.status.toLowerCase().includes("check-out") || attendance.status.toLowerCase().includes("ออก")) {
          if (!dayRecord.checkOut || timestamp > dayRecord.checkOut) {
            dayRecord.checkOut = timestamp;
          }
        }
      });

      // Calculate working days and total hours
      let workingDays = 0;
      let totalHours = 0;
      let daysWithFullAttendance = 0; // วันที่มีทั้ง check-in และ check-out ครบ

      employeeAttendance.forEach((record) => {
        if (record.checkIn) {
          workingDays++;
        }
        if (record.checkIn && record.checkOut) {
          daysWithFullAttendance++; // นับวันที่มีทั้ง check-in และ check-out
          const hours = (record.checkOut.getTime() - record.checkIn.getTime()) / (1000 * 60 * 60);
          if (hours > 0 && hours < 24) {
            totalHours += hours;
          }
        }
      });

      // Calculate total sales
      let totalSales = 0;
      salesData.forEach((row) => {
        const sale = parseSalesSheetRow(row);
        if (!sale || sale.employeeName.trim() !== employee.name.trim()) return;

        if (!sale.date) return;
        const parts = getZonedDateParts(sale.date);
        const isoKey = `${parts.year.toString().padStart(4, "0")}-${padNumber(parts.month)}-${padNumber(parts.day)}`;
        if (!isoDateSet.has(isoKey)) return;

        totalSales += sale.total;
      });

      // Get monthly expenses
      const expenseRecord = expenseMap.get(employee.id);
      const baselineExpenses = expenseRecord?.baseline || 0;
      const expenseItems = expenseRecord?.items || [];

      // Calculate daily allowance (เบี้ยเลี้ยง)
      const DAILY_ALLOWANCE_RATE = 150; // 150 บาทต่อวัน
      const dailyAllowance = DAILY_ALLOWANCE_RATE * daysWithFullAttendance;

      // Total monthly expenses = baseline + daily allowance
      const monthlyExpenses = baselineExpenses + dailyAllowance;

      // Create expense detail for tooltip
      const expenseDetail: ExpenseDetail = {
        baselineExpenses,
        dailyAllowance,
        daysWithFullAttendance,
        items: expenseItems.map((item) => ({
          label: item.label,
          amount: item.amount,
        })),
        total: monthlyExpenses,
      };

      // Get target for this employee
      const targetRecord = targetMap.get(employee.id);
      const targetRevenuePC = targetRecord?.target_revenue_pc ?? null;
      const achievementPercent = targetRevenuePC && targetRevenuePC > 0
        ? (totalSales / targetRevenuePC) * 100
        : null;

      // Calculate net income and averages
      const netIncome = totalSales - monthlyExpenses;
      const avgIncomePerDay = workingDays > 0 ? netIncome / workingDays : 0;
      const avgIncomePerHour = totalHours > 0 ? netIncome / totalHours : 0;

      summaries.push({
        employeeId: employee.id,
        employeeName: employee.name,
        storeName: employee.defaultStoreId ? (storeMap.get(employee.defaultStoreId) ?? null) : null,
        workingDays,
        workingHours: Math.round(totalHours * 10) / 10,
        totalSales,
        targetRevenuePC,
        achievementPercent: achievementPercent ? Math.round(achievementPercent * 10) / 10 : null,
        monthlyExpenses,
        expenseDetail,
        netIncome,
        avgIncomePerDay,
        avgIncomePerHour,
      });
    });

    // Sort by employee name
    summaries.sort((a, b) => a.employeeName.localeCompare(b.employeeName, "th"));

    // Calculate grand totals
    const totals = summaries.reduce(
      (acc, summary) => {
        acc.workingDays += summary.workingDays;
        acc.workingHours += summary.workingHours;
        acc.totalSales += summary.totalSales;
        acc.monthlyExpenses += summary.monthlyExpenses;
        acc.netIncome += summary.netIncome;
        return acc;
      },
      { workingDays: 0, workingHours: 0, totalSales: 0, monthlyExpenses: 0, netIncome: 0 },
    );

    // Handle export formats
    if (format === "csv" || format === "excel") {
      const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
      const fileBaseName = `individual-report-${timestamp}`;

      if (format === "excel") {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("รายงานผลงานรายบุคคล");

        // Define columns
        worksheet.columns = [
          { header: "ชื่อพนักงาน", key: "employeeName", width: 25 },
          { header: "ร้าน", key: "storeName", width: 25 },
          { header: "จำนวนวันทำงาน", key: "workingDays", width: 15 },
          { header: "ชั่วโมงทำงาน", key: "workingHours", width: 15 },
          { header: "ยอดขายรวม", key: "totalSales", width: 15 },
          { header: "เป้าหมาย", key: "targetRevenuePC", width: 15 },
          { header: "บรรลุเป้า (%)", key: "achievementPercent", width: 15 },
          { header: "ค่าใช้จ่ายรวม", key: "monthlyExpenses", width: 15 },
          { header: "รายได้สุทธิ", key: "netIncome", width: 15 },
          { header: "รายได้เฉลี่ยต่อวัน", key: "avgIncomePerDay", width: 18 },
          { header: "รายได้เฉลี่ยต่อชั่วโมง", key: "avgIncomePerHour", width: 20 },
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };

        // Add data rows
        for (const summary of summaries) {
          worksheet.addRow({
            employeeName: summary.employeeName,
            storeName: summary.storeName || "",
            workingDays: summary.workingDays,
            workingHours: summary.workingHours,
            totalSales: summary.totalSales,
            targetRevenuePC: summary.targetRevenuePC ?? "",
            achievementPercent: summary.achievementPercent ?? "",
            monthlyExpenses: summary.monthlyExpenses,
            netIncome: summary.netIncome,
            avgIncomePerDay: summary.avgIncomePerDay,
            avgIncomePerHour: summary.avgIncomePerHour,
          });
        }

        // Add totals row
        const totalsRow = worksheet.addRow({
          employeeName: "รวมทั้งหมด",
          storeName: "",
          workingDays: totals.workingDays,
          workingHours: Math.round(totals.workingHours * 10) / 10,
          totalSales: totals.totalSales,
          monthlyExpenses: totals.monthlyExpenses,
          netIncome: totals.netIncome,
          avgIncomePerDay: summaries.length > 0 ? totals.netIncome / totals.workingDays : 0,
          avgIncomePerHour: summaries.length > 0 ? totals.netIncome / totals.workingHours : 0,
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
        const csvRows = summaries.map((summary) => ({
          "ชื่อพนักงาน": summary.employeeName,
          "ร้าน": summary.storeName || "",
          "จำนวนวันทำงาน": summary.workingDays,
          "ชั่วโมงทำงาน": summary.workingHours,
          "ยอดขายรวม": summary.totalSales,
          "เป้าหมาย": summary.targetRevenuePC ?? "",
          "บรรลุเป้า (%)": summary.achievementPercent ?? "",
          "ค่าใช้จ่ายรวม": summary.monthlyExpenses,
          "รายได้สุทธิ": summary.netIncome,
          "รายได้เฉลี่ยต่อวัน": summary.avgIncomePerDay,
          "รายได้เฉลี่ยต่อชั่วโมง": summary.avgIncomePerHour,
        }));

        // Add totals row
        csvRows.push({
          "ชื่อพนักงาน": "รวมทั้งหมด",
          "ร้าน": "",
          "จำนวนวันทำงาน": totals.workingDays,
          "ชั่วโมงทำงาน": Math.round(totals.workingHours * 10) / 10,
          "ยอดขายรวม": totals.totalSales,
          "เป้าหมาย": "",
          "บรรลุเป้า (%)": "",
          "ค่าใช้จ่ายรวม": totals.monthlyExpenses,
          "รายได้สุทธิ": totals.netIncome,
          "รายได้เฉลี่ยต่อวัน": summaries.length > 0 ? totals.netIncome / totals.workingDays : 0,
          "รายได้เฉลี่ยต่อชั่วโมง": summaries.length > 0 ? totals.netIncome / totals.workingHours : 0,
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
        branding: {
          logoPath: branding.logoPath,
          updatedAt: branding.updatedAt,
        },
        filters: {
          search: searchQuery,
          ranges: ranges.map((range) => ({
            startIso: range.startIso,
            endIso: range.endIso,
            label: range.label,
          })),
          rangeSummary,
          effectiveMonth,
        },
        rows: summaries,
        totals: {
          workingDays: totals.workingDays,
          workingHours: Math.round(totals.workingHours * 10) / 10,
          totalSales: totals.totalSales,
          totalSalesDisplay: formatCurrency(totals.totalSales),
          monthlyExpenses: totals.monthlyExpenses,
          monthlyExpensesDisplay: formatCurrency(totals.monthlyExpenses),
          netIncome: totals.netIncome,
          netIncomeDisplay: formatCurrency(totals.netIncome),
          avgIncomePerDay: summaries.length > 0 ? totals.netIncome / totals.workingDays : 0,
          avgIncomePerDayDisplay: summaries.length > 0 ? formatCurrency(totals.netIncome / totals.workingDays) : formatCurrency(0),
          avgIncomePerHour: summaries.length > 0 ? totals.netIncome / totals.workingHours : 0,
          avgIncomePerHourDisplay: summaries.length > 0 ? formatCurrency(totals.netIncome / totals.workingHours) : formatCurrency(0),
        },
      },
    });
  } catch (error) {
    console.error("[reports] individual summary report error", error);
    return NextResponse.json(
      { ok: false, message: "ไม่สามารถสร้างรายงานได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}
