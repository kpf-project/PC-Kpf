import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import { withTelemetrySpan } from "@/lib/observability";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PCStockUsage = Database["public"]["Tables"]["pc_stock_usage"]["Row"];
type Json = Database["public"]["Tables"]["pc_stock_usage"]["Row"]["quantities"];

/**
 * Request body for adding stock usage
 */
interface AddStockRequest {
  stock_items: Array<{
    product_id: string;
    quantities: Record<string, number>;
  }>;
}

/**
 * Response body for successful stock addition
 */
interface AddStockResponse {
  success: true;
  stock_usage: PCStockUsage[];
}

/**
 * Error response body
 */
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

/**
 * Route segment config for dynamic parameter
 */
interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Helper function to calculate total base units for a product
 * This simulates the calculate_stock_base_units() database function
 *
 * คำอธิบาย (Explanation):
 * คำนวณจำนวนหน่วยฐาน (base units) โดยคูณจำนวนแต่ละหน่วยด้วย multiplier
 * เช่น ถ้ามี 2 ลัง (1 ลัง = 12 ชิ้น) และ 5 ชิ้น = (2 * 12) + (5 * 1) = 29 ชิ้น
 */
async function calculateBaseUnits(
  client: ReturnType<typeof getSupabaseServiceClient>,
  productId: string,
  quantities: Record<string, number>
): Promise<number> {
  // Get all units for this product
  const { data: units, error } = await client
    .from("product_units")
    .select("name, multiplier_to_base")
    .eq("product_id", productId);

  if (error || !units) {
    console.error("[pc-reports] Failed to fetch product units:", error);
    throw new Error(`Failed to fetch units for product ${productId}`);
  }

  // Build a map of unit name to multiplier
  const unitMultipliers = new Map<string, number>();
  for (const unit of units) {
    unitMultipliers.set(unit.name.toLowerCase().trim(), unit.multiplier_to_base);
  }

  // Calculate total base units
  let totalBaseUnits = 0;
  for (const [unitName, quantity] of Object.entries(quantities)) {
    const multiplier = unitMultipliers.get(unitName.toLowerCase().trim());
    if (multiplier === undefined) {
      console.warn(`[pc-reports] Unknown unit "${unitName}" for product ${productId}, skipping`);
      continue;
    }
    totalBaseUnits += quantity * multiplier;
  }

  return totalBaseUnits;
}

