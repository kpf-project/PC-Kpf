"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Building2, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

export interface Company {
  id: string;
  name: string;
  code: string | null;
  logoUrl: string | null;
  description: string | null;
  primaryColor: string;
  secondaryColor: string;
  isActive: boolean;
  productCount?: number;
}

interface CompanySelectorProps {
  value: string | null;
  onChange: (companyId: string | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  includeAllOption?: boolean;
  activeOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Reusable Company Selector Component
 *
 * Features:
 * - Type-safe with full TypeScript support
 * - Fetches companies from API with React Query caching
 * - Shows company logo and product count
 * - Responsive design (mobile-first)
 * - Professional UX with loading states
 * - Blue-cyan gradient theme
 */
export default function CompanySelector({
  value,
  onChange,
  label = "บริษัท",
  placeholder = "เลือกบริษัท",
  required = false,
  disabled = false,
  className = "",
  includeAllOption = false,
  activeOnly = true,
  size = "md",
}: CompanySelectorProps) {
  const { data: companies = [], isLoading, error } = useQuery<Company[]>({
    queryKey: ["companies", { activeOnly }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeOnly) {
        params.set("activeOnly", "true");
      }

      const response = await fetch(`/api/admin/companies?${params.toString()}`);

      if (!response.ok) {
        throw new Error("ไม่สามารถดึงรายการบริษัทได้");
      }

      const result = await response.json();

      if (!result.ok || !result.companies) {
        throw new Error(result.message || "ข้อมูลไม่ถูกต้อง");
      }

      return result.companies as Company[];
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const selectedCompany = companies.find((c) => c.id === value);

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2.5 text-base",
    lg: "px-5 py-3 text-lg",
  };

  return (
    <div className={clsx("space-y-2", className)}>
      {/* Label */}
      {label && (
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Building2 className="h-4 w-4 text-blue-600" />
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Select */}
      <div className="relative">
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled || isLoading}
          required={required}
          className={clsx(
            "w-full appearance-none rounded-2xl border-2 transition-all duration-200",
            "bg-white text-slate-900 font-medium",
            "focus:outline-none focus:ring-4 focus:ring-blue-100",
            sizeClasses[size],
            disabled || isLoading
              ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
              : "border-blue-200 hover:border-blue-400 focus:border-blue-500 cursor-pointer",
            selectedCompany ? "pr-12" : "pr-10"
          )}
        >
          {/* Loading state */}
          {isLoading && <option value="">กำลังโหลด...</option>}

          {/* Error state */}
          {error && <option value="">เกิดข้อผิดพลาด</option>}

          {/* Normal state */}
          {!isLoading && !error && (
            <>
              {includeAllOption && (
                <option value="">
                  {placeholder || "ทุกบริษัท"}
                </option>
              )}

              {!includeAllOption && !required && (
                <option value="">
                  {placeholder}
                </option>
              )}

              {companies.length === 0 && (
                <option value="" disabled>
                  ยังไม่มีบริษัทในระบบ
                </option>
              )}

              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                  {company.code ? ` (${company.code})` : ""}
                  {company.productCount !== undefined && company.productCount > 0
                    ? ` - ${company.productCount} สินค้า`
                    : ""}
                </option>
              ))}
            </>
          )}
        </select>

        {/* Dropdown icon */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg
            className={clsx(
              "h-5 w-5 transition-colors",
              disabled || isLoading ? "text-slate-300" : "text-blue-600"
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>

        {/* Selected company indicator */}
        {selectedCompany && !disabled && (
          <div className="pointer-events-none absolute inset-y-0 right-10 flex items-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
        )}
      </div>

      {/* Selected company info */}
      {selectedCompany && selectedCompany.logoUrl && (
        <div className="flex items-center gap-3 rounded-xl border-2 border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-2.5">
          <Image
            src={selectedCompany.logoUrl}
            alt={selectedCompany.name}
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-contain ring-2 ring-white shadow-sm"
            unoptimized
            loading="lazy"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-blue-900 truncate">
              {selectedCompany.name}
            </p>
            {selectedCompany.description && (
              <p className="text-xs text-blue-600 truncate">
                {selectedCompany.description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-rose-600">
          {error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการโหลดข้อมูล"}
        </p>
      )}

      {/* Empty state message */}
      {!isLoading && !error && companies.length === 0 && (
        <p className="text-xs text-amber-600 flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          ยังไม่มีบริษัทในระบบ กรุณาเพิ่มบริษัทก่อนใช้งาน
        </p>
      )}
    </div>
  );
}
