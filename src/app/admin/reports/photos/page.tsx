import { Suspense } from "react";
import PhotoReportPageClient from "./PhotoReportPageClient";
import { ReportTabs } from "../_components/ReportTabs";
import * as supabaseDirectory from "@/lib/supabaseDirectory";

export const metadata = {
  title: "รายงานภาพถ่ายลงเวลา | Attendance Tracker",
  description: "ตรวจสอบภาพถ่ายการเข้า-ออกงานพร้อม GPS และข้อมูลตำแหน่ง",
};

export default async function PhotoReportPage() {
  // Fetch employees and stores server-side for better performance
  const [employees, stores] = await Promise.all([
    supabaseDirectory.listEmployeesFromSupabase(),
    supabaseDirectory.listStoresFromSupabase(),
  ]);

  // Transform to minimal data needed by client
  const clientEmployees = (employees || [])
    .map((emp) => ({
      id: emp.id,
      name: emp.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));

  const clientStores = (stores || []).map((store) => ({
    id: store.id,
    name: store.name,
  })).sort((a, b) => a.name.localeCompare(b.name, "th"));

  return (
    <div className="space-y-6">
      <ReportTabs />
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">กำลังโหลด...</p>
            </div>
          </div>
        }
      >
        <PhotoReportPageClient
          initialEmployees={clientEmployees}
          initialStores={clientStores}
        />
      </Suspense>
    </div>
  );
}
