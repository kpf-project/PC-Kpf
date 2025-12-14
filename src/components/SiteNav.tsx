"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { getBrandingLogoSrc } from "@/lib/branding";
import { useAuth } from "@/contexts/AuthContext";
import { useModal } from "@/contexts/ModalContext";
import type { UserRole } from "@/types/auth";
import {
  Clock,
  ShoppingCart,
  Package,
  LayoutDashboard,
  Settings,
  FileText,
  BarChart3,
  Users,
  Building2,
  Package2,
  Palette,
  CalendarCheck2,
  Wallet,
  ChevronDown,
  LogOut,
  User,
  Key,
  type LucideIcon,
  DatabaseBackup,
  ArrowLeftRight,
} from "lucide-react";

type DropdownItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  requiredRole?: UserRole[];
};

type NavLink = {
  label: string;
  href: string;
  icon: LucideIcon;
  dropdown?: DropdownItem[];
  requiredRole?: UserRole[];
};

const ATTENDANCE_DROPDOWN: DropdownItem[] = [
  {
    label: "ลงเวลา",
    href: "/",
    icon: Clock,
    requiredRole: ['employee', 'sales', 'admin', 'super_admin']
  },
  {
    label: "แจ้งวันลา",
    href: "/admin/settings?section=leaves",
    icon: CalendarCheck2,
    requiredRole: ['employee', 'sales', 'admin', 'super_admin']
  },
  {
    label: "จัดการสลับวันหยุด",
    href: "/admin/day-off-swaps",
    icon: ArrowLeftRight,
    requiredRole: ['employee', 'sales', 'admin', 'super_admin']
  },
];

const DASHBOARD_DROPDOWN: DropdownItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    requiredRole: ['sales', 'admin', 'super_admin']
  },
  {
    label: "Reports",
    href: "/admin/reports",
    icon: BarChart3,
    requiredRole: ['sales', 'admin', 'super_admin']
  },
];

const LOGS_DROPDOWN: DropdownItem[] = [
  {
    label: "System Logs",
    href: "/admin/logs",
    icon: FileText,
    requiredRole: ['super_admin']
  },
  {
    label: "จัดการPIN",
    href: "/admin/user-pins",
    icon: Key,
    requiredRole: ['super_admin']
  },
  {
    label: "Backup",
    href: "/admin/logs/backups",
    icon: DatabaseBackup,
    requiredRole: ['super_admin']
  }
];

const SETTINGS_DROPDOWN: DropdownItem[] = [
  {
    label: "รายชื่อพนักงาน",
    href: "/admin/settings?section=employees",
    icon: Users,
    requiredRole: ['admin', 'super_admin']
  },
  {
    label: "ร้านค้า",
    href: "/admin/settings?section=stores",
    icon: Building2,
    requiredRole: ['admin', 'super_admin']
  },
  {
    label: "สินค้า",
    href: "/admin/settings?section=products",
    icon: Package2,
    requiredRole: ['admin', 'super_admin']
  },
  {
    label: "บริษัท",
    href: "/admin/settings/companies",
    icon: Building2,
    requiredRole: ['admin', 'super_admin']
  },
  {
    label: "Branding",
    href: "/admin/settings?section=branding",
    icon: Palette,
    requiredRole: ['admin', 'super_admin']
  },
  {
    label: "ค่าใช้จ่าย",
    href: "/admin/settings?section=expenses",
    icon: Wallet,
    requiredRole: ['admin', 'super_admin']
  },
  {
    label: "ปรับสต็อกสินค้า",
    href: "/admin/settings?section=stock-adjustment",
    icon: Settings,
    requiredRole: ['admin', 'super_admin']
  },
];

const NAV_LINKS: NavLink[] = [
  {
    label: "ลงเวลา",
    href: "/",
    icon: Clock,
    dropdown: ATTENDANCE_DROPDOWN,
    requiredRole: ['employee', 'sales', 'admin', 'super_admin']
  },
  {
    label: "บันทึกยอดขาย",
    href: "/sales",
    icon: ShoppingCart,
    requiredRole: ['employee', 'sales', 'admin', 'super_admin']
  },
  {
    label: "สต็อก",
    href: "/stock",
    icon: Package,
    requiredRole: ['employee', 'sales', 'admin', 'super_admin']
  },
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    dropdown: DASHBOARD_DROPDOWN,
    requiredRole: ['sales', 'admin', 'super_admin']
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    dropdown: SETTINGS_DROPDOWN,
    requiredRole: ['admin', 'super_admin']
  },
  {
    label: "Logs",
    href: "/admin/logs",
    icon: FileText,
    dropdown: LOGS_DROPDOWN,
    requiredRole: ['super_admin']
  },
];

