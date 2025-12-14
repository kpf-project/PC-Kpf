import { NextRequest, NextResponse } from "next/server";
import { getDashboardMetrics } from "@/lib/configStore";
import type { DashboardFilterOptions } from "@/lib/configStore";
import { requireAdmin } from "@/lib/apiAuth";
import { addLog } from "@/lib/supabaseLogs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/dashboard
 *
 * Query Parameters:
 * - rangeMode: "today" | "week" | "month" | "quarter" | "year" | "custom"
 * - rangeValue: Custom date range value (for custom mode)
 * - store: Store name filter
 * - employee: Employee name filter
 * - attendanceStatus: "all" | "check-in" | "check-out"
 * - salesStatus: Sales status filter
 * - timeFrom: Start time filter (HH:MM format)
 * - timeTo: End time filter (HH:MM format)
 *
 * Returns:
 * {
 *   metrics: DashboardMetrics
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // ✅ Verify admin authentication
    const authResult = await requireAdmin();
    if (!authResult.success) {
      return authResult.response;
    }

    const { session } = authResult;

    const searchParams = request.nextUrl.searchParams;

    // Build filter options from query parameters
    const options: DashboardFilterOptions = {};

    // Range filters
    const rangeMode = searchParams.get("rangeMode");
    const rangeValue = searchParams.get("rangeValue");
    if (rangeMode || rangeValue) {
      options.range = {
        mode: rangeMode as "day" | "week" | "month" | "year" | undefined,
        value: rangeValue,
      };
    }

    // Store filter
    const store = searchParams.get("store");
    if (store) {
      options.store = store;
    }

    // Employee filter
    const employee = searchParams.get("employee");
    if (employee) {
      options.employee = employee;
    }

    // Attendance status filter
    const attendanceStatus = searchParams.get("attendanceStatus");
    if (attendanceStatus) {
      options.attendanceStatus = attendanceStatus as "all" | "check-in" | "check-out";
    }

    // Sales status filter
    const salesStatus = searchParams.get("salesStatus");
    if (salesStatus) {
      options.salesStatus = salesStatus;
    }

    // Time window filters
    const timeFrom = searchParams.get("timeFrom");
    if (timeFrom) {
      options.timeFrom = timeFrom;
    }

    const timeTo = searchParams.get("timeTo");
    if (timeTo) {
      options.timeTo = timeTo;
    }

    // Fetch dashboard metrics
    const metrics = await getDashboardMetrics(options);

    // Log access for audit trail
    await addLog({
      timestamp: new Date().toISOString(),
      scope: 'admin',
      action: 'view',
      details: 'เข้าถึงแดชบอร์ดแอดมิน',
      actorName: session.employeeId || session.userId,
      metadata: {
        userId: session.userId,
        role: session.role,
        filters: options
      }
    });

    return NextResponse.json(
      { metrics },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[API] Dashboard error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "ไม่สามารถโหลดข้อมูลแดชบอร์ดได้";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
