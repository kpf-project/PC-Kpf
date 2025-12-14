import { Suspense } from "react";
import SalesComparisonPageClient from "./SalesComparisonPageClient";
import { ReportTabs } from "../_components/ReportTabs";
import * as supabaseDirectory from "@/lib/supabaseDirectory";

export default async function SalesComparisonPage() {
  const [employees, stores] = await Promise.all([supabaseDirectory.listEmployeesFromSupabase(), supabaseDirectory.listStoresFromSupabase()]);

  const clientEmployees = (employees || []).map((employee) => ({
    id: employee.id,
    name: employee.name,
    employeeCode: employee.employeeCode ?? null,
    phone: employee.phone ?? null,
    province: employee.province ?? null,
    region: employee.region ?? null,
    regularDayOff: employee.regularDayOff ?? null,
    defaultStoreId: employee.defaultStoreId ?? null,
  }));

  const clientStores = (stores || []).map((store) => ({
    id: store.id,
    name: store.name,
    province: store.province ?? null,
  }));

  return (
    <div className="space-y-6">
      <ReportTabs />
      <Suspense fallback={<div className="p-8 text-center text-gray-500">กำลังโหลด...</div>}>
        <SalesComparisonPageClient
          initialEmployees={clientEmployees}
          initialStores={clientStores}
        />
      </Suspense>
    </div>
  );
}