export default function SiteNav() {
  const pathname = usePathname();
  const { user, logout, hasRole } = useAuth();
  const { isModalOpen } = useModal();
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [closeTimeout, setCloseTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Filter navigation links based on user role
  const visibleNavLinks = NAV_LINKS.filter((link) => {
    if (!link.requiredRole) return true;
    return hasRole(link.requiredRole);
  }).map((link) => {
    // Filter dropdown items based on role
    if (link.dropdown) {
      const visibleDropdownItems = link.dropdown.filter((item) => {
        if (!item.requiredRole) return true;
        return hasRole(item.requiredRole);
      });
      return {
        ...link,
        dropdown: visibleDropdownItems.length > 0 ? visibleDropdownItems : undefined,
      };
    }
    return link;
  });

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      // Logout will redirect automatically via middleware
    } catch (error) {
      console.error('[SiteNav] logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    if (href === "/admin") {
      return pathname === "/admin" || pathname.startsWith("/admin/reports");
    }
    if (href === "/admin/settings") {
      return pathname.startsWith("/admin/settings");
    }
    return pathname.startsWith(href);
  };

  const handleMouseEnter = (label: string) => {
    // Clear any pending close timeout
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      setCloseTimeout(null);
    }
    // Only enable hover on desktop
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setOpenDropdown(label);
    }
  };

  const handleMouseLeave = () => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      // Add delay before closing dropdown
      const timeout = setTimeout(() => {
        setOpenDropdown(null);
      }, 500); // 500ms delay
      setCloseTimeout(timeout);
    }
  };

  const handleClick = (label: string, hasDropdown: boolean) => {
    if (!hasDropdown) return;
    // Toggle on mobile/tablet
    setOpenDropdown(openDropdown === label ? null : label);
  };

  useEffect(() => {
    let cancelled = false;
    const loadBranding = async () => {
      try {
        const response = await fetch("/api/admin/branding", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          logoPath?: string | null;
          updatedAt?: string | null;
        };
        if (!cancelled) {
          const resolved = getBrandingLogoSrc(
            data.logoPath ?? null,
            data.updatedAt ?? null,
            null,
          );
          setLogoSrc(resolved);
          if (typeof window !== "undefined") {
            if (resolved) {
              window.sessionStorage.setItem("branding:logo-src", resolved);
            } else {
              window.sessionStorage.removeItem("branding:logo-src");
            }
            document.body.dataset.brandingLogo = resolved ?? "";
            if (data.updatedAt) {
              document.body.dataset.brandingUpdatedAt = data.updatedAt;
            }
          }
        }
      } catch (error) {
        console.warn("[SiteNav] failed to load branding", error);
      }
    };
    void loadBranding();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasCustomLogo = Boolean(logoSrc);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const preload = document.body.dataset.brandingLogo ?? "";
    const stored = typeof window !== "undefined"
      ? window.sessionStorage.getItem("branding:logo-src") ?? ""
      : "";
    const next = stored || preload;
    setLogoSrc(next || null);
    if (typeof window !== "undefined") {
      if (next) {
        window.sessionStorage.setItem("branding:logo-src", next);
      } else {
        window.sessionStorage.removeItem("branding:logo-src");
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ logo?: string; updatedAt?: string }>).detail;
      if (!detail) return;
      const next = detail.logo ?? "";
      setLogoSrc(next || null);
      if (next) {
        window.sessionStorage.setItem("branding:logo-src", next);
      } else {
        window.sessionStorage.removeItem("branding:logo-src");
      }
      document.body.dataset.brandingLogo = next ?? "";
      if (detail.updatedAt) {
        document.body.dataset.brandingUpdatedAt = detail.updatedAt;
      }
    };
    window.addEventListener("branding:logo-updated", handler as EventListener);
    return () => {
      window.removeEventListener("branding:logo-updated", handler as EventListener);
    };
  }, []);

  return (
    <header
      className={`fixed left-0 right-0 top-0 bg-gradient-to-br from-[#eef5ff]/95 via-[#e9f1ff]/95 to-[#f8fbff]/95 px-4 pb-2 pt-2 backdrop-blur-md sm:px-6 lg:px-8 transition-all duration-300 ${
        isModalOpen ? '-translate-y-full opacity-0 pointer-events-none z-[50]' : 'translate-y-0 opacity-100 z-[100]'
      }`}
      style={{ touchAction: "pan-y" }}
    >
      <nav className="mx-auto flex max-w-[1600px] items-center justify-between rounded-[28px] border border-white/70 bg-white/90 px-4 py-3 shadow-[0_30px_110px_-90px_rgba(37,99,235,0.9)] backdrop-blur-xl transition-all duration-300">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className={`inline-flex h-16 w-16 items-center justify-center rounded-xl text-lg font-semibold ${
              hasCustomLogo
                ? "bg-transparent text-blue-600"
                : "bg-gradient-to-br from-blue-600 via-indigo-500 to-sky-500 text-white shadow-lg"
            }`}
          >
            {hasCustomLogo && logoSrc ? (
              <Image
                src={logoSrc}
                alt="KPFoods logo"
                width={64}
                height={64}
                className="h-16 w-16 object-contain"
                priority
              />
            ) : (
              "KF"
            )}
          </Link>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">KPFoods</p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          className="inline-flex items-center justify-center rounded-2xl border border-white/80 bg-white/70 p-2 text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-600 lg:hidden"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="sr-only">Toggle navigation</span>
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {open ? (
              <path d="M18 6 6 18M6 6l12 12" />
            ) : (
              <>
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </>
            )}
          </svg>
        </button>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-2 lg:flex">
          {visibleNavLinks.map((link) => {
            const Icon = link.icon;
            const hasDropdown = link.dropdown && link.dropdown.length > 0;
            const isOpen = openDropdown === link.label;
            const active = isActive(link.href);

            return (
              <div
                key={link.href}
                className="relative"
                onMouseEnter={() => hasDropdown && handleMouseEnter(link.label)}
                onMouseLeave={handleMouseLeave}
              >
                <Link
                  href={link.href}
                  onClick={(e) => {
                    // On mobile, toggle dropdown instead of navigating
                    if (hasDropdown && typeof window !== 'undefined' && window.innerWidth < 1024) {
                      e.preventDefault();
                      handleClick(link.label, hasDropdown);
                    }
                  }}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 text-white shadow-[0_20px_60px_-40px_rgba(37,99,235,1)]"
                      : "text-slate-600 hover:text-blue-600 hover:shadow-[0_12px_40px_-30px_rgba(37,99,235,0.4)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                  {hasDropdown && (
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </Link>

                {/* Dropdown Menu */}
                {hasDropdown && isOpen && (
                  <div className="absolute left-0 top-full z-[200] mt-2 min-w-[240px] rounded-2xl border border-white/70 bg-white/95 p-2 shadow-[0_20px_60px_-25px_rgba(37,99,235,0.5)] backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                    {link.dropdown!.map((dropdownItem) => {
                      const DropdownIcon = dropdownItem.icon;
                      return (
                        <Link
                          key={dropdownItem.href}
                          href={dropdownItem.href}
                          onClick={() => setOpenDropdown(null)}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition-all hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-700"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <DropdownIcon className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-medium">{dropdownItem.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* User Info & Logout (Desktop) */}
          {user && (
            <div className="ml-2 flex items-center gap-2 border-l border-slate-200 pl-2">
              <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5">
                <User className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-semibold text-blue-900">
                  {user.employeeName}
                </span>
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  {user.role.toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="ออกจากระบบ"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">ออกจากระบบ</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Navigation */}
      {open && (
        <div className="relative z-[200] mt-3 space-y-2 rounded-3xl border border-white/70 bg-white/95 p-4 shadow-[0_26px_90px_-70px_rgba(37,99,235,0.8)] backdrop-blur-xl lg:hidden">
          {visibleNavLinks.map((link) => {
            const Icon = link.icon;
            const hasDropdown = link.dropdown && link.dropdown.length > 0;
            const isOpen = openDropdown === link.label;
            const active = isActive(link.href);

            return (
              <div key={link.href}>
                <>
                  <Link
                    href={link.href}
                    onClick={(e) => {
                      if (hasDropdown) {
                        e.preventDefault();
                        handleClick(link.label, hasDropdown);
                      } else {
                        setOpen(false);
                      }
                    }}
                    className={`flex w-full items-center ${hasDropdown ? 'justify-between' : ''} gap-3 rounded-2xl px-4 py-2 text-sm font-semibold ${
                      active
                        ? "bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 text-white"
                        : "text-slate-600 hover:bg-blue-50/80 hover:text-blue-600"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span>{link.label}</span>
                    </div>
                    {hasDropdown && (
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </Link>
                  {hasDropdown && isOpen && (
                    <div className="ml-4 mt-2 space-y-1 border-l-2 border-blue-100 pl-4">
                      {link.dropdown!.map((dropdownItem) => {
                        const DropdownIcon = dropdownItem.icon;
                        return (
                          <Link
                            key={dropdownItem.href}
                            href={dropdownItem.href}
                            onClick={() => {
                              setOpenDropdown(null);
                              setOpen(false);
                            }}
                            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-blue-50/80 hover:text-blue-600"
                          >
                            <DropdownIcon className="h-3.5 w-3.5" />
                            <span className="font-medium">{dropdownItem.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              </div>
            );
          })}

          {/* User Info & Logout (Mobile) */}
          {user && (
            <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
              <div className="flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-3">
                <User className="h-4 w-4 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900">{user.employeeName}</p>
                  <p className="text-xs text-blue-600">Role: {user.role.toUpperCase()}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void handleLogout();
                }}
                disabled={isLoggingOut}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                <span>{isLoggingOut ? 'ออกจากระบบ' : 'ออกจากระบบ'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

