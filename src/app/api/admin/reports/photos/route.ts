import { NextResponse } from "next/server";
import { listEmployeesFromSupabase, listStoresFromSupabase } from "@/lib/supabaseDirectory";
import {
  getPhotoTimeline,
  getPhotoStatistics,
  type PhotoTimelineItem,
  type PhotoStatistics,
} from "@/lib/supabasePhotos";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PhotoReportResponse {
  success: boolean;
  data?: {
    timeline: PhotoTimelineItem[];
    statistics: PhotoStatistics;
    employee: {
      id: string;
      name: string;
      employeeCode: string | null;
    };
    store: {
      id: string;
      name: string;
    } | null;
    filters: {
      startDate: string;
      endDate: string;
      storeId: string | null;
    };
  };
  error?: string;
}

/**
 * GET /api/admin/reports/photos
 * Query params:
 * - employeeId: string (required)
 * - startDate: YYYY-MM-DD (required)
 * - endDate: YYYY-MM-DD (required)
 * - storeId: string (optional)
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query params
    const employeeId = searchParams.get("employeeId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const storeId = searchParams.get("storeId");

    if (!employeeId || !startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: employeeId, startDate, endDate",
        } as PhotoReportResponse,
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid date format. Use YYYY-MM-DD",
        } as PhotoReportResponse,
        { status: 400 }
      );
    }

    // Fetch employee data
    const employees = await listEmployeesFromSupabase();
    const employee = employees?.find((e) => e.id === employeeId);

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          error: "Employee not found",
        } as PhotoReportResponse,
        { status: 404 }
      );
    }

    // Fetch store data (if filtered)
    let store = null;
    if (storeId) {
      const stores = await listStoresFromSupabase();
      const foundStore = stores?.find((s) => s.id === storeId);
      if (foundStore) {
        store = {
          id: foundStore.id,
          name: foundStore.name,
        };
      }
    }

    // Debug logging
    console.log("[Photo Report] Query params:", {
      employeeId,
      employeeName: employee.name,
      startDate,
      endDate,
      storeId,
    });

    // Fetch photo timeline and statistics in parallel for performance
    const [timeline, statistics] = await Promise.all([
      getPhotoTimeline(employee.name, startDate, endDate),
      getPhotoStatistics(employee.name, startDate, endDate),
    ]);

    // Debug logging
    console.log("[Photo Report] Results:", {
      timelineCount: timeline.length,
      totalRecords: statistics.totalRecords,
      recordsWithPhoto: statistics.recordsWithPhoto,
    });

    // No store filtering - always show all stores
    // Users can see all check-in/out photos from all stores in a single day

    const response: PhotoReportResponse = {
      success: true,
      data: {
        timeline,
        statistics,
        employee: {
          id: employee.id,
          name: employee.name,
          employeeCode: employee.employeeCode || null,
        },
        store,
        filters: {
          startDate,
          endDate,
          storeId,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Photo Report API] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      } as PhotoReportResponse,
      { status: 500 }
    );
  }
}
