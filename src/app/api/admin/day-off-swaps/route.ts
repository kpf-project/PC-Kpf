import { NextResponse } from "next/server";
import { listEmployeesFromSupabase } from "@/lib/supabaseDirectory";
import {
  createDayOffSwap,
  getDayOffSwaps,
  type SwapStatus,
  type SwapType,
} from "@/lib/supabaseDayOffSwaps";


const isSwapStatus = (value: unknown): value is SwapStatus =>
  typeof value === "string" &&
  (value === "pending" || value === "approved" || value === "rejected" || value === "cancelled");

const isSwapType = (value: unknown): value is SwapType =>
  typeof value === "string" &&
  (value === "regular-day-off" || value === "public-holiday");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId") || undefined;
    const status = searchParams.get("status") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const swaps = await getDayOffSwaps({
      employeeId,
      status: status && isSwapStatus(status) ? status : undefined,
      startDate,
      endDate,
    });

    return NextResponse.json({ ok: true, swaps });
  } catch (error) {
    console.error("[GET /api/admin/day-off-swaps] Error:", error);
    const message = error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลการสลับวันหยุดได้";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const {
      employeeId,
      workOnDate,
      offOnDate,
      swapType,
      originalSchedule,
      reason,
      status,
    } = (await request.json()) as {
      employeeId?: string;
      workOnDate?: string;
      offOnDate?: string;
      swapType?: string;
      originalSchedule?: string;
      reason?: string;
      status?: string;
    };

    if (!employeeId || !workOnDate || !offOnDate || !swapType) {
      return NextResponse.json(
        { ok: false, message: "กรุณากรอกข้อมูลการสลับวันหยุดให้ครบถ้วน" },
        { status: 400 },
      );
    }

    if (!isSwapType(swapType)) {
      return NextResponse.json(
        { ok: false, message: "ประเภทการสลับวันหยุดไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    // Verify employee exists
    const employees = await listEmployeesFromSupabase();
    const employee = employees?.find((emp) => emp.id === employeeId);
    if (!employee) {
      return NextResponse.json(
        { ok: false, message: "ไม่พบข้อมูลพนักงาน" },
        { status: 404 },
      );
    }

    console.log("[POST /api/admin/day-off-swaps] Creating swap:", {
      employeeId,
      employeeName: employee.name,
      workOnDate,
      offOnDate,
      swapType,
      status: status || "pending",
    });

    const swap = await createDayOffSwap({
      employeeId,
      workOnDate,
      offOnDate,
      swapType,
      originalSchedule: originalSchedule || null,
      reason: reason || null,
      status: isSwapStatus(status) ? status : "pending",
    });

    console.log("[POST /api/admin/day-off-swaps] Swap created successfully:", swap);

    return NextResponse.json({ ok: true, swap });
  } catch (error) {
    console.error("[POST /api/admin/day-off-swaps] Error:", error);
    const message =
      error instanceof Error ? error.message : "ไม่สามารถบันทึกการสลับวันหยุดได้";
    const isClientError =
      message.includes("กรุณา") ||
      message.includes("ไม่พบ") ||
      message.includes("ไม่ถูกต้อง") ||
      message.includes("ต้องไม่") ||
      message.includes("มีการสลับ");
    return NextResponse.json(
      { ok: false, message },
      { status: isClientError ? 400 : 500 },
    );
  }
}
