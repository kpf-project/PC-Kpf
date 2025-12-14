import { NextResponse } from "next/server";
import { listProductAssignments, listProductCatalog } from "@/lib/supabaseProducts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  if (view === "catalog") {
    const products = await listProductCatalog();
    return NextResponse.json({ products });
  }

  const assignments = await listProductAssignments({
    employeeId: url.searchParams.get("employeeId") ?? undefined,
    storeId: url.searchParams.get("storeId") ?? undefined,
    onlyActiveUnits: url.searchParams.get("onlyActive") === "true",
  });

  return NextResponse.json({ assignments });
}

export async function POST() {
  return NextResponse.json(
    { ok: false, message: "กรุณาเรียกใช้งาน API ใหม่สำหรับจัดการสินค้า" },
    { status: 405 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { ok: false, message: "กรุณาเรียกใช้งาน API ใหม่สำหรับจัดการสินค้า" },
    { status: 405 },
  );
}
