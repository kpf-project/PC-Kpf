import { Suspense } from "react";
import { getBranding } from "@/lib/supabaseBranding";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const branding = await getBranding();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-500">
          Admin Settings
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          ศูนย์ตั้งค่าทีมและช่องทางขาย
        </h1>
        <p className="text-sm text-slate-500">
          ปรับข้อมูลพนักงาน ร้านค้า สินค้า แบรนด์ และค่าใช้จ่ายประจำทีมจากหน้าเดียว ลดการสลับเมนูและช่วยให้ทำงานเร็วขึ้น
        </p>
      </header>
      <Suspense fallback={<div className="rounded-3xl border border-slate-200 bg-white/60 p-8 text-sm text-slate-500">กำลังโหลดข้อมูลตั้งค่า...</div>}>
        <SettingsClient initialBranding={branding} />
      </Suspense>
    </div>
  );
}

