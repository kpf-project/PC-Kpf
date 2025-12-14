import { listEmployeesFromSupabase, listStoresFromSupabase } from "@/lib/supabaseDirectory";
import {
  getDashboardSnapshot,
  getDashboardMetrics,
} from "@/lib/configStore";
import EnterpriseDashboardClient from "./EnterpriseDashboardClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [snapshot, metrics, employees, stores] = await Promise.all([
    getDashboardSnapshot(),
    getDashboardMetrics(),
    listEmployeesFromSupabase(),
    listStoresFromSupabase(),
  ]);

  const simplifiedEmployees = employees?.map((employee) => ({
    id: employee.id,
    name: employee.name,
    province: employee.province ?? null,
  })) ?? [];

  const simplifiedStores = stores?.map((store) => ({
    id: store.id,
    name: store.name,
    province: store.province ?? null,
    address: store.address ?? null,
    latitude: store.latitude ?? null,
    longitude: store.longitude ?? null,
  })) ?? [];

  return (
    <EnterpriseDashboardClient
      snapshot={snapshot}
      initialMetrics={metrics}
      employees={simplifiedEmployees}
      stores={simplifiedStores}
    />
  );
}
