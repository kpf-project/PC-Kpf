import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import { withTelemetrySpan } from "@/lib/observability";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PCDailyReport = Database["public"]["Tables"]["pc_daily_reports"]["Row"];
type PCShelfPhoto = Database["public"]["Tables"]["pc_shelf_photos"]["Row"];
type PCStockUsage = Database["public"]["Tables"]["pc_stock_usage"]["Row"];

/**
 * Request body for creating/updating a PC daily report
 */
interface CreateReportRequest {
  report_date: string;
  employee_id: string;
  store_id: string;
  customer_activities?: string;
  competitor_promo_notes?: string;
  store_promo_notes?: string;
  status: "draft" | "submitted";
}

/**
 * Response body for successful report creation/update
 */
interface CreateReportResponse {
  success: true;
  report: PCDailyReport;
}

/**
 * Response body for fetching reports
 */
interface GetReportsResponse {
  success: true;
  reports: PCDailyReport[];
  photos?: Record<string, PCShelfPhoto[]>;
  stock_usage?: Record<string, PCStockUsage[]>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
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
 * GET /api/admin/pc-reports
 * Fetch PC daily reports with filters and pagination
 *
 * Query Parameters:
 * - date: specific date or date range (YYYY-MM-DD)
 * - employee_id: filter by employee UUID
 * - store_id: filter by store UUID
 * - status: draft | submitted | all (default: all)
 * - page: page number (default: 1)
 * - limit: items per page (default: 20)
 * - include_details: include photos and stock usage (default: false)
 */
export async function GET(request: NextRequest) {
  return withTelemetrySpan("pc_reports.get", async (span) => {
    try {
      const { searchParams } = new URL(request.url);

      // Parse query parameters
      const date = searchParams.get("date");
      const employeeId = searchParams.get("employee_id");
      const storeId = searchParams.get("store_id");
      const status = searchParams.get("status") || "all";
      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
      const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
      const includeDetails = searchParams.get("include_details") === "true";

      span.setAttribute("page", page);
      span.setAttribute("limit", limit);
      span.setAttribute("includeDetails", includeDetails);

      const client = getSupabaseServiceClient();

      // Build query
      let query = client
        .from("pc_daily_reports")
        .select("*", { count: "exact" })
        .order("report_date", { ascending: false })
        .order("created_at", { ascending: false });

      // Apply filters
      if (date) {
        query = query.eq("report_date", date);
      }

      if (employeeId) {
        query = query.eq("employee_id", employeeId);
      }

      if (storeId) {
        query = query.eq("store_id", storeId);
      }

      if (status && status !== "all") {
        if (status !== "draft" && status !== "submitted") {
          return NextResponse.json(
            {
              success: false,
              error: "Invalid status parameter. Must be 'draft', 'submitted', or 'all'.",
            } satisfies ErrorResponse,
            { status: 400 }
          );
        }
        query = query.eq("status", status);
      }

      // Apply pagination
      const startIndex = (page - 1) * limit;
      query = query.range(startIndex, startIndex + limit - 1);

      // Execute query
      const { data: reports, error, count } = await query;

      if (error) {
        span.markError(error);
        console.error("[pc-reports] Database query error:", error);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to fetch reports from database",
            code: error.code,
          } satisfies ErrorResponse,
          { status: 500 }
        );
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      span.setAttribute("totalReports", totalCount);

      // If details requested, fetch photos and stock usage
      let photos: Record<string, PCShelfPhoto[]> | undefined;
      let stockUsage: Record<string, PCStockUsage[]> | undefined;

      if (includeDetails && reports && reports.length > 0) {
        const reportIds = reports.map((r) => r.id);

        // Fetch photos
        const { data: photoData, error: photoError } = await client
          .from("pc_shelf_photos")
          .select("*")
          .in("report_id", reportIds)
          .order("created_at", { ascending: true });

        if (photoError) {
          console.error("[pc-reports] Failed to fetch photos:", photoError);
        } else if (photoData) {
          photos = {};
          photoData.forEach((photo) => {
            if (!photos![photo.report_id]) {
              photos![photo.report_id] = [];
            }
            photos![photo.report_id].push(photo);
          });
        }

        // Fetch stock usage
        const { data: stockData, error: stockError } = await client
          .from("pc_stock_usage")
          .select("*")
          .in("report_id", reportIds)
          .order("created_at", { ascending: true });

        if (stockError) {
          console.error("[pc-reports] Failed to fetch stock usage:", stockError);
        } else if (stockData) {
          stockUsage = {};
          stockData.forEach((stock) => {
            if (!stockUsage![stock.report_id]) {
              stockUsage![stock.report_id] = [];
            }
            // Normalize quantities to ensure it's always an object
            stockUsage![stock.report_id].push({
              id: stock.id,
              report_id: stock.report_id,
              product_id: stock.product_id,
              product_code: stock.product_code,
              product_name: stock.product_name,
              quantities: (stock.quantities as Record<string, number>) || {},
              total_base_units: stock.total_base_units,
              created_at: stock.created_at,
            });
          });
        }
      }

      // Normalize reports to ensure photo arrays are never null
      const normalizedReports = (reports || []).map((report) => ({
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
      }));

      return NextResponse.json({
        success: true,
        reports: normalizedReports,
        photos,
        stock_usage: stockUsage,
        pagination: {
          page,
          limit,
          total: totalCount,
          total_pages: totalPages,
        },
      } satisfies GetReportsResponse);
    } catch (error) {
      console.error("[pc-reports] GET error:", error);
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
 * POST /api/admin/pc-reports
 * Create or update a PC daily report (upsert based on date + employee + store)
 *
 * คำอธิบายการทำงาน (Thai Explanation):
 * 1. รับข้อมูลรายงานจาก request body
 * 2. ตรวจสอบว่ามีพนักงานและร้านค้าในระบบหรือไม่
 * 3. ตรวจสอบว่าพนักงานได้รับมอบหมายให้ทำงานที่ร้านนี้หรือไม่
 * 4. ค้นหารายงานที่มีอยู่แล้วด้วย (date, employee_id, store_id)
 * 5. ถ้ามีอยู่แล้ว ให้ UPDATE ถ้าไม่มี ให้ INSERT ใหม่
 * 6. Denormalize ชื่อพนักงานและร้านค้าเพื่อประสิทธิภาพในการ query
 * 7. ส่งข้อมูลรายงานที่สร้าง/อัปเดตกลับไป
 */
export async function POST(request: NextRequest) {
  return withTelemetrySpan("pc_reports.create", async (span) => {
    try {
      const body = (await request.json()) as CreateReportRequest;

      // Validate required fields
      if (!body.report_date || !body.employee_id || !body.store_id || !body.status) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing required fields: report_date, employee_id, store_id, status",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      // Validate status
      if (body.status !== "draft" && body.status !== "submitted") {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid status. Must be 'draft' or 'submitted'",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(body.report_date)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid date format. Must be YYYY-MM-DD",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      span.setAttribute("report_date", body.report_date);
      span.setAttribute("employee_id", body.employee_id);
      span.setAttribute("store_id", body.store_id);
      span.setAttribute("status", body.status);

      const client = getSupabaseServiceClient();

      // Verify employee exists and get name
      const { data: employee, error: employeeError } = await client
        .from("employees")
        .select("id, name")
        .eq("id", body.employee_id)
        .single();

      if (employeeError || !employee) {
        span.markError(employeeError || new Error("Employee not found"));
        return NextResponse.json(
          {
            success: false,
            error: "Employee not found",
            code: employeeError?.code,
          } satisfies ErrorResponse,
          { status: 404 }
        );
      }

      // Verify store exists and get name
      const { data: store, error: storeError } = await client
        .from("stores")
        .select("id, name")
        .eq("id", body.store_id)
        .single();

      if (storeError || !store) {
        span.markError(storeError || new Error("Store not found"));
        return NextResponse.json(
          {
            success: false,
            error: "Store not found",
            code: storeError?.code,
          } satisfies ErrorResponse,
          { status: 404 }
        );
      }

      // Verify employee is assigned to this store
      const { data: assignment, error: assignmentError } = await client
        .from("employee_store_assignments")
        .select("id")
        .eq("employee_id", body.employee_id)
        .eq("store_id", body.store_id)
        .single();

      if (assignmentError || !assignment) {
        span.markError(assignmentError || new Error("Employee not assigned to store"));
        return NextResponse.json(
          {
            success: false,
            error: "Employee is not assigned to this store",
            code: assignmentError?.code,
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      // Check if report already exists (for upsert logic)
      const { data: existingReport } = await client
        .from("pc_daily_reports")
        .select("id")
        .eq("report_date", body.report_date)
        .eq("employee_id", body.employee_id)
        .eq("store_id", body.store_id)
        .single();

      const customerActivitiesNum = typeof body.customer_activities === 'number'
        ? body.customer_activities
        : (body.customer_activities ? parseInt(body.customer_activities as string, 10) : 0);

      const reportData = {
        report_date: body.report_date,
        employee_id: body.employee_id,
        employee_name: employee.name,
        store_id: body.store_id,
        store_name: store.name,
        customer_activities: customerActivitiesNum.toString(),
        competitor_promo_notes: body.competitor_promo_notes || null,
        store_promo_notes: body.store_promo_notes || null,
        status: body.status,
      };

      let result: PCDailyReport;

      if (existingReport) {
        // UPDATE existing report
        span.setAttribute("operation", "update");
        span.setAttribute("existing_report_id", existingReport.id);

        const { data: updatedReport, error: updateError } = await client
          .from("pc_daily_reports")
          .update(reportData)
          .eq("id", existingReport.id)
          .select()
          .single();

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

        result = updatedReport;
      } else {
        // INSERT new report
        span.setAttribute("operation", "insert");

        const { data: newReport, error: insertError } = await client
          .from("pc_daily_reports")
          .insert(reportData)
          .select()
          .single();

        if (insertError || !newReport) {
          span.markError(insertError || new Error("Insert failed"));
          console.error("[pc-reports] Insert error:", insertError);
          return NextResponse.json(
            {
              success: false,
              error: "Failed to create report",
              code: insertError?.code,
            } satisfies ErrorResponse,
            { status: 500 }
          );
        }

        result = newReport;
      }

      span.setAttribute("report_id", result.id);

      return NextResponse.json(
        {
          success: true,
          report: result,
        } satisfies CreateReportResponse,
        { status: existingReport ? 200 : 201 }
      );
    } catch (error) {
      console.error("[pc-reports] POST error:", error);
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
