import { NextRequest, NextResponse } from "next/server";
import { listProductCatalog } from "@/lib/supabaseProducts";
import { exportProductsCsv, exportProductsExcel } from "@/lib/productImportExport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Response is either a file download or an error JSON
interface ExportErrorResponse {
  success: false;
  error: string;
}

/**
 * GET /api/admin/products/export?format=csv|excel
 *
 * Export all products to CSV or Excel format.
 *
 * Process:
 * 1. Get format from query params (default: csv)
 * 2. Fetch all products from Supabase catalog
 * 3. Generate file using appropriate exporter
 * 4. Return file with proper headers (Content-Type, Content-Disposition)
 * 5. Include UTF-8 BOM for CSV files
 */
export async function GET(request: NextRequest): Promise<NextResponse<Buffer | ExportErrorResponse>> {
  try {
    // Get format from query params
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";

    if (format !== "csv" && format !== "excel") {
      return NextResponse.json(
        {
          success: false,
          error: "รูปแบบไม่ถูกต้อง กรุณาระบุ format=csv หรือ format=excel",
        },
        { status: 400 }
      );
    }

    // Fetch all products from catalog
    const products = await listProductCatalog();

    if (products.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่พบข้อมูลสินค้าในระบบ",
        },
        { status: 404 }
      );
    }

    // Generate file based on format
    if (format === "csv") {
      const csvContent = exportProductsCsv(products);
      const buffer = Buffer.from(csvContent, "utf-8");

      // Return CSV with UTF-8 BOM
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="products_${new Date().toISOString().split("T")[0]}.csv"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    } else {
      // Excel format
      const excelBuffer = await exportProductsExcel(products);
      const buffer = Buffer.from(excelBuffer);

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="products_${new Date().toISOString().split("T")[0]}.xlsx"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }
  } catch (error) {
    console.error("[products/export] Export failed:", error);

    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการส่งออกสินค้า";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
