import { Suspense } from "react";
import StockMovementReportClient from "./StockMovementReportClient";
import { ReportTabs } from "../_components/ReportTabs";
import * as supabaseDirectory from "@/lib/supabaseDirectory";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";

export default async function StockMovementReportPage() {
  const [employees, stores] = await Promise.all([supabaseDirectory.listEmployeesFromSupabase(), supabaseDirectory.listStoresFromSupabase()]);

  const supabase = getSupabaseServiceClient();

  // Fetch products and units for filters
  const [productsResult, unitsResult] = await Promise.all([
    supabase.from("products").select("id, code, name, is_active").eq("is_active", true).order("name"),
    supabase.from("product_units").select("id, product_id, name, sku").order("name"),
  ]);

  const products = productsResult.data;
  const units = unitsResult.data;

  const clientEmployees = (employees || []).map((employee) => ({
    id: employee.id,
    name: employee.name,
  }));

  const clientStores = (stores || []).map((store) => ({
    id: store.id,
    name: store.name,
  }));

  type ProductData = { id: string; code: string; name: string; is_active: boolean };
  type UnitData = { id: string; product_id: string; name: string; sku: string | null };

  const clientProducts = (products || []).map((product) => ({
    id: (product as unknown as ProductData).id,
    code: (product as unknown as ProductData).code,
    name: (product as unknown as ProductData).name,
  }));

  const clientUnits = (units || []).map((unit) => ({
    id: (unit as unknown as UnitData).id,
    product_id: (unit as unknown as UnitData).product_id,
    name: (unit as unknown as UnitData).name,
    sku: (unit as unknown as UnitData).sku,
  }));

  return (
    <div className="space-y-6">
      <ReportTabs />
      <Suspense fallback={<div className="p-8 text-center text-gray-500">กำลังโหลด...</div>}>
        <StockMovementReportClient
          initialEmployees={clientEmployees}
          initialStores={clientStores}
          initialProducts={clientProducts}
          initialUnits={clientUnits}
        />
      </Suspense>
    </div>
  );
}
