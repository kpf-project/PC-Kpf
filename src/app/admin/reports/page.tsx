import { Suspense } from "react";
import ReportPageClient from "./ReportPageClient";
import { ReportTabs } from "./_components/ReportTabs";
import * as supabaseDirectory from "@/lib/supabaseDirectory";

export default async function ReportsPage() {
  // Fetch employees from Supabase instead of JSON file
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
    <div className="space-y-6">
      <ReportTabs />
      <Suspense fallback={<div className="p-8 text-center text-gray-500">กำลังโหลด...</div>}>
        <ReportPageClient initialEmployees={clientEmployees} />
      </Suspense>
    </div>
  );
}
