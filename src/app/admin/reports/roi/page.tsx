import { Suspense } from "react";
import ROIReportPageClient from "./RoiReportPageClient";
import { ReportTabs } from "../_components/ReportTabs";
import * as supabaseDirectory from "@/lib/supabaseDirectory";

export default async function RoiReportsPage() {
  const employees = await supabaseDirectory.listEmployeesFromSupabase();

  const clientEmployees = (employees || []).map((employee) => ({
    id: employee.id,
    name: employee.name,
    phone: employee.phone ?? null,
    province: employee.province ?? null,
    region: employee.region ?? null,
    defaultStoreId: employee.defaultStoreId ?? null,
  }));

  return (
    <div className="space-y-6 print:space-y-0">
      <ReportTabs />
      <Suspense fallback={<div className="p-8 text-center text-gray-500">กำลังโหลด...</div>}>
        <ROIReportPageClient initialEmployees={clientEmployees} />
      </Suspense>
    </div>
  );
}
