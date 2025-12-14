"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Building2, Package2, Palette, Users, Wallet, CalendarCheck2, Settings } from "lucide-react";
import type { BrandingSettings } from "@/lib/supabaseBranding";
import BrandingSettingsPanel from "../_components/BrandingSettingsPanel";
import ExpensesSection from "./sections/ExpensesSection";
import { useSearchParams } from "next/navigation";

const EmployeesSection = dynamic(() => import("./sections/EmployeesSection"), {
  ssr: false,
  loading: () => <SectionFallback label="กำลังโหลดข้อมูลพนักงาน..." />,
});

const StoresSection = dynamic(() => import("./sections/StoresSection"), {
  ssr: false,
  loading: () => <SectionFallback label="กำลังโหลดข้อมูลร้านค้า..." />,
});

const ProductsSection = dynamic(() => import("./sections/ProductsSection"), {
  ssr: false,
  loading: () => <SectionFallback label="กำลังโหลดข้อมูลสินค้า..." />,
});

const LeavesSection = dynamic(() => import("./sections/LeavesSection"), {
  ssr: false,
  loading: () => <SectionFallback label="กำลังโหลดข้อมูลการลา..." />,
});

const StockAdjustmentSection = dynamic(() => import("./sections/StockAdjustmentSection"), {
  ssr: false,
  loading: () => <SectionFallback label="กำลังโหลดฟังก์ชันปรับสต็อก..." />,
});

type SectionId = "employees" | "stores" | "products" | "branding" | "expenses" | "leaves" | "stock-adjustment";

type SectionDefinition = {
  id: SectionId;
  label: string;
  caption: string;
  icon: ReactNode;
};

const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    id: "employees",
    label: "รายชื่อพนักงาน",
    caption: "จัดการข้อมูลพนักงาน ทีม และสิทธิ์การใช้งาน",
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: "stores",
    label: "ร้านค้า / หน่วยงาน",
    caption: "ตั้งค่าร้านค้าและสาขาที่ใช้ในการลงเวลาและรายงาน",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    id: "products",
    label: "สินค้า",
    caption: "อัปเดตรายการสินค้าและการผูกพนักงานต่อสินค้า",
    icon: <Package2 className="h-4 w-4" />,
  },
  {
    id: "branding",
    label: "Branding",
    caption: "ปรับโลโก้และภาพลักษณ์ที่แสดงในทุกหน้าจอ",
    icon: <Palette className="h-4 w-4" />,
  },
  {
    id: "leaves",
    label: "จัดการการลา",
    caption: "อนุมัติและติดตามข้อมูลการลาของพนักงาน",
    icon: <CalendarCheck2 className="h-4 w-4" />,
  },
  {
    id: "expenses",
    label: "ค่าใช้จ่ายประจำทีม",
    caption: "ควบคุมหมวดหมู่ค่าใช้จ่ายและสิทธิ์การเบิกจ่าย",
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    id: "stock-adjustment",
    label: "ปรับสต็อกสินค้า",
    caption: "เพิ่ม ลด หรือกำหนดยอดสต็อกใหม่ (ตรวจนับ, ของเสีย, สูญหาย)",
    icon: <Settings className="h-4 w-4" />,
  },
];

const SECTION_ID_SET = new Set<SectionId>(SECTION_DEFINITIONS.map((section) => section.id));

type SettingsClientProps = {
  initialBranding: BrandingSettings;
};

export default function SettingsClient({ initialBranding }: SettingsClientProps) {
  const searchParams = useSearchParams();

  const sectionParam = searchParams.get("section");
  const normalizedSectionFromQuery = SECTION_ID_SET.has(sectionParam as SectionId)
    ? (sectionParam as SectionId)
    : null;

  const [activeSection, setActiveSection] = useState<SectionId>(
    normalizedSectionFromQuery ?? "employees",
  );
  const pendingSectionRef = useRef(false);

  useEffect(() => {
    const normalized = normalizedSectionFromQuery ?? "employees";
    if (pendingSectionRef.current) {
      if (normalized === activeSection) {
        pendingSectionRef.current = false;
      }
      return;
    }
    if (normalized !== activeSection) {
      setActiveSection(normalized);
    }
  }, [normalizedSectionFromQuery, activeSection]);

  const activeDefinition = useMemo(
    () => SECTION_DEFINITIONS.find((section) => section.id === activeSection),
    [activeSection],
  );

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-3xl border border-white/70 bg-white/92 p-6 shadow-[0_60px_180px_-120px_rgba(37,99,235,0.7)] lg:backdrop-blur-sm">
        {activeDefinition && (
          <header className="mb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-500">
              {activeDefinition.icon}
              <span>{activeDefinition.label}</span>
            </div>
          </header>
        )}
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 sm:p-6">
          {renderSection(activeSection, initialBranding)}
        </div>
      </section>
    </div>
  );
}

function renderSection(section: SectionId, branding: BrandingSettings) {
  switch (section) {
    case "employees":
      return <EmployeesSection />;
    case "stores":
      return <StoresSection />;
    case "products":
      return <ProductsSection />;
    case "branding":
      return <BrandingSettingsPanel initialBranding={branding} />;
    case "leaves":
      return <LeavesSection />;
    case "expenses":
      return <ExpensesSection />;
    case "stock-adjustment":
      return <StockAdjustmentSection />;
    default:
      return null;
  }
}

function SectionFallback({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-slate-400">
      <span className="inline-flex h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-b-transparent" />
      <p className="text-xs">{label}</p>
    </div>
  );
}
