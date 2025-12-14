import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import { withTelemetrySpan } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Success response body
 */
interface DeleteStockResponse {
  success: true;
  message: string;
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
 * Route segment config for dynamic parameters
 */
interface RouteContext {
  params: Promise<{
    id: string;
    stockId: string;
  }>;
}

/**
 * DELETE /api/admin/pc-reports/[id]/stock/[stockId]
 * Delete a stock usage item
 *
 * คำอธิบายการทำงาน (Thai Explanation):
 * 1. รับ report ID และ stock ID จาก URL parameters
 * 2. ตรวจสอบว่ารายการสต็อกมีอยู่จริงและเป็นของรายงานนี้
 * 3. ลบรายการสต็อกออกจากฐานข้อมูล
 * 4. ส่งข้อความยืนยันการลบกลับไป
 *
 * หมายเหตุ (Note):
 * - การลบจะไม่มีผลกับสต็อกจริงในคลัง เป็นเพียงการลบบันทึกการใช้
 * - ใช้สำหรับกรณีบันทึกข้อมูลผิดพลาด
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  return withTelemetrySpan("pc_reports.delete_stock", async (span) => {
    try {
      const { id: reportId, stockId } = await context.params;

      // Validate UUID formats
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

      if (!uuidRegex.test(stockId)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid stock ID format",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      span.setAttribute("report_id", reportId);
      span.setAttribute("stock_id", stockId);

      const client = getSupabaseServiceClient();

      // Check if stock item exists and belongs to this report
      const { data: existingStock, error: checkError } = await client
        .from("pc_stock_usage")
        .select("id, report_id")
        .eq("id", stockId)
        .single();

      if (checkError || !existingStock) {
        span.markError(checkError || new Error("Stock item not found"));
        return NextResponse.json(
          {
            success: false,
            error: "Stock item not found",
            code: checkError?.code,
          } satisfies ErrorResponse,
          { status: 404 }
        );
      }

      // Verify stock item belongs to the specified report
      if (existingStock.report_id !== reportId) {
        return NextResponse.json(
          {
            success: false,
            error: "Stock item does not belong to this report",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      // Delete stock item
      const { error: deleteError } = await client
        .from("pc_stock_usage")
        .delete()
        .eq("id", stockId);

      if (deleteError) {
        span.markError(deleteError);
        console.error("[pc-reports] Failed to delete stock item:", deleteError);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to delete stock item",
            code: deleteError.code,
          } satisfies ErrorResponse,
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Stock item deleted",
      } satisfies DeleteStockResponse);
    } catch (error) {
      console.error("[pc-reports] DELETE stock error:", error);
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
