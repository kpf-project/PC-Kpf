import { NextResponse } from "next/server";
import {
  deleteProductAssignment,
  listProductAssignments,
  upsertProductAssignment,
  type AssignmentQueryParams,
  type UpsertAssignmentInput,
} from "@/lib/supabaseProducts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params: AssignmentQueryParams = {
      employeeId: url.searchParams.get("employeeId") ?? undefined,
      storeId: url.searchParams.get("storeId") ?? undefined,
      onlyActiveUnits: url.searchParams.get("onlyActive") === "true",
    };
    const assignments = await listProductAssignments(params);
    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("[Assignments API] GET error:", error);
    const message = error instanceof Error ? error.message : "ไม่สามารถดึงข้อมูลการผูกสินค้าได้";
    return NextResponse.json(
      { assignments: [], error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<UpsertAssignmentInput>;
    if (!body?.productId || !body.employeeId) {
      return NextResponse.json(
        { ok: false, message: "กรุณาระบุพนักงานและสินค้า" },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.units)) {
      return NextResponse.json(
        { ok: false, message: "กรุณาระบุราคาต่อหน่วยของสินค้า" },
        { status: 400 },
      );
    }

    await upsertProductAssignment({
      productId: body.productId,
      employeeId: body.employeeId,
      storeId: body.storeId ?? null,
      units: body.units.map((unit) => ({
        unitId: unit.unitId!,
        pricePc: Number(unit.pricePc ?? 0),
        enabled: Boolean(unit.enabled),
      })),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลการผูกสินค้าได้";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { assignmentId } = (await request.json()) as { assignmentId?: string };
    if (!assignmentId) {
      return NextResponse.json(
        { ok: false, message: "กรุณาระบุข้อมูลการผูกสินค้าที่ต้องการลบ" },
        { status: 400 },
      );
    }
    await deleteProductAssignment(assignmentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถลบการผูกสินค้ากับพนักงานได้";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
