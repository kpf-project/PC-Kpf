import { NextResponse } from "next/server";
import { listEmployeesFromSupabase } from "@/lib/supabaseDirectory";
import { getProductSalesReport, type ProductSalesReport } from "@/lib/configStore";
import { getBranding } from "@/lib/supabaseBranding";
import { listMonthlyTargets } from "@/lib/monthlyTargets";
import ExcelJS from "exceljs";
import { stringify } from "csv-stringify/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiResponse = {
  report: ProductSalesReport;
  branding: Awaited<ReturnType<typeof getBranding>>;
  employees: Awaited<ReturnType<typeof listEmployeesFromSupabase>>;
  targetData: {
    aggregatedTarget: number | null;
    achievementPercent: number | null;
  };
};

function parseRanges(params: URLSearchParams) {
  const ranges = params.getAll("range");
  if (ranges.length === 0) {
    const start = params.get("start");
    const end = params.get("end");
    if (start) {
      return [
        {
          start,
          end: end ?? start,
        },
      ];
    }
    return [];
  }

  return ranges
    .map((value) => {
      const [startRaw, endRaw] = value.split(":");
      const start = startRaw?.trim();
      if (!start) return null;
      const end = endRaw?.trim();
      return {
        start,
        end: end && end.length > 0 ? end : start,
      };
    })
    .filter((range): range is { start: string; end: string } => Boolean(range));
}

