import { NextResponse } from "next/server";
import { updateCategory, deleteCategory, getCategories } from "@/lib/supabaseCategories";
import { triggerAutomaticBackup } from "@/lib/supabaseBackup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { name, color } = (await request.json()) as {
      name?: string;
      color?: string;
    };
    if (!name) {
      return NextResponse.json(
        { ok: false, message: "กรุณาระบุชื่อหมวดหมู่" },
        { status: 400 },
      );
    }
    const category = await updateCategory(id, { name, color: color || "#3b82f6" });

    // Trigger automatic backup after updating category
    void triggerAutomaticBackup('category', 'update', name).catch((err) =>
      console.error('[Category API] Backup failed:', err)
    );

    return NextResponse.json({ ok: true, category });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ไม่สามารถแก้ไขหมวดหมู่ได้";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Get category name before deletion for backup
    const categories = await getCategories();
    const category = categories.find((c) => c.id === id);
    const categoryName = category?.name ?? 'Unknown';

    await deleteCategory(id);

    // Trigger automatic backup after deleting category
    void triggerAutomaticBackup('category', 'delete', categoryName).catch((err) =>
      console.error('[Category API] Backup failed:', err)
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ไม่สามารถลบหมวดหมู่ได้";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
