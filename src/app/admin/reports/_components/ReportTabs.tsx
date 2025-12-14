"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "รายงานลงเวลา", href: "/admin/reports" },
  { label: "รายงานภาพถ่าย", href: "/admin/reports/photos" },
  { label: "รายงานยอดขาย", href: "/admin/reports/sales" },
  { label: "รายงานยอดขายรายสินค้า", href: "/admin/reports/products" },
  { label: "รายงานสรุปรายบุคคล", href: "/admin/reports/individual" },
  { label: "รายงาน ROI", href: "/admin/reports/roi" },
  { label: "รายงานเปรียบเทียบยอดขาย", href: "/admin/reports/sales-comparison" },
  { label: "รายงานเคลื่อนไหวสต็อก", href: "/admin/reports/stock-movement" },
];

export function ReportTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-4 print:hidden">
      <div className="relative">
        {/* Scroll container */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="inline-flex gap-2 rounded-xl border border-slate-200/60 bg-slate-50/50 p-1.5 shadow-sm">
            {TABS.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`inline-flex items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                      : "text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Scroll indicator gradient - right side */}
        <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-white/90 to-transparent md:hidden" />

        {/* Scroll hint text */}
        <div className="mt-1 text-center text-[10px] text-blue-500/60 md:hidden">
          ← เลื่อนดูเมนูเพิ่มเติม →
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
