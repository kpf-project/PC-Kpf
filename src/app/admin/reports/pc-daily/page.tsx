import { Suspense } from "react";
import { Metadata } from "next";
import * as supabaseDirectory from "@/lib/supabaseDirectory";
import { PCDailyReportPageClient } from "./PCDailyReportPageClient";

export const metadata: Metadata = {
  title: "รายงาน PC รายวัน | Attendance Tracker",
  description: "ระบบดูรายงาน PC รายวัน แสดงรูปชั้นวาง สินค้าที่แกะ กิจกรรมลูกค้า และโปรโมชั่น",
  openGraph: {
    title: "รายงาน PC รายวัน",
    description: "ระบบดูรายงาน PC รายวัน แสดงรูปชั้นวาง สินค้าที่แกะ กิจกรรมลูกค้า และโปรโมชั่น",
  },
};

export default async function PCDailyReportPage() {
  // Fetch employees and stores for filter dropdowns
  const employees = await supabaseDirectory.listEmployeesFromSupabase();
  const stores = await supabaseDirectory.listStoresFromSupabase();

  const employeeOptions = (employees || []).map((emp) => ({
    id: emp.id,
    name: emp.name,
  }));

  const storeOptions = (stores || []).map((store) => ({
    id: store.id,
    name: store.name,
  }));

  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">กำลังโหลด...</div>}>
      <PCDailyReportPageClient
        employeeOptions={employeeOptions}
        storeOptions={storeOptions}
      />
    </Suspense>
  );
}
