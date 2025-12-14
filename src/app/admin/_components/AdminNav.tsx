"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  BarChart3,
  PanelsTopLeft,
  Settings,
  ChevronDown,
  Users,
  Building2,
  Package2,
  Palette,
  CalendarCheck2,
  Wallet,
  ScrollText,
  Database,
  Shield,
} from "lucide-react";

type DropdownItem = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

type MenuItem = {
  label: string;
  caption: string;
  href: string;
  icon: typeof LayoutDashboard;
  dropdown?: DropdownItem[];
};

const DASHBOARD_DROPDOWN: DropdownItem[] = [
  { label: "Dashboard", href: "/admin", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Reports", href: "/admin/reports", icon: <BarChart3 className="h-4 w-4" /> },
];

const SETTINGS_DROPDOWN: DropdownItem[] = [
  { label: "รายชื่อพนักงาน", href: "/admin/settings?section=employees", icon: <Users className="h-4 w-4" /> },
  { label: "ร้านค้า / หน่วยงาน", href: "/admin/settings?section=stores", icon: <Building2 className="h-4 w-4" /> },
  { label: "สินค้า", href: "/admin/settings?section=products", icon: <Package2 className="h-4 w-4" /> },
  { label: "Branding", href: "/admin/settings?section=branding", icon: <Palette className="h-4 w-4" /> },
  { label: "จัดการการลา", href: "/admin/settings?section=leaves", icon: <CalendarCheck2 className="h-4 w-4" /> },
  { label: "ค่าใช้จ่ายประจำทีม", href: "/admin/settings?section=expenses", icon: <Wallet className="h-4 w-4" /> },
  { label: "ปรับสต็อกสินค้า", href: "/admin/settings?section=stock-adjustment", icon: <Settings className="h-4 w-4" /> },
];

const LOGS_DROPDOWN: DropdownItem[] = [
  { label: "System Logs", href: "/admin/logs", icon: <ScrollText className="h-4 w-4" /> },
  { label: "จัดการ PIN", href: "/admin/user-pins", icon: <Shield className="h-4 w-4" /> },
  { label: "Backup", href: "/admin/logs/backups", icon: <Database className="h-4 w-4" /> },
];

// Mobile-only attendance report menu item (no dropdown, direct link)
const MOBILE_ATTENDANCE_ITEM: MenuItem = {
  label: "รายงานลงเวลา",
  caption: "Attendance",
  href: "/admin/reports",
  icon: BarChart3,
};

const MENU_ITEMS: MenuItem[] = [
  {
    label: "Dashboard",
    caption: "ภาพรวม",
    href: "/admin",
    icon: LayoutDashboard,
    dropdown: DASHBOARD_DROPDOWN,
  },
  {
    label: "Settings",
    caption: "ตั้งค่า",
    href: "/admin/settings",
    icon: Settings,
    dropdown: SETTINGS_DROPDOWN,
  },
  {
    label: "Logs",
    caption: "ระบบ",
    href: "/admin/logs",
    icon: ScrollText,
    dropdown: LOGS_DROPDOWN,
  },
];

export default function AdminNav() {
  const pathname = usePathname();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const isDashboard = pathname === '/admin';

  // Show AdminNav header only for non-dashboard pages
  const showHeader = !isDashboard;

  const getIsActive = (menuItem: MenuItem): boolean => {
    if (menuItem.href === "/admin") {
      return pathname === "/admin" || pathname.startsWith("/admin/reports");
    }
    if (menuItem.href === "/admin/settings") {
      return pathname.startsWith("/admin/settings");
    }
    if (menuItem.href === "/admin/logs") {
      return pathname.startsWith("/admin/logs") || pathname.startsWith("/admin/user-pins");
    }
    return false;
  };

  const handleMouseEnter = (label: string) => {
    // Only enable hover on desktop
    if (window.innerWidth >= 768) {
      setOpenDropdown(label);
    }
  };

  const handleMouseLeave = () => {
    if (window.innerWidth >= 768) {
      setOpenDropdown(null);
    }
  };

  const handleClick = (label: string) => {
    // Toggle on mobile
    setOpenDropdown(openDropdown === label ? null : label);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/90 p-6 shadow-[0_35px_120px_-110px_rgba(37,99,235,0.9)]">
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-48"
        aria-hidden
        style={{
          background: 'linear-gradient(270deg, rgba(191, 219, 254, 0.35), rgba(191, 219, 254, 0))',
        }}
      />
      <div className="relative z-10 flex flex-col gap-4">
        {showHeader && (
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-600 via-indigo-500 to-sky-500 text-white shadow-sm">
              <PanelsTopLeft className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Admin Console</p>
              <p className="text-xs text-slate-500">
                จัดการข้อมูลพนักงาน ร้านค้า สินค้า และรายงานได้ในที่เดียว
              </p>
            </div>
          </div>
        )}

        <nav className="flex flex-wrap gap-2">
          {/* Desktop: Show Dashboard with dropdown */}
          {/* Mobile: Show Dashboard with dropdown + separate attendance link */}
          {MENU_ITEMS.map((item, index) => {
            const isActive = getIsActive(item);
            const Icon = item.icon;
            const isOpen = openDropdown === item.label;
            const hasDropdown = item.dropdown && item.dropdown.length > 0;

            return (
              <>
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => hasDropdown && handleMouseEnter(item.label)}
                onMouseLeave={handleMouseLeave}
              >
                {hasDropdown ? (
                  <button
                    type="button"
                    onClick={() => handleClick(item.label)}
                    className={`flex min-w-[180px] items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-150 ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 font-semibold text-white shadow-[0_20px_50px_-35px_rgba(37,99,235,0.8)]"
                        : "border border-transparent bg-white/70 text-slate-600 hover:border-blue-200 hover:text-blue-600"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                          isActive
                            ? "border-white/30 bg-white/20"
                            : "border-blue-100 bg-blue-50"
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-blue-600"}`} />
                      </div>
                      <div className="flex flex-col text-left">
                        <span>{item.label}</span>
                        <span
                          className={`text-[11px] uppercase tracking-wide ${
                            isActive ? "text-white/80" : "text-slate-400"
                          }`}
                        >
                          {item.caption}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      } ${isActive ? "text-white" : "text-slate-400"}`}
                    />
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={`flex min-w-[180px] items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-150 ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 font-semibold text-white shadow-[0_20px_50px_-35px_rgba(37,99,235,0.8)]"
                        : "border border-transparent bg-white/70 text-slate-600 hover:border-blue-200 hover:text-blue-600"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                        isActive
                          ? "border-white/30 bg-white/20"
                          : "border-blue-100 bg-blue-50"
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-blue-600"}`} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span>{item.label}</span>
                      <span
                        className={`text-[11px] uppercase tracking-wide ${
                          isActive ? "text-white/80" : "text-slate-400"
                        }`}
                      >
                        {item.caption}
                      </span>
                    </div>
                  </Link>
                )}

                {/* Dropdown Menu */}
                {hasDropdown && isOpen && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-white/70 bg-white/95 p-2 shadow-[0_20px_60px_-25px_rgba(37,99,235,0.5)] backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
                    {item.dropdown!.map((dropdownItem) => (
                      <Link
                        key={dropdownItem.href}
                        href={dropdownItem.href}
                        onClick={() => setOpenDropdown(null)}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-700 transition-all hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-700"
                      >
                        {dropdownItem.icon && (
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            {dropdownItem.icon}
                          </span>
                        )}
                        <span className="font-medium">{dropdownItem.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile-only: Show attendance report link after Dashboard, hide on desktop */}
              {index === 0 && (
                <Link
                  href={MOBILE_ATTENDANCE_ITEM.href}
                  className={`md:hidden flex min-w-[180px] items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-150 ${
                    pathname.startsWith('/admin/reports')
                      ? "bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 font-semibold text-white shadow-[0_20px_50px_-35px_rgba(37,99,235,0.8)]"
                      : "border border-transparent bg-white/70 text-slate-600 hover:border-blue-200 hover:text-blue-600"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                      pathname.startsWith('/admin/reports')
                        ? "border-white/30 bg-white/20"
                        : "border-blue-100 bg-blue-50"
                    }`}
                  >
                    <BarChart3 className={`h-5 w-5 ${pathname.startsWith('/admin/reports') ? "text-white" : "text-blue-600"}`} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span>{MOBILE_ATTENDANCE_ITEM.label}</span>
                    <span
                      className={`text-[11px] uppercase tracking-wide ${
                        pathname.startsWith('/admin/reports') ? "text-white/80" : "text-slate-400"
                      }`}
                    >
                      {MOBILE_ATTENDANCE_ITEM.caption}
                    </span>
                  </div>
                </Link>
              )}
              </>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
