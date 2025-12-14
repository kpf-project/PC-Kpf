"use client";

import StoresPage from "../../stores/page";

export default function StoresSection() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        แก้ไขข้อมูลสาขาเพื่อใช้กับการเช็กอินและ geofence ตรวจสอบพิกัดก่อนบันทึก
      </p>
      <div className="rounded-2xl border border-slate-100 bg-white/90">
        <StoresPage />
      </div>
    </div>
  );
}

