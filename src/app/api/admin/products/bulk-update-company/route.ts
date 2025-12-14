import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BulkUpdateCompanyRequest = {
  productIds: string[];
  companyId: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<BulkUpdateCompanyRequest>;

    if (!body.productIds || !Array.isArray(body.productIds) || body.productIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: "กรุณาระบุสินค้าที่ต้องการอัปเดต" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Update all products at once
    const { error } = await supabase
      .from("products")
      .update({
        company_id: body.companyId ?? null,
        updated_at: new Date().toISOString(),
      })
      .in("id", body.productIds);

    if (error) {
      console.error("[Bulk Update Company] Error:", error);
      throw new Error("ไม่สามารถอัปเดตข้อมูลบริษัทได้");
    }

    return NextResponse.json({
      ok: true,
      message: `อัปเดตบริษัทให้ ${body.productIds.length} สินค้าเรียบร้อย`,
      updatedCount: body.productIds.length,
    });
  } catch (error) {
    console.error("[Bulk Update Company] Error:", error);
    const message = error instanceof Error ? error.message : "ไม่สามารถอัปเดตข้อมูลบริษัทได้";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
