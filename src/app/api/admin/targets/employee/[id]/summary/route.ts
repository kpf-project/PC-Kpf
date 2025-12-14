import { NextResponse } from "next/server";
import { getEmployeeTargetSummary } from "@/lib/monthlyTargets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/targets/employee/[id]/summary
 * Get comprehensive target summary for an employee
 *
 * Returns:
 * - Current month target with progress
 * - Recent 6 months history
 * - Achievement statistics
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;

    const summary = await getEmployeeTargetSummary(employeeId);

    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "ไม่สามารถโหลดสรุปเป้าหมายพนักงานได้";
    const isNotFound = message.includes("ไม่พบพนักงาน");
    return NextResponse.json(
      { ok: false, message },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
