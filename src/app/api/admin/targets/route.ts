import { NextResponse } from "next/server";
import {
  listMonthlyTargets,
  createMonthlyTarget,
  calculateMultipleTargetProgress,
  type CreateTargetParams,
  type ListTargetsFilters,
} from "@/lib/monthlyTargets";

type MonthlyTargetType = "revenue" | "quantity" | "both";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/targets
 * List all monthly sales targets with optional filtering and progress calculation
 *
 * Query Parameters:
 * - month: Filter by target month (YYYY-MM format)
 * - employeeId: Filter by employee ID
 * - status: Filter by status (active, completed, cancelled)
 * - withProgress: Include progress calculations (true/false, default: false)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const month = url.searchParams.get("month") || undefined;
    const employeeId = url.searchParams.get("employeeId") || undefined;
    const status = url.searchParams.get("status") as
      | "active"
      | "completed"
      | "cancelled"
      | undefined;
    const withProgress = url.searchParams.get("withProgress") === "true";

    const filters: ListTargetsFilters = {};
    if (month) filters.month = month;
    if (employeeId) filters.employeeId = employeeId;
    if (status) filters.status = status;

    const targets = await listMonthlyTargets(filters);

    // If withProgress is requested, calculate progress for all targets
    if (withProgress && targets.length > 0) {
      const targetsWithProgress = await calculateMultipleTargetProgress(targets);
      return NextResponse.json({
        ok: true,
        targets: targetsWithProgress,
        count: targetsWithProgress.length,
      });
    }

    return NextResponse.json({
      ok: true,
      targets,
      count: targets.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "ไม่สามารถโหลดรายการเป้าหมายได้";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

/**
 * POST /api/admin/targets
 * Create a new monthly sales target
 *
 * Request Body:
 * {
 *   employeeId: string;
 *   employeeName: string;
 *   targetMonth: string; // YYYY-MM
 *   targetType: "revenue" | "quantity" | "both";
 *   targetRevenuePC?: number;
 *   targetQuantity?: number;
 *   notes?: string;
 *   createdBy?: string;
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      employeeId,
      employeeName,
      targetMonth,
      targetType,
      targetRevenuePC,
      targetQuantity,
      notes,
      createdBy,
    } = body as {
      employeeId?: string;
      employeeName?: string;
      targetMonth?: string;
      targetType?: MonthlyTargetType;
      targetRevenuePC?: number;
      targetQuantity?: number;
      notes?: string;
      createdBy?: string;
    };

    // Validation
    if (!employeeId || !employeeName || !targetMonth || !targetType) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "กรุณาระบุข้อมูลที่จำเป็น: employeeId, employeeName, targetMonth, targetType",
        },
        { status: 400 }
      );
    }

    // Validate target type
    if (!["revenue", "quantity", "both"].includes(targetType)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'targetType ต้องเป็น "revenue", "quantity", หรือ "both" เท่านั้น',
        },
        { status: 400 }
      );
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      return NextResponse.json(
        {
          ok: false,
          message: "รูปแบบ targetMonth ไม่ถูกต้อง ต้องเป็น YYYY-MM เท่านั้น",
        },
        { status: 400 }
      );
    }

    const params: CreateTargetParams = {
      employeeId,
      employeeName,
      targetMonth,
      targetType,
      targetRevenuePC: targetRevenuePC ?? null,
      targetQuantity: targetQuantity ?? null,
      notes: notes ?? null,
      createdBy: createdBy ?? null,
    };

    const target = await createMonthlyTarget(params);

    return NextResponse.json(
      {
        ok: true,
        target,
        message: "สร้างเป้าหมายสำเร็จ",
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ไม่สามารถสร้างเป้าหมายได้";
    const isClientError =
      message.includes("กรุณา") ||
      message.includes("มีเป้าหมาย") ||
      message.includes("รูปแบบ");
    return NextResponse.json(
      { ok: false, message },
      { status: isClientError ? 400 : 500 }
    );
  }
}
