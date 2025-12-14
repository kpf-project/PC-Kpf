import { Suspense } from "react";
import ProductSalesReportPageClient from "./ProductSalesReportPageClient";
import { ReportTabs } from "../_components/ReportTabs";
import * as supabaseDirectory from "@/lib/supabaseDirectory";
import { getBranding } from "@/lib/supabaseBranding";
import { getProductSalesReport } from "@/lib/configStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProductSalesReportPage() {
  const [employees, branding, initialReport] = await Promise.all([
    supabaseDirectory.listEmployeesFromSupabase(),
    getBranding(),
    getProductSalesReport(),
  ]);

  const simplifiedEmployees = (employees || []).map((employee) => ({
    id: employee.id,
    name: employee.name,
    province: employee.province ?? null,
    region: employee.region ?? null,
  }));

  return (
    <div className="space-y-6">
      <ReportTabs />
      <Suspense fallback={<div className="p-8 text-center text-gray-500">กำลังโหลด...</div>}>
        <ProductSalesReportPageClient
          initialReport={initialReport}
          employees={simplifiedEmployees}
          branding={branding}
        />
      </Suspense>
    </div>
  );
}
