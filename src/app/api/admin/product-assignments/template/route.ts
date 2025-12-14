import { exportAssignmentsCsv, type AssignmentExportRow } from "@/lib/assignmentImportExport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/product-assignments/template
 *
 * ดาวน์โหลดไฟล์ CSV template ตัวอย่างสำหรับการ import การผูกสินค้า
 *
 * Returns:
 * - CSV file with sample data showing the required format
 */
export async function GET(): Promise<Response> {
  try {
    // Create sample rows to show the expected format
    const sampleRows: AssignmentExportRow[] = [
      {
        employeeName: "สมชาย ใจดี",
        employeeCode: "EMP001",
        storeName: "ร้าน A",
        productCode: "PROD-001",
        productName: "สินค้าตัวอย่าง 1",
        unitName: "กล่อง",
        unitSku: "SKU-001-BOX",
        pricePc: 100,
        isActive: "ใช้งาน",
      },
      {
        employeeName: "สมชาย ใจดี",
        employeeCode: "EMP001",
        storeName: "ร้าน A",
        productCode: "PROD-001",
        productName: "สินค้าตัวอย่าง 1",
        unitName: "ซอง",
        unitSku: "SKU-001-PCK",
        pricePc: 10,
        isActive: "ใช้งาน",
      },
      {
        employeeName: "สมหญิง รักงาน",
        employeeCode: "EMP002",
        storeName: "ร้าน B",
        productCode: "PROD-002",
        productName: "สินค้าตัวอย่าง 2",
        unitName: "ชิ้น",
        unitSku: "SKU-002-PCS",
        pricePc: 50,
        isActive: "ใช้งาน",
      },
    ];

    // Generate CSV from sample data
    const csv = exportAssignmentsCsv(sampleRows);
    const filename = "product-assignments-template.csv";

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[template] error", error);
    // Intentionally unused - error message kept for potential logging needs
    const _message = error instanceof Error ? error.message : "ไม่สามารถสร้างไฟล์ template ได้";

    // Even on error, return a basic CSV template
    const basicCsv = `ชื่อพนักงาน,รหัสพนักงาน,ชื่อร้านค้า,รหัสสินค้า,ชื่อสินค้า,หน่วย,SKU,ราคา PC,สถานะ
สมชาย ใจดี,EMP001,ร้าน A,PROD-001,สินค้าตัวอย่าง,กล่อง,SKU-001,100,ใช้งาน`;

    return new Response(basicCsv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="product-assignments-template.csv"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }
}
