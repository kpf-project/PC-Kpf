import { NextResponse } from "next/server";
import {
  getMonthlyTarget,
  updateMonthlyTarget,
  deleteMonthlyTarget,
  calculateTargetProgress,
  type UpdateTargetParams,
} from "@/lib/monthlyTargets";

type MonthlyTargetType = "revenue" | "quantity" | "both";
type MonthlyTargetStatus = "active" | "completed" | "cancelled";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/targets/[id]
 * Get a single monthly sales target by ID
 *
 * Query Parameters:
 * - withProgress: Include progress calculations (true/false, default: false)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetId } = await params;
    const url = new URL(request.url);
    const withProgress = url.searchParams.get("withProgress") === "true";

    const target = await getMonthlyTarget(targetId);

    if (!target) {
      return NextResponse.json(
        { ok: false, message: "ไม่พบเป้าหมายที่ต้องการ" },
        { status: 404 }
      );
    }

    // If withProgress is requested, calculate progress
    if (withProgress) {
      const targetWithProgress = await calculateTargetProgress(
        target.employee_id,
        target.target_month
      );

      return NextResponse.json({
        ok: true,
        target: targetWithProgress,
      });
    }

    return NextResponse.json({
      ok: true,
      target,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ไม่สามารถโหลดเป้าหมายได้";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/targets/[id]
 * Update an existing monthly sales target
 *
 * Request Body:
 * {
 *   targetRevenuePC?: number;
 *   targetQuantity?: number;
 *   targetType?: "revenue" | "quantity" | "both";
 *   status?: "active" | "completed" | "cancelled";
 *   notes?: string;
 *   updatedBy?: string;
 * }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetId } = await params;
    const body = await request.json();

    const {
      targetRevenuePC,
      targetQuantity,
      targetType,
      status,
      notes,
      updatedBy,
    } = body as {
      targetRevenuePC?: number | null;
      targetQuantity?: number | null;
      targetType?: MonthlyTargetType;
      status?: MonthlyTargetStatus;
      notes?: string | null;
      updatedBy?: string;
    };

    // Validate targetType if provided
    if (targetType && !["revenue", "quantity", "both"].includes(targetType)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'targetType ต้องเป็น "revenue", "quantity", หรือ "both" เท่านั้น',
        },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (
      status &&
      !["active", "completed", "cancelled"].includes(status)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'status ต้องเป็น "active", "completed", หรือ "cancelled" เท่านั้น',
        },
        { status: 400 }
      );
    }

    const updateParams: UpdateTargetParams = {};
    if (targetRevenuePC !== undefined) updateParams.targetRevenuePC = targetRevenuePC;
    if (targetQuantity !== undefined) updateParams.targetQuantity = targetQuantity;
    if (targetType) updateParams.targetType = targetType;
    if (status) updateParams.status = status;
    if (notes !== undefined) updateParams.notes = notes;
    if (updatedBy) updateParams.updatedBy = updatedBy;

    const target = await updateMonthlyTarget(targetId, updateParams);

    return NextResponse.json({
      ok: true,
      target,
      message: "อัปเดตเป้าหมายสำเร็จ",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ไม่สามารถอัปเดตเป้าหมายได้";
    const isClientError =
      message.includes("กรุณา") || message.includes("ไม่พบ");
    return NextResponse.json(
      { ok: false, message },
      { status: isClientError ? 400 : 500 }
    );
  }
}

/**
 * DELETE /api/admin/targets/[id]
 * Delete a monthly sales target
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetId } = await params;

    // Check if target exists first
    const target = await getMonthlyTarget(targetId);
    if (!target) {
      return NextResponse.json(
        { ok: false, message: "ไม่พบเป้าหมายที่ต้องการลบ" },
        { status: 404 }
      );
    }

    await deleteMonthlyTarget(targetId);

    return NextResponse.json({
      ok: true,
      message: "ลบเป้าหมายสำเร็จ",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ไม่สามารถลบเป้าหมายได้";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
