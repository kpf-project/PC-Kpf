import { NextResponse } from "next/server";
import { listEmployeesFromSupabase } from "@/lib/supabaseDirectory";
import {
  deleteLeave as deleteLeaveSupabase,
  updateLeave as updateLeaveSupabase,
  getLeave as getLeaveSupabase,
  type LeaveStatus,
} from "@/lib/supabaseLeaves";


type ParamsPromise = {
  params: Promise<{ id: string }>;
};

const isLeaveStatus = (value: unknown): value is LeaveStatus =>
  typeof value === "string" &&
  (value === "scheduled" || value === "approved" || value === "rejected" || value === "cancelled");

export async function PUT(request: Request, context: ParamsPromise) {
  try {
    const {
      employeeId,
      type,
      startDate,
      endDate,
      reason,
      status,
    } = (await request.json()) as Partial<{
      employeeId: string;
      type: string;
      startDate: string;
      endDate: string;
      reason: string;
      status: string;
    }>;

    const { id } = await context.params;

    // Get existing leave to preserve employeeName if not changing employee
    const existingLeave = await getLeaveSupabase(id);
    if (!existingLeave) {
      return NextResponse.json(
        { ok: false, message: "ไม่พบข้อมูลการลา" },
        { status: 404 },
      );
    }

    // If changing employee, get new employee name
    let employeeName = existingLeave.employeeName;
    if (employeeId && employeeId !== existingLeave.employeeId) {
      const employees = await listEmployeesFromSupabase();
      const employee = employees?.find((emp) => emp.id === employeeId);
      if (!employee) {
        return NextResponse.json(
          { ok: false, message: "ไม่พบข้อมูลพนักงาน" },
          { status: 404 },
        );
      }
      employeeName = employee.name;
    }

    console.log("[PUT /api/admin/leaves/[id]] Updating leave:", {
      id,
      employeeId: employeeId || existingLeave.employeeId,
      employeeName,
      type: type || existingLeave.type,
      startDate: startDate || existingLeave.startDate,
      endDate: endDate || existingLeave.endDate,
      status: status || existingLeave.status,
    });

    const leave = await updateLeaveSupabase(id, {
      employeeId,
      employeeName: employeeId ? employeeName : undefined,
      type,
      startDate,
      endDate,
      reason: reason !== undefined ? reason : undefined,
      status: status && isLeaveStatus(status) ? status : undefined,
    });

    console.log("[PUT /api/admin/leaves/[id]] Leave updated successfully");

    return NextResponse.json({ ok: true, leave });
  } catch (error) {
    console.error("[PUT /api/admin/leaves/[id]] Error:", error);
    const message =
      error instanceof Error ? error.message : "ไม่สามารถแก้ไขวันลาได้";
    const isClientError =
      message.includes("กรุณา") ||
      message.includes("ไม่พบ") ||
      message.includes("ไม่ถูกต้อง") ||
      message.includes("วันเริ่มต้น");
    return NextResponse.json(
      { ok: false, message },
      { status: isClientError ? 400 : 500 },
    );
  }
}

export async function DELETE(request: Request, context: ParamsPromise) {
  try {
    const { id } = await context.params;

    console.log("[DELETE /api/admin/leaves/[id]] Deleting leave:", id);

    await deleteLeaveSupabase(id);

    console.log("[DELETE /api/admin/leaves/[id]] Leave deleted successfully");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/admin/leaves/[id]] Error:", error);
    const message =
      error instanceof Error ? error.message : "ไม่สามารถลบวันลาได้";
    const isClientError = message.includes("ไม่พบ");
    return NextResponse.json(
      { ok: false, message },
      { status: isClientError ? 404 : 500 },
    );
  }
}
