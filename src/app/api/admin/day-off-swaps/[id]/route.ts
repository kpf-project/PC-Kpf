import { NextResponse } from "next/server";
import { listEmployeesFromSupabase } from "@/lib/supabaseDirectory";
import {
  deleteDayOffSwap,
  updateDayOffSwap,
  getDayOffSwap,
  type SwapStatus,
  type SwapType,
} from "@/lib/supabaseDayOffSwaps";


type ParamsPromise = {
  params: Promise<{ id: string }>;
};

const isSwapStatus = (value: unknown): value is SwapStatus =>
  typeof value === "string" &&
  (value === "pending" || value === "approved" || value === "rejected" || value === "cancelled");

const isSwapType = (value: unknown): value is SwapType =>
  typeof value === "string" &&
  (value === "regular-day-off" || value === "public-holiday");

export async function GET(request: Request, context: ParamsPromise) {
  try {
    const { id } = await context.params;

    const swap = await getDayOffSwap(id);

    if (!swap) {
      return NextResponse.json(
        { ok: false, message: "ไม่พบข้อมูลการสลับวันหยุด" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, swap });
  } catch (error) {
    console.error("[GET /api/admin/day-off-swaps/[id]] Error:", error);
    const message = error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลการสลับวันหยุดได้";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: ParamsPromise) {
  try {
    const {
      workOnDate,
      offOnDate,
      swapType,
      originalSchedule,
      reason,
      status,
      reviewedBy,
      adminNotes,
    } = (await request.json()) as Partial<{
      workOnDate: string;
      offOnDate: string;
      swapType: string;
      originalSchedule: string;
      reason: string;
      status: string;
      reviewedBy: string;
      adminNotes: string;
    }>;

    const { id } = await context.params;

    // Get existing swap to verify it exists
    const existingSwap = await getDayOffSwap(id);
    if (!existingSwap) {
      return NextResponse.json(
        { ok: false, message: "ไม่พบข้อมูลการสลับวันหยุด" },
        { status: 404 },
      );
    }

    // Validate swapType if provided
    if (swapType && !isSwapType(swapType)) {
      return NextResponse.json(
        { ok: false, message: "ประเภทการสลับวันหยุดไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    // Validate reviewedBy if provided
    if (reviewedBy) {
      const employees = await listEmployeesFromSupabase();
      const reviewer = employees?.find((emp) => emp.id === reviewedBy);
      if (!reviewer) {
        return NextResponse.json(
          { ok: false, message: "ไม่พบข้อมูลผู้อนุมัติ" },
          { status: 404 },
        );
      }
    }

    console.log("[PUT /api/admin/day-off-swaps/[id]] Updating swap:", {
      id,
      workOnDate: workOnDate || existingSwap.workOnDate,
      offOnDate: offOnDate || existingSwap.offOnDate,
      status: status || existingSwap.status,
    });

    const swap = await updateDayOffSwap(id, {
      workOnDate,
      offOnDate,
      swapType: swapType && isSwapType(swapType) ? swapType : undefined,
      originalSchedule: originalSchedule !== undefined ? originalSchedule : undefined,
      reason: reason !== undefined ? reason : undefined,
      status: status && isSwapStatus(status) ? status : undefined,
      reviewedBy: reviewedBy !== undefined ? reviewedBy : undefined,
      adminNotes: adminNotes !== undefined ? adminNotes : undefined,
    });

    console.log("[PUT /api/admin/day-off-swaps/[id]] Swap updated successfully");

    return NextResponse.json({ ok: true, swap });
  } catch (error) {
    console.error("[PUT /api/admin/day-off-swaps/[id]] Error:", error);
    const message =
      error instanceof Error ? error.message : "ไม่สามารถแก้ไขการสลับวันหยุดได้";
    const isClientError =
      message.includes("กรุณา") ||
      message.includes("ไม่พบ") ||
      message.includes("ไม่ถูกต้อง") ||
      message.includes("ต้องไม่");
    return NextResponse.json(
      { ok: false, message },
      { status: isClientError ? 400 : 500 },
    );
  }
}

export async function DELETE(request: Request, context: ParamsPromise) {
  try {
    const { id } = await context.params;

    console.log("[DELETE /api/admin/day-off-swaps/[id]] Deleting swap:", id);

    await deleteDayOffSwap(id);

    console.log("[DELETE /api/admin/day-off-swaps/[id]] Swap deleted successfully");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/admin/day-off-swaps/[id]] Error:", error);
    const message =
      error instanceof Error ? error.message : "ไม่สามารถลบการสลับวันหยุดได้";
    const isClientError = message.includes("ไม่พบ");
    return NextResponse.json(
      { ok: false, message },
      { status: isClientError ? 404 : 500 },
    );
  }
}
