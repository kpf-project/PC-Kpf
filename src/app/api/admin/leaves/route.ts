import { NextResponse } from "next/server";
import { listEmployeesFromSupabase } from "@/lib/supabaseDirectory";
import {
  createLeave as createLeaveSupabase,
  getLeaves as getLeavesSupabase,
  type LeaveStatus
} from "@/lib/supabaseLeaves";


const isLeaveStatus = (value: unknown): value is LeaveStatus =>
  typeof value === "string" &&
  (value === "scheduled" || value === "approved" || value === "rejected" || value === "cancelled");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId") || undefined;
    const status = searchParams.get("status") || undefined;

    const leaves = await getLeavesSupabase({
      employeeId,
      status: status && isLeaveStatus(status) ? status : undefined,
    });

    return NextResponse.json({ ok: true, leaves });
  } catch (error) {
    console.error("[GET /api/admin/leaves] Error:", error);
    const message = error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลการลาได้";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const {
      employeeId,
      type,
      startDate,
      endDate,
      reason,
      status,
    } = (await request.json()) as {
      employeeId?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
      status?: string;
    };

    if (!employeeId || !type || !startDate || !endDate) {
      return NextResponse.json(
        { ok: false, message: "กรุณากรอกข้อมูลวันลาให้ครบถ้วน" },
        { status: 400 },
      );
    }

    // Get employee name from employees list
    const employees = await listEmployeesFromSupabase();
    const employee = employees?.find((emp) => emp.id === employeeId);
    if (!employee) {
      return NextResponse.json(
        { ok: false, message: "ไม่พบข้อมูลพนักงาน" },
        { status: 404 },
      );
    }

    console.log("[POST /api/admin/leaves] Creating leave:", {
      employeeId,
      employeeName: employee.name,
      type,
      startDate,
      endDate,
      status: status || "scheduled",
    });

    const leave = await createLeaveSupabase({
      employeeId,
      employeeName: employee.name,
      type,
      startDate,
      endDate,
      reason: reason || null,
      status: isLeaveStatus(status) ? status : "scheduled",
    });

    console.log("[POST /api/admin/leaves] Leave created successfully:", leave);

    return NextResponse.json({ ok: true, leave });
  } catch (error) {
    console.error("[POST /api/admin/leaves] Error:", error);
    const message =
      error instanceof Error ? error.message : "ไม่สามารถบันทึกวันลาได้";
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
