import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import { withTelemetrySpan } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ========================
// Type Definitions
// ========================

interface EmployeeAssignment {
  employeeId: string;
  storeId: string;
  isPrimary: boolean;
}

interface GetAssignmentsResponse {
  success: true;
  assignments: EmployeeAssignment[];
}

interface ErrorResponse {
  success: false;
  error: string;
}

// ========================
// GET - Fetch All Employee Store Assignments
// ========================

/**
 * GET /api/stock/employee-assignments
 * Returns all employee-store assignments for filtering and auto-selection
 */
export async function GET(_request: NextRequest) {
  return withTelemetrySpan<NextResponse>(
    "stock.employee-assignments.get",
    async (span) => {
      try {
        const supabase = getSupabaseServiceClient();

        // Fetch all employee store assignments
        const { data: assignments, error: assignmentsError } = await supabase
          .from("employee_store_assignments")
          .select("employee_id, store_id, is_primary")
          .order("employee_id", { ascending: true });

        if (assignmentsError) {
          console.error("[stock.employee-assignments] Query error:", assignmentsError);
          span.markError(assignmentsError);
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "ไม่สามารถดึงข้อมูลการผูกพนักงานกับร้านได้" },
            { status: 500 }
          );
        }

        // Transform to camelCase for frontend consistency
        const typedAssignments: EmployeeAssignment[] = (assignments || []).map((a) => ({
          employeeId: a.employee_id,
          storeId: a.store_id,
          isPrimary: a.is_primary,
        }));

        span.setAttribute("assignments_count", typedAssignments.length);

        return NextResponse.json<GetAssignmentsResponse>({
          success: true,
          assignments: typedAssignments,
        });
      } catch (error) {
        console.error("[stock.employee-assignments] Unexpected error:", error);
        span.markError(error);

        const message =
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการดึงข้อมูลการผูกพนักงานกับร้าน";

        return NextResponse.json<ErrorResponse>(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );
}
