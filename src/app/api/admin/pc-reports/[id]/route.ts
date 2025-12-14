import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import { withTelemetrySpan } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PCDailyReport = {
  id: string;
  report_date: string;
  employee_id: string;
  employee_name: string;
  store_id: string;
  store_name: string;
  customer_activities: string | null;
  competitor_promo_photos: string[];
  competitor_promo_notes: string | null;
  store_promo_photos: string[];
  store_promo_notes: string | null;
  status: "draft" | "submitted";
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

type PCShelfPhoto = {
  id: string;
  report_id: string;
  photo_url: string;
  storage_path: string;
  caption: string | null;
  uploaded_at: string;
  created_at: string;
};

type PCStockUsage = {
  id: string;
  report_id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  quantities: Record<string, number>;
  base_unit_total: number;
  created_at: string;
};

/**
 * Response body for fetching a single report
 */
interface GetReportResponse {
  success: true;
  report: PCDailyReport;
  shelf_photos: PCShelfPhoto[];
  stock_usage: PCStockUsage[];
}

/**
 * Request body for updating a report
 */
interface UpdateReportRequest {
  customer_activities?: string;
  competitor_promo_notes?: string;
  store_promo_notes?: string;
  status?: "draft" | "submitted";
}

/**
 * Response body for successful report update
 */
interface UpdateReportResponse {
  success: true;
  report: PCDailyReport;
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
 * GET /api/admin/pc-reports/[id]
 * Get a single report with all details (photos and stock usage)
 *
 * คำอธิบายการทำงาน (Thai Explanation):
 * 1. รับ report ID จาก URL parameter
 * 2. ดึงข้อมูลรายงานหลักจาก pc_daily_reports
 * 3. ดึงรูปภาพชั้นวางทั้งหมดที่เกี่ยวข้อง
 * 4. ดึงข้อมูลการใช้สต็อกทั้งหมดที่เกี่ยวข้อง
 * 5. ส่งข้อมูลครบถ้วนกลับไป
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  return withTelemetrySpan("pc_reports.get_by_id", async (span) => {
    try {
      const { id } = await context.params;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid report ID format",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      span.setAttribute("report_id", id);

      const client = getSupabaseServiceClient();

      // Fetch report
      const { data: report, error: reportError } = await client
        .from("pc_daily_reports")
        .select("*")
        .eq("id", id)
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

      // Fetch shelf photos
      const { data: photos, error: photosError } = await client
        .from("pc_shelf_photos")
        .select("*")
        .eq("report_id", id)
        .order("created_at", { ascending: true });

      if (photosError) {
        span.markError(photosError);
        console.error("[pc-reports] Failed to fetch photos:", photosError);
      }

      // Fetch stock usage
      const { data: stockUsage, error: stockError } = await client
        .from("pc_stock_usage")
        .select("*")
        .eq("report_id", id)
        .order("created_at", { ascending: true });

      if (stockError) {
        span.markError(stockError);
        console.error("[pc-reports] Failed to fetch stock usage:", stockError);
      }

      span.setAttribute("photos_count", photos?.length || 0);
      span.setAttribute("stock_usage_count", stockUsage?.length || 0);

      // Normalize photo arrays to ensure they're never null
      const normalizedReport: PCDailyReport = {
        id: report.id,
        report_date: report.report_date,
        employee_id: report.employee_id,
        employee_name: report.employee_name,
        store_id: report.store_id,
        store_name: report.store_name,
        customer_activities: report.customer_activities,
        competitor_promo_photos: report.competitor_promo_photos || [],
        competitor_promo_notes: report.competitor_promo_notes,
        store_promo_photos: report.store_promo_photos || [],
        store_promo_notes: report.store_promo_notes,
        status: report.status as "draft" | "submitted",
        submitted_at: report.submitted_at,
        created_at: report.created_at,
        updated_at: report.updated_at,
      };

      // Normalize stock usage to ensure quantities is always an object
      const normalizedStockUsage: PCStockUsage[] = (stockUsage || []).map((item) => {
        // Safely convert Json type to Record<string, number>
        const quantities: Record<string, number> =
          item.quantities && typeof item.quantities === 'object' && !Array.isArray(item.quantities)
            ? (item.quantities as Record<string, number>)
            : {};

        return {
          id: item.id,
          report_id: item.report_id,
          product_id: item.product_id,
          product_code: item.product_code,
          product_name: item.product_name,
          quantities,
          base_unit_total: item.total_base_units,
          created_at: item.created_at,
        };
      });

      return NextResponse.json({
        success: true,
        report: normalizedReport,
        shelf_photos: photos || [],
        stock_usage: normalizedStockUsage,
      } satisfies GetReportResponse);
    } catch (error) {
      console.error("[pc-reports] GET by ID error:", error);
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

/**
 * PUT /api/admin/pc-reports/[id]
 * Update an existing report (partial updates allowed)
 *
 * คำอธิบายการทำงาน (Thai Explanation):
 * 1. รับ report ID จาก URL parameter
 * 2. ตรวจสอบว่ารายงานมีอยู่จริง
 * 3. รับข้อมูลที่ต้องการอัปเดตจาก request body (partial update)
 * 4. ตรวจสอบความถูกต้องของข้อมูล (เช่น status ต้องเป็น draft หรือ submitted)
 * 5. อัปเดตเฉพาะฟิลด์ที่ส่งมา
 * 6. ส่งข้อมูลรายงานที่อัปเดตกลับไป
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  return withTelemetrySpan("pc_reports.update", async (span) => {
    try {
      const { id } = await context.params;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid report ID format",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      span.setAttribute("report_id", id);

      const body = (await request.json()) as UpdateReportRequest;

      // Validate status if provided
      if (body.status && body.status !== "draft" && body.status !== "submitted") {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid status. Must be 'draft' or 'submitted'",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      const client = getSupabaseServiceClient();

      // Check if report exists
      const { data: existingReport, error: checkError } = await client
        .from("pc_daily_reports")
        .select("id")
        .eq("id", id)
        .single();

      if (checkError || !existingReport) {
        span.markError(checkError || new Error("Report not found"));
        return NextResponse.json(
          {
            success: false,
            error: "Report not found",
            code: checkError?.code,
          } satisfies ErrorResponse,
          { status: 404 }
        );
      }

      // Build update object with only provided fields
      const updateData: Partial<PCDailyReport> = {};

      if (body.customer_activities !== undefined) {
        const numValue = typeof body.customer_activities === 'number'
          ? body.customer_activities
          : parseInt(body.customer_activities as string, 10) || 0;
        updateData.customer_activities = numValue.toString();
      }

      if (body.competitor_promo_notes !== undefined) {
        updateData.competitor_promo_notes = body.competitor_promo_notes || null;
      }

      if (body.store_promo_notes !== undefined) {
        updateData.store_promo_notes = body.store_promo_notes || null;
      }

      if (body.status !== undefined) {
        updateData.status = body.status;
      }

      // If no fields to update, return early
      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "No fields to update",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      // Update report
      type SupabaseError = { message: string; code?: string } | null;
      type UpdateResult = { data: PCDailyReport | null; error: SupabaseError };

      const updateResult = await client
        .from("pc_daily_reports")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      const { data: updatedReport, error: updateError } = updateResult as unknown as UpdateResult;

      if (updateError || !updatedReport) {
        span.markError(updateError || new Error("Update failed"));
        console.error("[pc-reports] Update error:", updateError);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to update report",
            code: updateError?.code,
          } satisfies ErrorResponse,
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        report: updatedReport,
      } satisfies UpdateReportResponse);
    } catch (error) {
      console.error("[pc-reports] PUT error:", error);
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