/**
 * POST /api/admin/pc-reports/[id]/stock
 * Add stock usage to a report
 *
 * คำอธิบายการทำงาน (Thai Explanation):
 * 1. รับ report ID จาก URL parameter
 * 2. ตรวจสอบว่ารายงานมีอยู่จริง
 * 3. วนลูปตรวจสอบแต่ละรายการสินค้า:
 *    - ตรวจสอบว่าสินค้ามีอยู่ในระบบ
 *    - ตรวจสอบว่าพนักงานได้รับมอบหมายสินค้านี้สำหรับร้านนี้
 *    - คำนวณจำนวน base units จากหน่วยต่างๆ
 *    - Denormalize product_code และ product_name
 * 4. Insert ข้อมูลการใช้สต็อกทั้งหมด
 * 5. ส่งข้อมูลที่เพิ่มสำเร็จกลับไป
 *
 * ตัวอย่างการคำนวณ base units:
 * - ถ้าเปิด 2 ลัง (ลังละ 12 ชิ้น) + 5 ชิ้น
 * - quantities = {"ลัง": 2, "ชิ้น": 5}
 * - total_base_units = (2 * 12) + (5 * 1) = 29 ชิ้น
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  return withTelemetrySpan("pc_reports.add_stock", async (span) => {
    try {
      const { id: reportId } = await context.params;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(reportId)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid report ID format",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      span.setAttribute("report_id", reportId);

      const body = (await request.json()) as AddStockRequest;

      // Validate request body
      if (!body.stock_items || !Array.isArray(body.stock_items) || body.stock_items.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "stock_items array is required and must not be empty",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      // Validate each stock item
      for (let i = 0; i < body.stock_items.length; i++) {
        const item = body.stock_items[i];
        if (!item.product_id || !item.quantities || typeof item.quantities !== "object") {
          return NextResponse.json(
            {
              success: false,
              error: `Stock item at index ${i} is missing required fields: product_id, quantities`,
            } satisfies ErrorResponse,
            { status: 400 }
          );
        }

        // Validate quantities object
        if (Object.keys(item.quantities).length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: `Stock item at index ${i} has empty quantities object`,
            } satisfies ErrorResponse,
            { status: 400 }
          );
        }
      }

      span.setAttribute("stock_items_to_add", body.stock_items.length);

      const client = getSupabaseServiceClient();

      // Get report details (employee_id and store_id)
      const { data: report, error: reportError } = await client
        .from("pc_daily_reports")
        .select("id, employee_id, store_id")
        .eq("id", reportId)
        .single();

      if (reportError || !report) {
        span.markError(reportError || new Error("Report not found"));
        return NextResponse.json(
          {
            success: false,
            error: "Report not found",
            code: reportError?.code,
          } satisfies ErrorResponse,
          { status: 404 }
        );
      }

      // Process each stock item
      const stockRecords: Array<{
        report_id: string;
        product_id: string;
        product_code: string;
        product_name: string;
        quantities: Json;
        total_base_units: number;
      }> = [];

      for (const item of body.stock_items) {
        // Verify product exists
        const { data: product, error: productError } = await client
          .from("products")
          .select("id, code, name, is_active")
          .eq("id", item.product_id)
          .single();

        if (productError || !product) {
          return NextResponse.json(
            {
              success: false,
              error: `Product not found: ${item.product_id}`,
              code: productError?.code,
            } satisfies ErrorResponse,
            { status: 404 }
          );
        }

        if (!product.is_active) {
          return NextResponse.json(
            {
              success: false,
              error: `Product is not active: ${product.name} (${product.code})`,
            } satisfies ErrorResponse,
            { status: 400 }
          );
        }

        // Verify product is assigned to employee + store
        // Check for both global assignments (store_id = null) and store-specific assignments
        const { data: assignments, error: assignmentError } = await client
          .from("product_assignments")
          .select("id")
          .eq("product_id", item.product_id)
          .eq("employee_id", report.employee_id)
          .or(`store_id.is.null,store_id.eq.${report.store_id}`);

        if (assignmentError || !assignments || assignments.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: `Product ${product.name} (${product.code}) is not assigned to this employee at this store`,
              code: assignmentError?.code,
            } satisfies ErrorResponse,
            { status: 400 }
          );
        }

        // Calculate total base units
        let totalBaseUnits: number;
        try {
          totalBaseUnits = await calculateBaseUnits(client, item.product_id, item.quantities);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to calculate base units";
          return NextResponse.json(
            {
              success: false,
              error: message,
            } satisfies ErrorResponse,
            { status: 500 }
          );
        }

        stockRecords.push({
          report_id: reportId,
          product_id: item.product_id,
          product_code: product.code,
          product_name: product.name,
          quantities: item.quantities as Json,
          total_base_units: totalBaseUnits,
        });
      }

      // Insert all stock records
      const { data: insertedStock, error: insertError } = await client
        .from("pc_stock_usage")
        .insert(stockRecords)
        .select();

      if (insertError || !insertedStock) {
        span.markError(insertError || new Error("Insert failed"));
        console.error("[pc-reports] Failed to insert stock usage:", insertError);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to add stock usage",
            code: insertError?.code,
          } satisfies ErrorResponse,
          { status: 500 }
        );
      }

      span.setAttribute("stock_items_added", insertedStock.length);

      return NextResponse.json(
        {
          success: true,
          stock_usage: insertedStock,
        } satisfies AddStockResponse,
        { status: 201 }
      );
    } catch (error) {
      console.error("[pc-reports] POST stock error:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      return NextResponse.json(
        {
          success: false,
          error: message,
        } satisfies ErrorResponse,
        { status: 500 }
      );
    }
  });
}