function parseIds(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const format = searchParams.get("format");

  // Validate format if provided
  if (format && format !== "csv" && format !== "excel") {
    return NextResponse.json(
      { ok: false, message: "รูปแบบไฟล์ไม่ถูกต้อง (รองรับ csv และ excel เท่านั้น)" },
      { status: 400 },
    );
  }

  const employeeIds = parseIds(searchParams.get("employeeIds"));
  const storeIds = parseIds(searchParams.get("storeIds"));
  const dateRanges = parseRanges(searchParams).map((range) => ({
    start: range.start,
    end: range.end,
  }));

  // Calculate effectiveMonth from first date range (YYYY-MM format)
  let effectiveMonth: string | null = null;
  if (dateRanges.length > 0) {
    const firstStart = dateRanges[0].start;
    const match = firstStart.match(/^(\d{4})-(\d{2})/);
    if (match) {
      effectiveMonth = `${match[1]}-${match[2]}`;
    }
  }

  const [report, branding, employees, targets] = await Promise.all([
    getProductSalesReport({
      dateRanges,
      employeeIds,
      storeIds,
    }),
    getBranding(),
    listEmployeesFromSupabase(),
    effectiveMonth ? listMonthlyTargets({ month: effectiveMonth }) : Promise.resolve([]),
  ]);

  // Handle export formats
  if (format === "csv" || format === "excel") {
    const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
    const fileBaseName = `products-report-${timestamp}`;

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("รายงานสินค้า");

      // Define columns
      worksheet.columns = [
        { header: "รหัสสินค้า", key: "productCode", width: 15 },
        { header: "ชื่อสินค้า", key: "productName", width: 30 },
        { header: "หน่วย (ลัง/แพ็ค/ชิ้น)", key: "units", width: 20 },
        { header: "จำนวนขาย", key: "quantity", width: 12 },
        { header: "ยอดขาย PC", key: "revenuePC", width: 15 },
        { header: "% จากยอดขายรวม", key: "contributionPercent", width: 18 },
        { header: "เขตขายดีที่สุด", key: "bestRegion", width: 20 },
        { header: "ร้านขายดีที่สุด", key: "topStore", width: 25 },
        { header: "พนักงานขายดีที่สุด", key: "topEmployee", width: 25 },
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };

      // Add data rows
      for (const product of report.products) {
        // Build unit breakdown string
        const unitParts: string[] = [];
        if (product.unitData.box.quantity > 0) {
          unitParts.push(`ลัง: ${product.unitData.box.quantity}`);
        }
        if (product.unitData.pack.quantity > 0) {
          unitParts.push(`แพ็ค: ${product.unitData.pack.quantity}`);
        }
        if (product.unitData.piece.quantity > 0) {
          unitParts.push(`ชิ้น: ${product.unitData.piece.quantity}`);
        }
        const unitsDisplay = unitParts.join(", ");

        worksheet.addRow({
          productCode: product.productCode,
          productName: product.productName,
          units: unitsDisplay,
          quantity: product.totalQuantity,
          revenuePC: product.totalRevenuePC,
          contributionPercent: product.contributionPercent.toFixed(2),
          bestRegion: product.bestRegion || "",
          topStore: product.topStores[0]?.name || "",
          topEmployee: product.topEmployees[0]?.name || "",
        });
      }

      // Add summary row
      const summaryRow = worksheet.addRow({
        productCode: "รวมทั้งหมด",
        productName: "",
        units: "",
        quantity: report.summary.totalQuantity,
        revenuePC: report.summary.totalRevenuePC,
        contributionPercent: "100.00",
        bestRegion: "",
        topStore: "",
        topEmployee: "",
      });
      summaryRow.font = { bold: true };

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
      const csvRows = report.products.map((product) => {
        // Build unit breakdown string
        const unitParts: string[] = [];
        if (product.unitData.box.quantity > 0) {
          unitParts.push(`ลัง: ${product.unitData.box.quantity}`);
        }
        if (product.unitData.pack.quantity > 0) {
          unitParts.push(`แพ็ค: ${product.unitData.pack.quantity}`);
        }
        if (product.unitData.piece.quantity > 0) {
          unitParts.push(`ชิ้น: ${product.unitData.piece.quantity}`);
        }

        return {
          "รหัสสินค้า": product.productCode,
          "ชื่อสินค้า": product.productName,
          "หน่วย (ลัง/แพ็ค/ชิ้น)": unitParts.join(", "),
          "จำนวนขาย": product.totalQuantity,
          "ยอดขาย PC": product.totalRevenuePC,
          "% จากยอดขายรวม": product.contributionPercent.toFixed(2),
          "เขตขายดีที่สุด": product.bestRegion || "",
          "ร้านขายดีที่สุด": product.topStores[0]?.name || "",
          "พนักงานขายดีที่สุด": product.topEmployees[0]?.name || "",
        };
      });

      // Add summary row
      csvRows.push({
        "รหัสสินค้า": "รวมทั้งหมด",
        "ชื่อสินค้า": "",
        "หน่วย (ลัง/แพ็ค/ชิ้น)": "",
        "จำนวนขาย": report.summary.totalQuantity,
        "ยอดขาย PC": report.summary.totalRevenuePC,
        "% จากยอดขายรวม": "100.00",
        "เขตขายดีที่สุด": "",
        "ร้านขายดีที่สุด": "",
        "พนักงานขายดีที่สุด": "",
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

  // Calculate aggregated target for filtered employees
  let aggregatedTarget: number | null = null;
  let achievementPercent: number | null = null;

  if (employeeIds.length > 0 && targets.length > 0) {
    // Filter targets for selected employees only
    const relevantTargets = targets.filter((t) => employeeIds.includes(t.employee_id));

    if (relevantTargets.length > 0) {
      // Sum all targets
      aggregatedTarget = relevantTargets.reduce((sum, t) => sum + (t.target_revenue_pc ?? 0), 0);

      // Calculate achievement percentage
      if (aggregatedTarget !== null && aggregatedTarget > 0) {
        achievementPercent = (report.summary.totalRevenuePC / aggregatedTarget) * 100;
      }
    }
  }

  return NextResponse.json<ApiResponse>({
    report,
    branding,
    employees,
    targetData: {
      aggregatedTarget,
      achievementPercent: achievementPercent ? Math.round(achievementPercent * 10) / 10 : null,
    },
  });
}
