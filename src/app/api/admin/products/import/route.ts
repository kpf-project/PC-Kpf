import { NextRequest, NextResponse } from "next/server";
import {
  parseProductsCsv,
  parseProductsExcel,
  validateImportedProducts,
  type ProductImportRow,
} from "@/lib/productImportExport";
import { upsertProductCatalogItem, listProductCatalog } from "@/lib/supabaseProducts";
import { listCompanies } from "@/lib/supabaseCompanies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Request body is FormData (not JSON)
// Response types
interface ImportSuccessResponse {
  success: true;
  imported: number;
  skipped: number;
  errors: string[];
  message: string;
}

interface ImportErrorResponse {
  success: false;
  error: string;
}

type ImportResponse = ImportSuccessResponse | ImportErrorResponse;

/**
 * POST /api/admin/products/import
 *
 * Import products from CSV or Excel file.
 * Accepts multipart/form-data with a "file" field.
 *
 * Process:
 * 1. Extract file from FormData
 * 2. Validate file type (CSV or Excel)
 * 3. Parse file using appropriate parser
 * 4. Validate all products
 * 5. Upsert products to Supabase (by code)
 * 6. Return import summary
 */
export async function POST(request: NextRequest): Promise<NextResponse<ImportResponse>> {
  try {
    // Parse FormData from request
    const formData = await request.formData();
    const file = formData.get("file");

    // Check if file exists and is a Blob-like object with required properties
    // Note: In Node.js environment, File is not available, but FormData returns Blob-like objects
    if (!file || typeof file === "string" || !("name" in file) || !("arrayBuffer" in file)) {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่พบไฟล์ที่ต้องการนำเข้า กรุณาเลือกไฟล์ CSV หรือ Excel",
        },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    const isCsv = fileName.endsWith(".csv") || file.type === "text/csv";
    const isExcel =
      fileName.endsWith(".xlsx") ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    if (!isCsv && !isExcel) {
      return NextResponse.json(
        {
          success: false,
          error: "ไฟล์ไม่ถูกต้อง กรุณาอัปโหลดไฟล์ CSV หรือ Excel (.xlsx) เท่านั้น",
        },
        { status: 400 }
      );
    }

    // Parse file based on type
    let products: ProductImportRow[];

    try {
      if (isCsv) {
        const text = await file.text();
        products = parseProductsCsv(text);
      } else {
        const buffer = await file.arrayBuffer();
        products = await parseProductsExcel(buffer);
      }
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : "ไม่สามารถอ่านไฟล์ได้";
      return NextResponse.json(
        {
          success: false,
          error: `เกิดข้อผิดพลาดในการอ่านไฟล์: ${message}`,
        },
        { status: 400 }
      );
    }

    if (products.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่พบข้อมูลสินค้าในไฟล์ กรุณาตรวจสอบไฟล์และลองใหม่อีกครั้ง",
        },
        { status: 400 }
      );
    }

    // Validate all products
    const validationErrors = validateImportedProducts(products);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `พบข้อผิดพลาดในข้อมูล:\n${validationErrors.join("\n")}`,
        },
        { status: 400 }
      );
    }

    // Get existing products to determine upsert strategy
    const existingProducts = await listProductCatalog();
    const existingByCode = new Map(existingProducts.map((p) => [p.code.toLowerCase(), p]));

    // Get companies for name matching
    const companies = await listCompanies();
    const companiesByName = new Map(companies.map((c) => [c.name.toLowerCase(), c.id]));

    // Import products one by one
    const importResults = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const product of products) {
      try {
        const existing = existingByCode.get(product.code.toLowerCase());
        const existingId = existing ? existing.id : undefined;

        // Match company name to company ID (case-insensitive)
        let companyId: string | null = null;
        if (product.companyName) {
          const matchedCompanyId = companiesByName.get(product.companyName.toLowerCase());
          if (matchedCompanyId) {
            companyId = matchedCompanyId;
          }
          // If company name provided but not found, just ignore it (don't throw error)
        }

        await upsertProductCatalogItem({
          id: existingId,
          code: product.code,
          name: product.name,
          description: product.description || null,
          companyId: companyId,
          isActive: product.isActive,
          units: product.units.map((unit) => ({
            name: unit.name,
            sku: unit.sku || null,
            isBase: unit.isBase,
            multiplierToBase: unit.multiplierToBase,
          })),
        });

        importResults.imported++;
      } catch (upsertError) {
        const message = upsertError instanceof Error ? upsertError.message : "Unknown error";
        importResults.errors.push(`สินค้า "${product.name}" (${product.code}): ${message}`);
        importResults.skipped++;
      }
    }

    // Build success message
    let message = `นำเข้าสินค้าสำเร็จ ${importResults.imported} รายการ`;
    if (importResults.skipped > 0) {
      message += `, ข้ามไป ${importResults.skipped} รายการ`;
    }

    return NextResponse.json({
      success: true,
      imported: importResults.imported,
      skipped: importResults.skipped,
      errors: importResults.errors,
      message,
    });
  } catch (error) {
    console.error("[products/import] Import failed:", error);

    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการนำเข้าสินค้า";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
