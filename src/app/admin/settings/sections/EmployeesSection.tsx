"use client";

import EmployeesPage from "../../employees/page";

export default function EmployeesSection() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        ฟอร์มจะบันทึกผ่าน API เดิมอัตโนมัติ ทุกการแก้ไขมีผลกับการเลือกพนักงานในระบบบันทึกเวลาและยอดขาย
      </p>
      <div className="rounded-2xl border border-slate-100 bg-white/90">
        <EmployeesPage />
      </div>
    </div>
  );
}

