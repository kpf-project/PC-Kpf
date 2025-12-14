import { NextResponse } from "next/server";
import { listStoresFromSupabase } from "@/lib/supabaseDirectory";
import { upsertStoreRecordToSupabase, deleteStoreRecordFromSupabase } from "@/lib/supabaseDirectory";
import { triggerAutomaticBackup } from "@/lib/supabaseBackup";

type ParamsPromise = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: ParamsPromise) {
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
    const { id } = await context.params;
    const now = new Date().toISOString();
    const store = await upsertStoreRecordToSupabase({
      id,
      name,
      province,
      address,
      latitude,
      longitude,
      radius,
      createdAt: now,
      updatedAt: now,
    });

    // Trigger automatic backup after updating store
    void triggerAutomaticBackup('store', 'update', name).catch((err) =>
      console.error('[Store API] Backup failed:', err)
    );

    return NextResponse.json({ ok: true, store });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ไม่สามารถแก้ไขร้าน/หน่วยงานได้";
    const isClientError =
      message.includes("กรุณา") || message.includes("ไม่พบ") || message.includes("มีชื่อ");
    return NextResponse.json(
      { ok: false, message },
      { status: isClientError ? 400 : 500 },
    );
  }
}

export async function DELETE(request: Request, context: ParamsPromise) {
  try {
    const { id } = await context.params;

    // Get store name before deletion for backup
    const stores = await listStoresFromSupabase();
    const store = stores?.find((s) => s.id === id);
    const storeName = store?.name ?? 'Unknown';

    await deleteStoreRecordFromSupabase(id);

    // Trigger automatic backup after deleting store
    void triggerAutomaticBackup('store', 'delete', storeName).catch((err) =>
      console.error('[Store API] Backup failed:', err)
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ไม่สามารถลบร้าน/หน่วยงานได้";
    const isClientError = message.includes("ไม่พบ");
    return NextResponse.json(
      { ok: false, message },
      { status: isClientError ? 404 : 500 },
    );
  }
}
