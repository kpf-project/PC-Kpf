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

function padNumber(value: number) {
  return value.toString().padStart(2, "0");
}

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

type ProductSale = {
  productName: string;
  quantity: number;
  revenue: number;
  estimatedProfit: number;
};

type DailySale = {
  date: string;
  sales: number;
  profit: number;
  expenses: number;
};

type RoiData = {
  employee: {
    id: string;
    name: string;
    region: string | null;
    phone: string | null;
  };
  period: {
    startIso: string;
    endIso: string;
    label: string;
  };
  kpi: {
    totalSales: number;
    totalExpenses: number;
    netProfit: number;
    roi: number;
    roiPercentage: number;
  };
  workEfficiency: {
    totalHours: number;
    workingDays: number;
    avgRevenuePerDay: number;
    avgRevenuePerHour: number;
  };
  expenseBreakdown: Array<{
    label: string;
    amount: number;
    percentage: number;
  }>;
  topProducts: ProductSale[];
  dailyTrend: DailySale[];
  expenseRatio: number;
  revenuePerExpense: number;
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
    const employeeId = url.searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json(
        { ok: false, message: "กรุณาเลือกพนักงาน" },
        { status: 400 }
      );
    }

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

    // Get effective month from first range
    const firstRangeDate = ranges[0].startDate;
    const effectiveMonth = `${firstRangeDate.getUTCFullYear()}-${padNumber(firstRangeDate.getUTCMonth() + 1)}`;

    const [employees, , branding, expenses] = await Promise.all([
      listEmployeesFromSupabase(),
      listStoresFromSupabase(),
      getBranding(),
      getExpenses(),
    ]);

    const employee = employees?.find((emp) => emp.id === employeeId);
    if (!employee) {
      return NextResponse.json(
        { ok: false, message: "ไม่พบข้อมูลพนักงาน" },
        { status: 404 }
      );
    }

    const [attendanceRows, salesRows] = await Promise.all([
      fetchAttendanceSheetRows({
        startDate: rangeStartIso,
        endDate: rangeEndIso,
        employeeName: employee.name,
      }),
      fetchSalesSheetRows({
        startDate: rangeStartIso,
        endDate: rangeEndIso,
        employeeName: employee.name,
      }),
    ]);

    const attendanceData = attendanceRows;
    const salesData = salesRows;

    // Calculate working hours and days
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

    // Calculate working days and hours
    let workingDays = 0;
    let totalHours = 0;
    let daysWithFullAttendance = 0;

    employeeAttendance.forEach((record) => {
      if (record.checkIn) {
        workingDays++;
      }
      if (record.checkIn && record.checkOut) {
        daysWithFullAttendance++;
        const hours = (record.checkOut.getTime() - record.checkIn.getTime()) / (1000 * 60 * 60);
        if (hours > 0 && hours < 24) {
          totalHours += hours;
        }
      }
    });

    // Calculate sales data
    let totalSales = 0;
    const productSales = new Map<string, ProductSale>();
    const dailySales = new Map<string, DailySale>();

    salesData.forEach((row) => {
      const sale = parseSalesSheetRow(row);
      if (!sale || sale.employeeName.trim() !== employee.name.trim()) return;
      if (!sale.date) return;

      const parts = getZonedDateParts(sale.date);
      const isoKey = `${parts.year.toString().padStart(4, "0")}-${padNumber(parts.month)}-${padNumber(parts.day)}`;
      if (!isoDateSet.has(isoKey)) return;

      totalSales += sale.total;

      // Aggregate product sales
      const existing = productSales.get(sale.productName) || {
        productName: sale.productName,
        quantity: 0,
        revenue: 0,
        estimatedProfit: 0,
      };
      existing.quantity += sale.quantity;
      existing.revenue += sale.total;
      existing.estimatedProfit += sale.total * 0.3; // Assume 30% profit margin
      productSales.set(sale.productName, existing);

      // Aggregate daily sales
      const dailyExisting = dailySales.get(isoKey) || {
        date: isoKey,
        sales: 0,
        profit: 0,
        expenses: 0,
      };
      dailyExisting.sales += sale.total;
      dailyExisting.profit += sale.total * 0.3;
      dailySales.set(isoKey, dailyExisting);
    });

    // Calculate expenses
    const expenseRecord = expenses.find(
      (exp) => exp.employeeId === employeeId && exp.effectiveMonth === effectiveMonth
    );
    const baselineExpenses = expenseRecord?.baseline || 0;
    const expenseItems = expenseRecord?.items || [];

    const DAILY_ALLOWANCE_RATE = 150;
    const dailyAllowance = DAILY_ALLOWANCE_RATE * daysWithFullAttendance;
    const totalExpenses = baselineExpenses + dailyAllowance;

    // Build expense breakdown
    const expenseBreakdown: Array<{ label: string; amount: number; percentage: number }> = [];

    expenseItems.forEach((item) => {
      expenseBreakdown.push({
        label: item.label,
        amount: item.amount,
        percentage: totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0,
      });
    });

    if (dailyAllowance > 0) {
      expenseBreakdown.push({
        label: `เบี้ยเลี้ยง (${daysWithFullAttendance} วัน)`,
        amount: dailyAllowance,
        percentage: totalExpenses > 0 ? (dailyAllowance / totalExpenses) * 100 : 0,
      });
    }

    // Sort expense breakdown by amount descending
    expenseBreakdown.sort((a, b) => b.amount - a.amount);

    // Calculate KPIs
    const netProfit = totalSales - totalExpenses;
    const roi = totalExpenses > 0 ? netProfit / totalExpenses : 0;
    const roiPercentage = roi * 100;
    const expenseRatio = totalSales > 0 ? (totalExpenses / totalSales) * 100 : 0;
    const revenuePerExpense = totalExpenses > 0 ? totalSales / totalExpenses : 0;

    // Get top 5 products
    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Build daily trend array
    const dailyTrend = Array.from(dailySales.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Add daily expense allocation
    const dailyExpenseAllocation = totalExpenses / (workingDays || 1);
    dailyTrend.forEach((day) => {
      day.expenses = dailyExpenseAllocation;
    });

    const roiData: RoiData = {
      employee: {
        id: employee.id,
        name: employee.name,
        region: employee.region || null,
        phone: employee.phone || null,
      },
      period: {
        startIso: ranges[0].startIso,
        endIso: ranges[0].endIso,
        label: rangeSummary,
      },
      kpi: {
        totalSales,
        totalExpenses,
        netProfit,
        roi,
        roiPercentage,
      },
      workEfficiency: {
        totalHours: Math.round(totalHours * 10) / 10,
        workingDays,
        avgRevenuePerDay: workingDays > 0 ? totalSales / workingDays : 0,
        avgRevenuePerHour: totalHours > 0 ? totalSales / totalHours : 0,
      },
      expenseBreakdown,
      topProducts,
      dailyTrend,
      expenseRatio,
      revenuePerExpense,
    };

    // Handle export formats
    if (format === "csv" || format === "excel") {
      const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
      const fileBaseName = `roi-report-${employee.name}-${timestamp}`;

      if (format === "excel") {
        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Daily Trend
        const dailySheet = workbook.addWorksheet("แนวโน้มรายวัน");
        dailySheet.columns = [
          { header: "วันที่", key: "date", width: 15 },
          { header: "ยอดขาย", key: "sales", width: 15 },
          { header: "กำไร", key: "profit", width: 15 },
          { header: "ค่าใช้จ่าย", key: "expenses", width: 15 },
        ];
        dailySheet.getRow(1).font = { bold: true };
        dailySheet.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
        for (const day of dailyTrend) {
          dailySheet.addRow({
            date: day.date,
            sales: day.sales,
            profit: day.profit,
            expenses: day.expenses,
          });
        }

        // Sheet 2: Top Products
        const productsSheet = workbook.addWorksheet("สินค้าขายดี");
        productsSheet.columns = [
          { header: "ชื่อสินค้า", key: "productName", width: 30 },
          { header: "จำนวน", key: "quantity", width: 12 },
          { header: "ยอดขาย", key: "revenue", width: 15 },
          { header: "กำไร", key: "profit", width: 15 },
        ];
        productsSheet.getRow(1).font = { bold: true };
        productsSheet.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
        for (const product of topProducts) {
          productsSheet.addRow({
            productName: product.productName,
            quantity: product.quantity,
            revenue: product.revenue,
            profit: product.estimatedProfit,
          });
        }

        // Sheet 3: Expense Breakdown
        const expenseSheet = workbook.addWorksheet("รายละเอียดค่าใช้จ่าย");
        expenseSheet.columns = [
          { header: "รายการ", key: "label", width: 30 },
          { header: "จำนวนเงิน", key: "amount", width: 15 },
          { header: "%", key: "percentage", width: 10 },
        ];
        expenseSheet.getRow(1).font = { bold: true };
        expenseSheet.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
        for (const expense of expenseBreakdown) {
          expenseSheet.addRow({
            label: expense.label,
            amount: expense.amount,
            percentage: expense.percentage.toFixed(2),
          });
        }

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
        // CSV format - export daily trend as primary data
        const csvRows: Array<{
          "วันที่": string;
          "ยอดขาย": number | string;
          "กำไร": number | string;
          "ค่าใช้จ่าย": number | string;
        }> = dailyTrend.map((day) => ({
          "วันที่": day.date,
          "ยอดขาย": day.sales,
          "กำไร": day.profit,
          "ค่าใช้จ่าย": day.expenses,
        }));

        // Add separator and top products section
        csvRows.push({
          "วันที่": "",
          "ยอดขาย": "",
          "กำไร": "",
          "ค่าใช้จ่าย": "",
        });
        csvRows.push({
          "วันที่": "สินค้าขายดี",
          "ยอดขาย": "",
          "กำไร": "",
          "ค่าใช้จ่าย": "",
        });

        for (const product of topProducts) {
          csvRows.push({
            "วันที่": product.productName,
            "ยอดขาย": product.revenue.toString(),
            "กำไร": product.estimatedProfit.toString(),
            "ค่าใช้จ่าย": product.quantity.toString(),
          });
        }

        // Add separator and expense breakdown
        csvRows.push({
          "วันที่": "",
          "ยอดขาย": "",
          "กำไร": "",
          "ค่าใช้จ่าย": "",
        });
        csvRows.push({
          "วันที่": "รายละเอียดค่าใช้จ่าย",
          "ยอดขาย": "",
          "กำไร": "",
          "ค่าใช้จ่าย": "",
        });

        for (const expense of expenseBreakdown) {
          csvRows.push({
            "วันที่": expense.label,
            "ยอดขาย": expense.amount.toString(),
            "กำไร": expense.percentage.toFixed(2) + "%",
            "ค่าใช้จ่าย": "",
          });
        }

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
        roi: roiData,
      },
    });
  } catch (error) {
    console.error("[reports] ROI report error", error);
    return NextResponse.json(
      { ok: false, message: "ไม่สามารถสร้างรายงานได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
