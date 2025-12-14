import { NextResponse } from "next/server";
import { listStoresFromSupabase, upsertStoreRecordToSupabase } from "@/lib/supabaseDirectory";
import { triggerAutomaticBackup } from "@/lib/supabaseBackup";

// ✅ Cache GET responses for 5 minutes (300 seconds)
// This reduces database load since store data rarely changes
// Note: POST requests are never cached (by Next.js design)
export const revalidate = 300;

export async function GET() {
  const stores = await listStoresFromSupabase();
  return NextResponse.json({ stores: stores ?? [] });
}

export async function POST(request: Request) {
  try {
    const { name, province, address, latitude, longitude, radius } = (await request.json()) as {
      name?: string;
      province?: string | null;
      address?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      radius?: number | null;
    };
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { ok: false, message: "กรุณาระบุชื่อร้าน/หน่วยงาน" },
        { status: 400 },
      );
    }
    const now = new Date().toISOString();
    const store = await upsertStoreRecordToSupabase({
      id: crypto.randomUUID(),
      name,
      province,
      address,
      latitude,
      longitude,
      radius,
      createdAt: now,
      updatedAt: now,
    });

    // Trigger automatic backup after creating store
    void triggerAutomaticBackup('store', 'create', name).catch((err) =>
      console.error('[Store API] Backup failed:', err)
    );

    return NextResponse.json({ ok: true, store });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ไม่สามารถเพิ่มร้าน/หน่วยงานได้";
    const isClientError = message.includes("กรุณา") || message.includes("มีชื่อ");
    return NextResponse.json(
      { ok: false, message },
      { status: isClientError ? 400 : 500 },
    );
  }
}
