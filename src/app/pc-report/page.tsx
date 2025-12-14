/**
 * PC Daily Report Page (Server Component)
 *
 * This page allows Product Consultants to submit daily reports including:
 * - Shelf photos with captions
 * - Stock usage (products unpacked)
 * - Customer activities (free text)
 * - Competitor promotion monitoring
 * - Store promotion monitoring
 */

import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import PCReportFormClient from "./PCReportFormClient";

export const dynamic = "force-dynamic";

type Employee = {
  id: string;
  name: string;
  employeeCode: string | null;
};

type Store = {
  id: string;
  name: string;
  province: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radius: number | null;
};

export default async function PCReportPage() {
  const supabase = getSupabaseServiceClient();

  // Fetch all employees
  const { data: employeesData, error: employeesError } = await supabase
    .from("employees")
    .select("id, name, employee_code")
    .order("name", { ascending: true });

  if (employeesError) {
    console.error("[PC Report] Failed to fetch employees:", employeesError);
  }

  // Fetch all stores
  const { data: storesData, error: storesError } = await supabase
    .from("stores")
    .select("id, name, province, address, latitude, longitude, radius")
    .order("name", { ascending: true });

  if (storesError) {
    console.error("[PC Report] Failed to fetch stores:", storesError);
  }

  const employees: Employee[] =
    employeesData?.map((emp) => ({
      id: emp.id,
      name: emp.name,
      employeeCode: emp.employee_code,
    })) || [];

  const stores: Store[] =
    storesData?.map((store) => ({
      id: store.id,
      name: store.name,
      province: store.province,
      address: store.address,
      latitude: store.latitude,
      longitude: store.longitude,
      radius: store.radius,
    })) || [];

  return <PCReportFormClient employees={employees} stores={stores} />;
}
