import { Suspense } from "react";
import IndividualReportPageClient from "./IndividualReportPageClient";
import { ReportTabs } from "../_components/ReportTabs";

export default async function IndividualReportsPage() {
  return (
    <div className="space-y-6">
      <ReportTabs />
      <Suspense fallback={<div className="p-8 text-center text-gray-500">กำลังโหลด...</div>}>
        <IndividualReportPageClient />
      </Suspense>
    </div>
  );
}
