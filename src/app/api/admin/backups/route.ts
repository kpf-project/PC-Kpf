import { NextResponse } from "next/server";
import { listBackups, restoreFromBackup } from "@/lib/autoBackup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/backups
 * List all available backups
 */
export async function GET() {
  try {
    const backups = await listBackups();

    return NextResponse.json({
      ok: true,
      data: backups.map((b) => ({
        name: b.name,
        timestamp: b.timestamp.toISOString(),
        timestampFormatted: b.timestamp.toLocaleString("th-TH", {
          timeZone: "Asia/Bangkok",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
    });
  } catch (error) {
    console.error("[backups] List failed:", error);
    return NextResponse.json(
      { ok: false, message: "ไม่สามารถดึงรายการสำรองข้อมูลได้" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/backups/restore
 * Restore from a specific backup
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { backupName: string };

    if (!body.backupName) {
      return NextResponse.json(
        { ok: false, message: "กรุณาระบุชื่อไฟล์สำรอง" },
        { status: 400 }
      );
    }

    const success = await restoreFromBackup(body.backupName);

    if (!success) {
      return NextResponse.json(
        { ok: false, message: "ไม่สามารถกู้คืนข้อมูลได้" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "กู้คืนข้อมูลสำเร็จ",
    });
  } catch (error) {
    console.error("[backups] Restore failed:", error);
    return NextResponse.json(
      { ok: false, message: "ไม่สามารถกู้คืนข้อมูลได้" },
      { status: 500 }
    );
  }
}
