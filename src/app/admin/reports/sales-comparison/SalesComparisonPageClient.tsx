"use client";

import Image from "next/image";
import { getBrandingLogoSrc, getBrandingLogoUrl } from "@/lib/branding";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type { SalesComparisonResponse, ProductSalesComparison } from "@/types/sales-comparison";

type EmployeeOption = {
  id: string;
  name: string;
  employeeCode: string | null;
  phone: string | null;
  province: string | null;
  region: string | null;
  regularDayOff: string | null;
  defaultStoreId: string | null;
};

type StoreOption = {
  id: string;
  name: string;
  province: string | null;
};

type Props = {
  initialEmployees: EmployeeOption[];
  initialStores: StoreOption[];
};

const FALLBACK_LOGO = "/icons/icon-192x192.png";

type FiltersState = {
  employeeId: string;
  storeId: string;
  year: number;
  startMonth: number;
  endMonth: number;
};

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: SalesComparisonResponse }
  | { status: "error"; message: string };

function formatCurrencyTh(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }
  return `${value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCurrencyThWithBaht(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }
  return `฿ ${value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// Mobile Product Card Component
type MobileProductCardProps = {
  product: ProductSalesComparison;
  monthOptions: Array<{ value: number; label: string }>;
  formatCurrencyTh: (value: number | null | undefined) => string;
  formatPercent: (value: number | null | undefined) => string;
};

function MobileProductCard({
  product,
  monthOptions,
  formatCurrencyTh,
  formatPercent,
}: MobileProductCardProps) {
  const [activeTab, setActiveTab] = useState<'box' | 'pack' | 'piece'>('box');
  const [showMonthly, setShowMonthly] = useState(false);

  const units = product.unitTypeSales;
  const currentUnit = units[activeTab];

  const tabs = [
    { id: 'box' as const, label: 'กล่อง', icon: '📦', data: units.box },
    { id: 'pack' as const, label: 'แพ็ค', icon: '📦', data: units.pack },
    { id: 'piece' as const, label: 'ปี๊บ/ซอง', icon: '🧃', data: units.piece },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-slate-200">
        <h3 className="font-bold text-slate-900 text-base">{product.productName}</h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
            ยอดรวม: {formatCurrencyTh(product.totalSalesAllUnits)} ฿
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2.5 text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Unit Details */}
      <div className="p-4 space-y-3 bg-gradient-to-br from-white to-slate-50">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">จำนวน</div>
            <div className="text-lg font-bold text-slate-900">
              {currentUnit.quantity > 0 ? currentUnit.quantity.toLocaleString('th-TH') : '-'}
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 mb-1">ราคาเฉลี่ย</div>
            <div className="text-lg font-bold text-slate-900">
              {currentUnit.avgPrice > 0 ? `฿${formatCurrencyTh(currentUnit.avgPrice)}` : '-'}
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-3 border border-emerald-200">
          <div className="text-xs text-emerald-600 font-semibold mb-1">ยอดขายรวม</div>
          <div className="text-xl font-bold text-emerald-700">
            {currentUnit.totalSales > 0 ? `฿${formatCurrencyTh(currentUnit.totalSales)}` : '-'}
          </div>
        </div>
      </div>

      {/* Monthly Comparison Toggle */}
      <button
        onClick={() => setShowMonthly(!showMonthly)}
        className="w-full px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-slate-200 flex items-center justify-between text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          เปรียบเทียบรายเดือน
        </span>
        <svg
          className={`w-5 h-5 transition-transform ${showMonthly ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Monthly Data (Expandable) */}
      {showMonthly && (
        <div className="border-t border-slate-200 bg-white p-4 space-y-2 max-h-96 overflow-y-auto">
          {product.monthlySales.map((month, mIdx) => (
            <div
              key={mIdx}
              className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-slate-50 to-blue-50/30 border border-slate-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-700">
                    {monthOptions[mIdx]?.label.substring(0, 3)}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {month.totalSales > 0 ? `฿${formatCurrencyTh(month.totalSales)}` : '-'}
                  </div>
                  {mIdx === 0 ? (
                    <div className="text-xs text-slate-400 italic">ไม่มีข้อมูลเปรียบเทียบ</div>
                  ) : (
                    <div
                      className={`text-xs font-semibold ${
                        month.diffPercent < 0
                          ? 'text-red-600'
                          : month.diffPercent > 0
                          ? 'text-green-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {month.diffPercent >= 0 ? '↑' : '↓'} {formatPercent(month.diffPercent)}
                    </div>
                  )}
                </div>
              </div>
              {mIdx !== 0 && (
                <div
                  className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                    month.diffPercent < 0
                      ? 'bg-red-100 text-red-700'
                      : month.diffPercent > 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {month.diffAmount >= 0 ? '+' : ''}{formatCurrencyTh(month.diffAmount)} ฿
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SalesComparisonPageClient({ initialEmployees, initialStores }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Current year in Buddhist Era (พ.ศ.)
  const currentYearBE = new Date().getFullYear() + 543;

  // Read from URL or localStorage (lazy loading)
  const [filters, setFilters] = useState<FiltersState>(() => {
    const urlEmployeeId = searchParams.get("employeeId");
    const urlStoreId = searchParams.get("storeId");
    const year = parseInt(searchParams.get("year") || String(currentYearBE), 10);
    const startMonth = parseInt(searchParams.get("startMonth") || "1", 10);
    const endMonth = parseInt(searchParams.get("endMonth") || "12", 10);

    // If URL has employeeId, use it
    if (urlEmployeeId) {
      return {
        employeeId: urlEmployeeId,
        storeId: urlStoreId || "",
        year,
        startMonth,
        endMonth,
      };
    }

    // Otherwise, check localStorage (for refresh persistence)
    if (typeof window !== "undefined") {
      const savedEmployeeId = window.localStorage.getItem("sales-comparison:last-employee-id");
      const savedStoreId = window.localStorage.getItem("sales-comparison:last-store-id");

      // Validate saved IDs exist in current data
      const isValidEmployee = savedEmployeeId && initialEmployees.some(e => e.id === savedEmployeeId);
      const isValidStore = savedStoreId && initialStores.some(s => s.id === savedStoreId);

      if (isValidEmployee) {
        return {
          employeeId: savedEmployeeId,
          storeId: isValidStore ? savedStoreId : "",
          year,
          startMonth,
          endMonth,
        };
      }
    }

    // Default: no employee selected (lazy loading)
    return {
      employeeId: "",
      storeId: "",
      year,
      startMonth,
      endMonth,
    };
  });

  const [state, setState] = useState<FetchState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const reportContainerRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const selectedEmployee = useMemo(
    () => initialEmployees.find((employee) => employee.id === filters.employeeId) ?? null,
    [filters.employeeId, initialEmployees]
  );

  const selectedStore = useMemo(
    () => initialStores.find((store) => store.id === filters.storeId) ?? null,
    [filters.storeId, initialStores]
  );

  // Drag to scroll functionality
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!tableScrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - tableScrollRef.current.offsetLeft);
    setScrollLeft(tableScrollRef.current.scrollLeft);
    tableScrollRef.current.style.cursor = "grabbing";
    tableScrollRef.current.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging || !tableScrollRef.current) return;
      e.preventDefault();
      const x = e.pageX - tableScrollRef.current.offsetLeft;
      const walk = (x - startX) * 1.5; // Scroll speed multiplier
      tableScrollRef.current.scrollLeft = scrollLeft - walk;
    },
    [isDragging, startX, scrollLeft]
  );

  const handleMouseUpOrLeave = useCallback(() => {
    if (!tableScrollRef.current) return;
    setIsDragging(false);
    tableScrollRef.current.style.cursor = "grab";
    tableScrollRef.current.style.userSelect = "auto";
  }, []);

  // Prevent text selection while dragging
  useEffect(() => {
    const handleSelectStart = (e: Event) => {
      if (isDragging) {
        e.preventDefault();
      }
    };
    document.addEventListener("selectstart", handleSelectStart);
    return () => {
      document.removeEventListener("selectstart", handleSelectStart);
    };
  }, [isDragging]);

  // Save selected employee/store to localStorage (for refresh persistence)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (filters.employeeId) {
      window.localStorage.setItem("sales-comparison:last-employee-id", filters.employeeId);
    } else {
      window.localStorage.removeItem("sales-comparison:last-employee-id");
    }

    if (filters.storeId) {
      window.localStorage.setItem("sales-comparison:last-store-id", filters.storeId);
    } else {
      window.localStorage.removeItem("sales-comparison:last-store-id");
    }
  }, [filters.employeeId, filters.storeId]);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.employeeId) params.set("employeeId", filters.employeeId);
    if (filters.storeId) params.set("storeId", filters.storeId);
    params.set("year", String(filters.year));
    params.set("startMonth", String(filters.startMonth));
    params.set("endMonth", String(filters.endMonth));

    router.replace(`?${params.toString()}`, { scroll: false });
  }, [filters, router]);

  // Fetch data when filters change
  useEffect(() => {
    if (!filters.employeeId || !filters.year) {
      setState({ status: "idle" });
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    params.set("employeeId", filters.employeeId);
    params.set("year", String(filters.year));
    params.set("startMonth", String(filters.startMonth));
    params.set("endMonth", String(filters.endMonth));
    if (filters.storeId) params.set("storeId", filters.storeId);

    setState({ status: "loading" });
    void fetch(`/api/admin/reports/sales-comparison?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "ไม่สามารถโหลดรายงานได้");
        }
        const payload = (await response.json()) as SalesComparisonResponse;
        setState({ status: "success", data: payload });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "ไม่สามารถโหลดรายงานได้";
        setState({ status: "error", message });
      });

    return () => {
      controller.abort();
    };
  }, [filters]);

  const handleChange = (key: keyof FiltersState, value: string | number) => {
    setFilters((prev) => {
      if (key === "year") {
        return { ...prev, year: Number(value) };
      }
      if (key === "startMonth") {
        return { ...prev, startMonth: Number(value) };
      }
      if (key === "endMonth") {
        return { ...prev, endMonth: Number(value) };
      }
      if (key === "employeeId") {
        const employee = initialEmployees.find((item) => item.id === value) ?? null;
        const inferredStoreId =
          employee?.defaultStoreId &&
          initialStores.some((store) => store.id === employee.defaultStoreId)
            ? employee.defaultStoreId!
            : "";
        return {
          ...prev,
          employeeId: String(value),
          storeId: inferredStoreId,
        };
      }
      if (key === "storeId") {
        return { ...prev, storeId: String(value) };
      }
      return prev;
    });
  };

  const handlePrint = () => {
    if (state.status !== "success" || !state.data) return;

    const reportData = state.data.data;
    const products = reportData.products;
    const metadata = reportData.metadata;

    // Sales comparison report is always for 1 employee, so supervisor signature should be blank
    const supervisorSignatureName = "";
    void supervisorSignatureName;

    const logoUrl = getBrandingLogoUrl(
      reportData.branding?.logoPath ?? null,
      reportData.branding?.updatedAt ?? null,
      {
        origin: window.location.origin,
      }
    );

    const printTimestamp = new Intl.DateTimeFormat("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date());

    // คำนวณยอดรวมทั้งหมด
    const grandTotalSales = products.reduce((sum, p) => sum + p.totalSalesAllUnits, 0);

    // ใช้ช่วงเดือนที่ user เลือก (startMonth - endMonth)
    const startMonthName = monthOptions[filters.startMonth - 1]?.label || "";
    const endMonthName = monthOptions[filters.endMonth - 1]?.label || "";

    // Range totals were previously computed here; removed to reduce bundle size
    // สร้าง HTML สำหรับแถวข้อมูล
    const rowsHtml = products
      .map((product) => {
        const units = product.unitTypeSales;
        const monthly = product.monthlySales;

        return `
        <tr>
          <td class="text-left">${product.productName}</td>
          <!-- Box -->
          <td class="text-center bg-emerald-light">${units.box.quantity > 0 ? units.box.quantity.toLocaleString("th-TH") : "-"}</td>
          <td class="text-right bg-emerald-light">${units.box.avgPrice > 0 ? formatCurrencyTh(units.box.avgPrice) : "-"}</td>
          <td class="text-right bg-emerald-light font-semibold">${units.box.totalSales > 0 ? formatCurrencyTh(units.box.totalSales) : "-"}</td>
          <!-- Pack -->
          <td class="text-center bg-emerald-light">${units.pack.quantity > 0 ? units.pack.quantity.toLocaleString("th-TH") : "-"}</td>
          <td class="text-right bg-emerald-light">${units.pack.avgPrice > 0 ? formatCurrencyTh(units.pack.avgPrice) : "-"}</td>
          <td class="text-right bg-emerald-light font-semibold">${units.pack.totalSales > 0 ? formatCurrencyTh(units.pack.totalSales) : "-"}</td>
          <!-- Piece -->
          <td class="text-center bg-emerald-light">${units.piece.quantity > 0 ? units.piece.quantity.toLocaleString("th-TH") : "-"}</td>
          <td class="text-right bg-emerald-light">${units.piece.avgPrice > 0 ? formatCurrencyTh(units.piece.avgPrice) : "-"}</td>
          <td class="text-right bg-emerald-light font-semibold">${units.piece.totalSales > 0 ? formatCurrencyTh(units.piece.totalSales) : "-"}</td>
          <!-- Total -->
          <td class="text-right font-bold bg-emerald">${formatCurrencyTh(product.totalSalesAllUnits)}</td>
          <!-- Monthly with % -->
          ${monthly.map((month, mIdx) => `
            <td class="text-right bg-blue-light" style="padding: 2px;">
              <div style="font-weight: 600;">${month.totalSales > 0 ? formatCurrencyTh(month.totalSales) : "-"}</div>
              <div style="font-size: 7px; margin-top: 2px; color: ${mIdx === 0 ? '#94a3b8' : month.diffPercent < 0 ? '#dc2626' : month.diffPercent > 0 ? '#16a34a' : '#64748b'};">
                ${mIdx === 0 ? '-' : formatPercent(month.diffPercent)}
              </div>
            </td>
          `).join("")}
        </tr>
      `;
      })
      .join("");

    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>รายงานเปรียบเทียบยอดขายทั้งปี - ${metadata.employeeName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: A4 landscape;
      margin: 8mm;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 9px;
      line-height: 1.3;
      color: #334155;
    }

    .container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      padding: 5mm;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 2px solid #cbd5e1;
      gap: 12px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .company-logo {
      width: 96px;
      height: 96px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #e2e8f0;
      border-radius: 8px;
      padding: 8px;
    }

    .company-logo img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
    }

    .company-logo img[data-loaded="true"] {
      opacity: 1;
    }

    .company-names {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .company-names h1 {
      font-size: 18px;
      font-weight: bold;
      margin: 0;
    }

    .company-names p {
      font-size: 12px;
      color: #333;
      margin: 0;
    }

    .employee-info {
      text-align: right;
      font-size: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
      page-break-inside: auto;
      font-size: 8px;
    }

    th {
      background: #f8fafc;
      border: 1px solid #1e293b;
      padding: 4px 2px;
      text-align: center;
      font-weight: 600;
      color: #0f172a;
      font-size: 9px;
      white-space: nowrap;
    }

    td {
      border: 1px solid #1e293b;
      padding: 3px 2px;
      text-align: center;
      font-size: 9px;
      white-space: nowrap;
      color: #0f172a;
    }

    .text-left {
      text-align: left;
      padding-left: 3px;
      font-weight: 500;
      color: #0f172a;
    }

    .text-right {
      text-align: right;
      padding-right: 2px;
    }

    .text-center {
      text-align: center;
    }

    /* Color themes matching screen */
    .bg-slate-50 {
      background: #f8fafc !important;
    }

    .bg-emerald {
      background: #ecfdf5 !important;
      color: #065f46 !important;
      font-weight: 600;
    }

    .bg-emerald-light {
      background: rgba(236, 253, 245, 0.3) !important;
    }

    .bg-blue {
      background: #eff6ff !important;
      color: #1e40af !important;
      font-weight: 600;
    }

    .bg-blue-light {
      background: rgba(239, 246, 255, 0.2) !important;
    }

    .text-emerald {
      color: #065f46 !important;
    }

    .text-blue {
      color: #1e40af !important;
    }

    .font-semibold {
      font-weight: 600;
    }

    .font-bold {
      font-weight: 700;
    }

    .summary-row {
      margin-top: 16px;
      padding: 8px 12px;
      border: 1px solid #374151;
      background: #f8fafc;
      text-align: center;
      font-size: 10px;
      color: #0f172a;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 8px;
    }

    .summary-row span {
      white-space: nowrap;
    }

    .summary-row .divider {
      display: inline-block;
      width: 1px;
      height: 14px;
      background: #cbd5e1;
    }

    .notes {
      margin-top: 16px;
      padding: 0 12px;
      font-size: 9px;
      color: #0f172a;
      line-height: 1.6;
    }

    .notes p {
      margin: 0;
      margin-bottom: 4px;
    }

    .signatures {
      margin-top: 30px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* Print-specific styles for shadows and gradients */
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }

    .signature-row {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      gap: 10px;
      page-break-inside: avoid;
      margin-top: 20px;
    }

    .signature-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      flex: 1 1 0;
      min-width: 0;
      border: 1px solid #333;
      padding: 28px 8px 12px 8px;
      background: #fafafa;
    }

    .signature-inline {
      display: flex;
      align-items: baseline;
      gap: 5px;
      font-size: 9px;
      white-space: nowrap;
    }

    .signature-line {
      display: inline-block;
      border-bottom: 1px solid #333;
      min-width: 90px;
      width: 90px;
    }

    .signature-name {
      font-size: 10px;
      color: #333;
      margin-top: 2px;
      white-space: nowrap;
      text-align: center;
      min-width: 120px;
    }

    .signature-date {
      font-size: 9px;
      color: #666;
      margin-top: 3px;
    }

    /* Footer totals */
    tfoot td {
      background: #f1f5f9 !important;
      font-weight: 700;
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-left">
        <div class="company-logo">
          <img src="${logoUrl}" alt="Company Logo" onload="this.setAttribute('data-loaded', 'true')" />
        </div>
        <div class="company-names">
          <h1>บริษัทเคพีฟู้ดส์ จำกัด</h1>
          <p>รายงานเปรียบเทียบยอดขายทั้งปี ${metadata.year} (พ.ศ.)</p>
          <p style="font-size: 9px; color: #64748b;">ช่วงเดือน: ${metadata.startMonthName} - ${metadata.endMonthName}</p>
          <p style="font-size: 9px; color: #64748b; margin-top: 4px;">พิมพ์เอกสารเมื่อ: ${printTimestamp}</p>
        </div>
      </div>
      <div class="employee-info">
        <p style="text-align: right;">
          <span style="font-weight: 600;">พนักงาน:</span> <span style="color: #0f172a;">${metadata.employeeName}</span>
        </p>
        <p style="text-align: right;">
          เบอร์: ${metadata.phone ?? "-"}
        </p>
        <p style="text-align: right;">
          ร้านค้า: ${metadata.storeName ?? "ทั้งหมด"} | เขต: ${metadata.region ?? "-"}
        </p>
        <p style="text-align: right;">
          วันหยุด: ${metadata.regularDayOff ?? "-"}
        </p>
      </div>
    </header>

    <table>
      <thead>
        <!-- Level 1 Headers -->
        <tr class="bg-slate-50">
          <th rowSpan="3" style="font-size: 10px;">สินค้า</th>
          <th colSpan="9" class="bg-emerald" style="font-size: 10px;">ยอดขายร้านค้า PC</th>
          <th rowSpan="3" class="bg-emerald" style="font-size: 9px;">ยอดขายรวม<br/>(PC)</th>
          <th colSpan="12" class="bg-blue" style="font-size: 10px;">เปรียบเทียบยอดขายต่อเดือนปี ${metadata.year}</th>
        </tr>
        <!-- Level 2 Headers - Unit Types & Months -->
        <tr class="bg-slate-50">
          <th colSpan="3" class="bg-emerald text-emerald" style="font-size: 9px;">กล่อง</th>
          <th colSpan="3" class="bg-emerald text-emerald" style="font-size: 9px;">แพ็ค</th>
          <th colSpan="3" class="bg-emerald text-emerald" style="font-size: 9px;">ปี๊บ/ซอง</th>
          <th rowSpan="2" class="text-blue" style="font-size: 9px;">ม.ค.</th>
          <th rowSpan="2" class="text-blue" style="font-size: 9px;">ก.พ.</th>
          <th rowSpan="2" class="text-blue" style="font-size: 9px;">มี.ค.</th>
          <th rowSpan="2" class="text-blue" style="font-size: 9px;">เม.ย.</th>
          <th rowSpan="2" class="text-blue" style="font-size: 9px;">พ.ค.</th>
          <th rowSpan="2" class="text-blue" style="font-size: 9px;">มิ.ย.</th>
          <th rowSpan="2" class="text-blue" style="font-size: 9px;">ก.ค.</th>
          <th rowSpan="2" class="text-blue" style="font-size: 9px;">ส.ค.</th>
          <th rowSpan="2" class="text-blue" style="font-size: 9px;">ก.ย.</th>
          <th rowSpan="2" class="text-blue" style="font-size: 9px;">ต.ค.</th>
          <th rowSpan="2" class="text-blue" style="font-size: 9px;">พ.ย.</th>
          <th rowSpan="2" class="text-blue" style="font-size: 9px;">ธ.ค.</th>
        </tr>
        <!-- Level 3 Headers - Details -->
        <tr class="bg-slate-50">
          <th class="text-emerald" style="font-size: 8px;">จำนวน</th>
          <th class="text-emerald" style="font-size: 8px;">ราคา</th>
          <th class="text-emerald" style="font-size: 8px;">ยอดขายรวม</th>
          <th class="text-emerald" style="font-size: 8px;">จำนวน</th>
          <th class="text-emerald" style="font-size: 8px;">ราคา</th>
          <th class="text-emerald" style="font-size: 8px;">ยอดขายรวม</th>
          <th class="text-emerald" style="font-size: 8px;">จำนวน</th>
          <th class="text-emerald" style="font-size: 8px;">ราคา</th>
          <th class="text-emerald" style="font-size: 8px;">ยอดขายรวม</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr style="background: #f1f5f9;">
          <td style="text-align:center; font-weight:bold; font-size: 9px;">รวมทั้งหมด</td>
          <!-- Box -->
          <td colspan="3" style="text-align:center; font-size: 8px;" class="bg-emerald-light">-</td>
          <!-- Pack -->
          <td colspan="3" style="text-align:center; font-size: 8px;" class="bg-emerald-light">-</td>
          <!-- Piece -->
          <td colspan="3" style="text-align:center; font-size: 8px;" class="bg-emerald-light">-</td>
          <td style="text-align:right; font-weight:bold; font-size: 9px;" class="bg-emerald">${formatCurrencyTh(grandTotalSales)}</td>
          <td colspan="12" style="text-align:center; font-size: 8px;">-</td>
        </tr>
      </tfoot>
    </table>

    <div class="summary-row">
      <span>ยอดขายรวมทั้งหมด <strong>${formatCurrencyThWithBaht(grandTotalSales)}</strong></span>
      <span class="divider"></span>
      <span>ยอดขายรวม ตั้งแต่ ${startMonthName} - ${endMonthName}</span>
    </div>

    <div style="margin-top: 16px; padding: 14px; border: 2px solid #cbd5e1; border-radius: 8px; background: linear-gradient(to bottom right, #f8fafc, #eff6ff);">
      <div style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #cbd5e1;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="2">
            <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          <span style="font-weight: 700; color: #1e293b; font-size: 10px;">สรุปผลต่างเดือนต่อเดือนทุก SKU (Month-over-Month)</span>
        </div>
        <p style="margin: 0; margin-left: 20px; font-size: 8px; color: #64748b;">ช่วงเดือน: ${startMonthName} - ${endMonthName} ${metadata.year}</p>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 8px;">
        ${Array.from({ length: filters.endMonth - filters.startMonth + 1 }, (_, idx) => {
          const actualMonthIdx = filters.startMonth - 1 + idx;
          const currentMonthTotal = products.reduce((sum, p) => sum + (p.monthlySales[actualMonthIdx]?.totalSales || 0), 0);
          const prevMonthTotal = actualMonthIdx > 0 ? products.reduce((sum, p) => sum + (p.monthlySales[actualMonthIdx - 1]?.totalSales || 0), 0) : 0;
          const diffAmount = actualMonthIdx > 0 ? currentMonthTotal - prevMonthTotal : 0;
          const diffPercent = actualMonthIdx > 0 && prevMonthTotal !== 0 ? ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100 : 0;
          const monthName = monthOptions[actualMonthIdx]?.label || '';

          if (actualMonthIdx === 0) {
            return `<div style="padding: 8px; background: white; border: 1px solid #e2e8f0; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              <div style="font-weight: 700; color: #334155; margin-bottom: 4px; font-size: 9px;">${monthName}</div>
              <div style="color: #94a3b8; font-size: 7px; font-style: italic; display: flex; align-items: center; gap: 3px;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4M12 8h.01"/>
                </svg>
                ไม่มีข้อมูลเปรียบเทียบ
              </div>
            </div>`;
          }

          const diffColor = diffAmount < 0 ? '#dc2626' : diffAmount > 0 ? '#16a34a' : '#64748b';
          const bgColor = diffAmount < 0 ? '#fee2e2' : diffAmount > 0 ? '#dcfce7' : '#f1f5f9';
          const arrow = diffAmount >= 0 ? '↑' : '↓';

          return `<div style="padding: 8px; background: white; border: 1px solid #e2e8f0; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: 700; color: #334155; font-size: 9px;">${monthName}</span>
              <span style="background: ${bgColor}; color: ${diffColor}; padding: 2px 6px; border-radius: 10px; font-size: 7px; font-weight: 600;">
                ${arrow} ${Math.abs(diffPercent).toFixed(1)}%
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-size: 7px; color: #64748b; font-weight: 500;">ผลต่าง:</span>
              <span style="font-weight: 700; color: ${diffColor}; font-size: 9px;">${diffAmount >= 0 ? '+' : ''}${formatCurrencyTh(diffAmount)} ฿</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="notes">
      <p>หมายเหตุ 1 : ยอดผลต่าง(บาท) = ยอดขายเดือนปัจจุบัน - ยอดขายเดือนก่อนหน้า (เช่น แถว "กุมภาพันธ์" แสดง กุมภาพันธ์ - มกราคม)</p>
      <p>หมายเหตุ 2 : ยอดผลต่าง(%) = ((ยอดขายเดือนปัจจุบัน - ยอดขายเดือนก่อนหน้า) / ยอดขายเดือนก่อนหน้า) × 100</p>
      <p>หมายเหตุ 3 : เดือนมกราคม (เดือนแรกของปี) ไม่มีข้อมูลเปรียบเทียบ เพราะไม่มีเดือนก่อนหน้า</p>
    </div>

    <div class="signatures">
      <div class="signature-row">
        <!-- 1. พนักงาน -->
        <div class="signature-cell">
          <div class="signature-inline">
            <span>ลงชื่อ</span>
            <span class="signature-line"></span>
            <span>พนักงาน</span>
          </div>
          <span class="signature-name">(${metadata.employeeName})</span>
          <span class="signature-date">วันที่ ___/___/___</span>
        </div>
        <!-- 2. ผู้ตรวจสอบ -->
        <div class="signature-cell">
          <div class="signature-inline">
            <span>ลงชื่อ</span>
            <span class="signature-line"></span>
            <span>ผู้ตรวจสอบ</span>
          </div>
          <span class="signature-name">(.....................)</span>
          <span class="signature-date">วันที่ ___/___/___</span>
        </div>
        <!-- 3. ซูเปอร์ไวเซอร์ -->
        <div class="signature-cell">
          <div class="signature-inline">
            <span>ลงชื่อ</span>
            <span class="signature-line"></span>
            <span>ซูเปอร์ไวเซอร์</span>
          </div>
          <span class="signature-name">(.....................)</span>
          <span class="signature-date">วันที่ ___/___/___</span>
        </div>
        <!-- 4. ผู้อนุมัติ -->
        <div class="signature-cell">
          <div class="signature-inline">
            <span>ลงชื่อ</span>
            <span class="signature-line"></span>
            <span>ผู้อนุมัติ</span>
          </div>
          <span class="signature-name">(.....................)</span>
          <span class="signature-date">วันที่ ___/___/___</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const hasEmployees = initialEmployees.length > 0;
  const toolbarDisabled = state.status === "loading";
  const report = state.status === "success" ? state.data.data : null;

  const displayLogo =
    getBrandingLogoSrc(
      report?.branding?.logoPath ?? null,
      report?.branding?.updatedAt ?? null,
      FALLBACK_LOGO
    ) ?? FALLBACK_LOGO;

  // Generate year options (5 years back from current year)
  const yearOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 5; i++) {
      options.push(currentYearBE - i);
    }
    return options;
  }, [currentYearBE]);

  // Month options (Thai names)
  const monthOptions = useMemo(() => [
    { value: 1, label: "มกราคม" },
    { value: 2, label: "กุมภาพันธ์" },
    { value: 3, label: "มีนาคม" },
    { value: 4, label: "เมษายน" },
    { value: 5, label: "พฤษภาคม" },
    { value: 6, label: "มิถุนายน" },
    { value: 7, label: "กรกฎาคม" },
    { value: 8, label: "สิงหาคม" },
    { value: 9, label: "กันยายน" },
    { value: 10, label: "ตุลาคม" },
    { value: 11, label: "พฤศจิกายน" },
    { value: 12, label: "ธันวาคม" },
  ], []);

  if (!hasEmployees) {
    return (
      <div className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900 -mt-4 mb-2">
            รายงานเปรียบเทียบยอดขายทั้งปี
          </h1>
          <p className="text-sm text-slate-500">
            กรุณาเพิ่มรายชื่อพนักงานก่อน เพื่อสร้างรายงานเปรียบเทียบยอดขาย
          </p>
        </header>
        <div className="rounded-3xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-700 shadow-inner">
          ยังไม่มีข้อมูลพนักงาน
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      <header className="space-y-3 print:hidden">
        <h1 className="text-2xl font-semibold text-slate-900 -mt-4 mb-2">
          รายงานเปรียบเทียบยอดขายทั้งปี
        </h1>
        <p className="text-sm text-slate-500">
          เปรียบเทียบยอดขายตามสินค้าและเดือน พร้อมยอดรวมและผลต่าง
        </p>
      </header>

      <section className="print:hidden rounded-3xl border border-blue-100 bg-white/90 p-3 sm:p-5 shadow-[0_30px_120px_-110px_rgba(37,99,235,0.8)]">
        <form
          className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5"
          onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}
        >
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">
              พนักงาน *
            </label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
              value={filters.employeeId}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                handleChange("employeeId", event.target.value)
              }
              disabled={toolbarDisabled}
            >
              <option value="">เลือกพนักงาน</option>
              {initialEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">
              ร้านค้า
            </label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
              value={filters.storeId}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                handleChange("storeId", event.target.value)
              }
              disabled={toolbarDisabled}
            >
              <option value="">ทั้งหมด</option>
              {initialStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">
              ปี (พ.ศ.) *
            </label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
              value={filters.year}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                handleChange("year", parseInt(event.target.value, 10))
              }
              disabled={toolbarDisabled}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">
              ตั้งแต่เดือน *
            </label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
              value={filters.startMonth}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                handleChange("startMonth", parseInt(event.target.value, 10))
              }
              disabled={toolbarDisabled}
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">
              ถึงเดือน *
            </label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
              value={filters.endMonth}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                handleChange("endMonth", parseInt(event.target.value, 10))
              }
              disabled={toolbarDisabled}
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handlePrint}
            disabled={state.status !== "success"}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_60px_-35px_rgba(49,46,129,0.8)] transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            พิมพ์ / PDF
          </button>
          {state.status === "loading" && (
            <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-600 shadow-inner">
              กำลังโหลดรายงาน...
            </span>
          )}
          {state.status === "error" && (
            <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-4 py-2 text-xs font-medium text-red-600 shadow-inner">
              {state.message}
            </span>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="print:hidden text-sm text-slate-500">
          แสดงผลสำหรับ:{" "}
          <span className="font-medium text-slate-700">
            {selectedEmployee?.name ?? "-"}
          </span>{" "}
          · ปี {filters.year} (พ.ศ.) · ช่วงเดือน: {monthOptions[filters.startMonth - 1]?.label} - {monthOptions[filters.endMonth - 1]?.label}
        </div>

        <div
          ref={reportContainerRef}
          id="report-print-container"
          className="w-full border border-slate-200 bg-[#fdfdfc] p-6 shadow-[0_40px_140px_-100px_rgba(37,99,235,0.85)] print:border-none print:bg-white print:p-0 print:shadow-none print:w-[297mm]"
        >
          <div className="box-border flex w-full flex-col gap-4 rounded-[22px] bg-white p-6 shadow-[0_0_1px_rgba(15,23,42,0.08)] print:rounded-none print:p-[10mm] print:shadow-none">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2">
                  <Image
                    src={displayLogo}
                    alt="โลโก้บริษัท"
                    fill
                    sizes="96px"
                    className="object-contain"
                    priority
                    unoptimized={displayLogo.startsWith("http")}
                    placeholder="blur"
                    blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e2e8f0'/%3E%3C/svg%3E"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-slate-900 whitespace-nowrap">
                    บริษัทเคพีฟู้ดส์ จำกัด
                  </p>
                  <p className="text-sm text-slate-600">
                    รายงานเปรียบเทียบยอดขายทั้งปี {filters.year} (พ.ศ.)
                  </p>
                  <p className="text-xs text-slate-500">
                    ช่วงเดือน: {monthOptions[filters.startMonth - 1]?.label} - {monthOptions[filters.endMonth - 1]?.label}
                  </p>
                </div>
              </div>
              <div className="hidden md:block text-sm text-slate-600 space-y-0.5 ml-auto">
                <p className="text-right">
                  รหัส: {selectedEmployee?.employeeCode ?? "-"}
                </p>
                <p className="text-right">
                  <span className="font-semibold">พนักงาน:</span> <span className="text-slate-900">{selectedEmployee?.name ?? "-"}</span>
                </p>
                <p className="text-right">
                  เบอร์: {selectedEmployee?.phone ?? "-"}
                </p>
                <p className="text-right">
                  ร้านค้า: {selectedStore?.name ?? "ทั้งหมด"} | เขต: {selectedEmployee?.region ?? "-"}
                </p>
                <p className="text-right">
                  วันหยุด: {selectedEmployee?.regularDayOff ?? "-"}
                </p>
              </div>
            </header>

            {/* Desktop: Table view - Mobile: Card view */}
            {report && (
              <>
                {/* Desktop Table View (hidden on mobile) */}
                <div className="hidden lg:block overflow-hidden rounded-xl border border-slate-200 shadow-lg">
                  <div
                    ref={tableScrollRef}
                    className="overflow-x-auto -webkit-overflow-scrolling-touch scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
                    style={{ cursor: "grab" }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUpOrLeave}
                    onMouseLeave={handleMouseUpOrLeave}
                  >
                    <table
                      className="w-full border-collapse text-[11px] sm:text-[12px] lg:text-[13px]"
                      style={{ minWidth: "1600px" }}
                    >
                      <thead>
                        {/* Level 1 Headers */}
                        <tr className="bg-slate-50">
                          <th
                            rowSpan={3}
                            className="border border-slate-200 px-1.5 py-1.5 text-center text-slate-700 font-bold text-[12px] md:sticky left-0 md:z-20 bg-slate-50 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                            style={{ width: "140px", minWidth: "140px" }}
                          >
                            สินค้า
                          </th>
                          <th
                            colSpan={9}
                            className="border border-slate-200 px-0.5 py-1.5 text-center text-emerald-700 font-bold text-[12px] bg-emerald-50"
                          >
                            ยอดขายร้านค้า PC
                          </th>
                          <th
                            rowSpan={3}
                            className="border border-slate-200 px-0.5 py-1.5 text-center font-bold text-[11px] bg-emerald-100 text-emerald-800"
                            style={{ width: "70px", minWidth: "70px" }}
                          >
                            ยอดขายรวม
                            <br />
                            (PC)
                          </th>
                          <th
                            colSpan={12}
                            className="border border-slate-200 px-0.5 py-1.5 text-center text-blue-700 font-bold text-[12px] bg-blue-50"
                          >
                            เปรียบเทียบยอดขายต่อเดือนปี {filters.year}
                          </th>
                        </tr>
                        {/* Level 2 Headers - Unit Types */}
                        <tr className="bg-slate-50">
                          <th
                            colSpan={3}
                            className="border border-slate-200 px-0.5 py-1 text-center text-emerald-700 font-semibold text-[9px] bg-emerald-50/50"
                          >
                            กล่อง
                          </th>
                          <th
                            colSpan={3}
                            className="border border-slate-200 px-0.5 py-1 text-center text-emerald-700 font-semibold text-[9px] bg-emerald-50/50"
                          >
                            แพ็ค
                          </th>
                          <th
                            colSpan={3}
                            className="border border-slate-200 px-0.5 py-1 text-center text-emerald-700 font-semibold text-[9px] bg-emerald-50/50"
                          >
                            ปี๊บ/ซอง
                          </th>
                          {/* Months */}
                          <th rowSpan={2} className="border border-slate-200 px-0.5 py-1 text-center text-blue-600 font-semibold text-[11px]">
                            ม.ค.
                          </th>
                          <th rowSpan={2} className="border border-slate-200 px-0.5 py-1 text-center text-blue-600 font-semibold text-[11px]">
                            ก.พ.
                          </th>
                          <th rowSpan={2} className="border border-slate-200 px-0.5 py-1 text-center text-blue-600 font-semibold text-[11px]">
                            มี.ค.
                          </th>
                          <th rowSpan={2} className="border border-slate-200 px-0.5 py-1 text-center text-blue-600 font-semibold text-[11px]">
                            เม.ย.
                          </th>
                          <th rowSpan={2} className="border border-slate-200 px-0.5 py-1 text-center text-blue-600 font-semibold text-[11px]">
                            พ.ค.
                          </th>
                          <th rowSpan={2} className="border border-slate-200 px-0.5 py-1 text-center text-blue-600 font-semibold text-[11px]">
                            มิ.ย.
                          </th>
                          <th rowSpan={2} className="border border-slate-200 px-0.5 py-1 text-center text-blue-600 font-semibold text-[11px]">
                            ก.ค.
                          </th>
                          <th rowSpan={2} className="border border-slate-200 px-0.5 py-1 text-center text-blue-600 font-semibold text-[11px]">
                            ส.ค.
                          </th>
                          <th rowSpan={2} className="border border-slate-200 px-0.5 py-1 text-center text-blue-600 font-semibold text-[11px]">
                            ก.ย.
                          </th>
                          <th rowSpan={2} className="border border-slate-200 px-0.5 py-1 text-center text-blue-600 font-semibold text-[11px]">
                            ต.ค.
                          </th>
                          <th rowSpan={2} className="border border-slate-200 px-0.5 py-1 text-center text-blue-600 font-semibold text-[11px]">
                            พ.ย.
                          </th>
                          <th rowSpan={2} className="border border-slate-200 px-0.5 py-1 text-center text-blue-600 font-semibold text-[11px]">
                            ธ.ค.
                          </th>
                        </tr>
                        {/* Level 3 Headers - Details */}
                        <tr className="bg-slate-50 text-[8px]">
                          {/* Box */}
                          <th className="border border-slate-200 px-0.5 py-0.5 text-center text-emerald-600 font-medium" style={{ width: "50px", minWidth: "50px" }}>
                            จำนวน
                          </th>
                          <th className="border border-slate-200 px-0.5 py-0.5 text-center text-emerald-600 font-medium" style={{ width: "55px", minWidth: "55px" }}>
                            ราคา
                          </th>
                          <th className="border border-slate-200 px-0.5 py-0.5 text-center text-emerald-600 font-medium" style={{ width: "65px", minWidth: "65px" }}>
                            ยอดขายรวม
                          </th>
                          {/* Pack */}
                          <th className="border border-slate-200 px-0.5 py-0.5 text-center text-emerald-600 font-medium" style={{ width: "50px", minWidth: "50px" }}>
                            จำนวน
                          </th>
                          <th className="border border-slate-200 px-0.5 py-0.5 text-center text-emerald-600 font-medium" style={{ width: "55px", minWidth: "55px" }}>
                            ราคา
                          </th>
                          <th className="border border-slate-200 px-0.5 py-0.5 text-center text-emerald-600 font-medium" style={{ width: "65px", minWidth: "65px" }}>
                            ยอดขายรวม
                          </th>
                          {/* Piece */}
                          <th className="border border-slate-200 px-0.5 py-0.5 text-center text-emerald-600 font-medium" style={{ width: "50px", minWidth: "50px" }}>
                            จำนวน
                          </th>
                          <th className="border border-slate-200 px-0.5 py-0.5 text-center text-emerald-600 font-medium" style={{ width: "55px", minWidth: "55px" }}>
                            ราคา
                          </th>
                          <th className="border border-slate-200 px-0.5 py-0.5 text-center text-emerald-600 font-medium" style={{ width: "65px", minWidth: "65px" }}>
                            ยอดขายรวม
                          </th>
                          {/* Monthly columns - removed empty row because months now use rowSpan={2} */}
                        </tr>
                      </thead>
                      <tbody>
                        {report.products.map((product, index) => {
                          const units = product.unitTypeSales;
                          const monthly = product.monthlySales;

                          return (
                            <tr
                              key={index}
                              className="text-[9px] text-slate-700 group hover:bg-slate-50/50"
                            >
                              {/* Product Name */}
                              <td className="border border-slate-200 px-1 py-1 text-left font-medium text-slate-900 md:sticky left-0 md:z-10 bg-white group-hover:bg-slate-50/50 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                {product.productName}
                              </td>

                              {/* Box */}
                              <td className="border border-slate-200 px-0.5 py-1 text-center bg-emerald-50/30">
                                {units.box.quantity > 0
                                  ? units.box.quantity.toLocaleString("th-TH")
                                  : "-"}
                              </td>
                              <td className="border border-slate-200 px-0.5 py-1 text-right bg-emerald-50/30">
                                {units.box.avgPrice > 0
                                  ? formatCurrencyTh(units.box.avgPrice)
                                  : "-"}
                              </td>
                              <td className="border border-slate-200 px-0.5 py-1 text-right bg-emerald-50/30 font-semibold">
                                {units.box.totalSales > 0
                                  ? formatCurrencyTh(units.box.totalSales)
                                  : "-"}
                              </td>

                              {/* Pack */}
                              <td className="border border-slate-200 px-0.5 py-1 text-center bg-emerald-50/30">
                                {units.pack.quantity > 0
                                  ? units.pack.quantity.toLocaleString("th-TH")
                                  : "-"}
                              </td>
                              <td className="border border-slate-200 px-0.5 py-1 text-right bg-emerald-50/30">
                                {units.pack.avgPrice > 0
                                  ? formatCurrencyTh(units.pack.avgPrice)
                                  : "-"}
                              </td>
                              <td className="border border-slate-200 px-0.5 py-1 text-right bg-emerald-50/30 font-semibold">
                                {units.pack.totalSales > 0
                                  ? formatCurrencyTh(units.pack.totalSales)
                                  : "-"}
                              </td>

                              {/* Piece */}
                              <td className="border border-slate-200 px-0.5 py-1 text-center bg-emerald-50/30">
                                {units.piece.quantity > 0
                                  ? units.piece.quantity.toLocaleString("th-TH")
                                  : "-"}
                              </td>
                              <td className="border border-slate-200 px-0.5 py-1 text-right bg-emerald-50/30">
                                {units.piece.avgPrice > 0
                                  ? formatCurrencyTh(units.piece.avgPrice)
                                  : "-"}
                              </td>
                              <td className="border border-slate-200 px-0.5 py-1 text-right bg-emerald-50/30 font-semibold">
                                {units.piece.totalSales > 0
                                  ? formatCurrencyTh(units.piece.totalSales)
                                  : "-"}
                              </td>

                              {/* Total */}
                              <td className="border border-slate-200 px-0.5 py-1 text-right font-bold bg-emerald-100 text-emerald-800">
                                {formatCurrencyTh(product.totalSalesAllUnits)}
                              </td>

                              {/* Monthly Sales with % below */}
                              {monthly.map((month, mIdx) => (
                                <td
                                  key={mIdx}
                                  className="border border-slate-200 px-0.5 py-1 text-right bg-blue-50/20"
                                >
                                  <div className="font-medium">
                                    {month.totalSales > 0
                                      ? formatCurrencyTh(month.totalSales)
                                      : "-"}
                                  </div>
                                  <div className="text-[8px] mt-0.5">
                                    {mIdx === 0 ? (
                                      <span className="text-slate-400">-</span>
                                    ) : (
                                      <span className={month.diffPercent < 0 ? 'text-red-600 font-semibold' : month.diffPercent > 0 ? 'text-green-600 font-semibold' : 'text-slate-500'}>
                                        {formatPercent(month.diffPercent)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gradient-to-r from-slate-100 to-slate-50 text-[9px] font-bold text-slate-900">
                          <td className="border border-slate-300 px-1 py-2 text-center md:sticky left-0 md:z-10 bg-gradient-to-r from-slate-100 to-slate-50 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            รวมทั้งหมด
                          </td>
                          {/* Box columns */}
                          <td className="border border-slate-300 px-0.5 py-2 text-center bg-emerald-50/30" colSpan={3}>-</td>
                          {/* Pack columns */}
                          <td className="border border-slate-300 px-0.5 py-2 text-center bg-emerald-50/30" colSpan={3}>-</td>
                          {/* Piece columns */}
                          <td className="border border-slate-300 px-0.5 py-2 text-center bg-emerald-50/30" colSpan={3}>-</td>
                          {/* PC Total */}
                          <td className="border border-slate-300 px-1 py-2 text-right bg-emerald-100 text-emerald-800">
                            {formatCurrencyTh(report.products.reduce((sum, p) => sum + p.totalSalesAllUnits, 0))}
                          </td>
                          {/* Monthly columns with % */}
                          {report.products[0]?.monthlySales.map((_, mIdx) => {
                            const monthTotal = report.products.reduce((sum, p) => sum + (p.monthlySales[mIdx]?.totalSales || 0), 0);
                            const prevMonthTotal = mIdx > 0 ? report.products.reduce((sum, p) => sum + (p.monthlySales[mIdx - 1]?.totalSales || 0), 0) : 0;
                            const diffPercent = mIdx > 0 && prevMonthTotal !== 0 ? ((monthTotal - prevMonthTotal) / prevMonthTotal) * 100 : 0;
                            return (
                              <td key={mIdx} className="border border-slate-300 px-0.5 py-2 text-right bg-blue-50/30">
                                <div className="font-bold">
                                  {monthTotal > 0 ? formatCurrencyTh(monthTotal) : "-"}
                                </div>
                                <div className="text-[8px] mt-0.5">
                                  {mIdx === 0 ? (
                                    <span className="text-slate-400">-</span>
                                  ) : (
                                    <span className={diffPercent < 0 ? 'text-red-600 font-semibold' : diffPercent > 0 ? 'text-green-600 font-semibold' : 'text-slate-500'}>
                                      {formatPercent(diffPercent)}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Mobile Card View (shown on mobile/tablet) */}
                <div className="lg:hidden space-y-4">
                  {report.products.map((product, productIndex) => (
                    <MobileProductCard
                      key={productIndex}
                      product={product}
                      monthOptions={monthOptions}
                      formatCurrencyTh={formatCurrencyTh}
                      formatPercent={formatPercent}
                    />
                  ))}
                </div>

                {/* Summary Section - Show on both screen and print */}
                <div className="mt-6 text-sm text-slate-700">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-center gap-3 rounded-2xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 text-left lg:text-center shadow-lg print:rounded-none print:border-slate-300 print:text-[11px]">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <div>
                        <div className="text-xs text-blue-600 font-medium mb-0.5">ยอดขายรวมทั้งหมด</div>
                        <div className="text-xl font-bold text-blue-900">{formatCurrencyThWithBaht(report.metadata.yearTotalSales)}</div>
                      </div>
                    </div>
                    <span className="hidden lg:block min-h-[40px] w-px bg-blue-300" />
                    <div className="flex items-center gap-2 lg:border-0 border-t border-blue-200 lg:pt-0 pt-3">
                      <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <div className="text-xs text-indigo-600 font-medium mb-0.5">ช่วงเดือน</div>
                        <div className="text-base font-bold text-indigo-900">
                          {monthOptions[filters.startMonth - 1]?.label} - {monthOptions[filters.endMonth - 1]?.label}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Month-over-Month Comparison (hidden on mobile, shown on desktop) */}
                <div className="hidden lg:block mt-4 rounded-lg border border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50/40 p-5 shadow-sm print:border-slate-400 print:bg-white">
                  <div className="mb-4 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <h3 className="text-sm font-bold text-slate-800">สรุปผลต่างเดือนต่อเดือนทุก SKU (Month-over-Month)</h3>
                    </div>
                    <p className="text-xs text-slate-500 ml-7">ช่วงเดือน: {monthOptions[filters.startMonth - 1]?.label} - {monthOptions[filters.endMonth - 1]?.label} {filters.year}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    {report.products[0]?.monthlySales.slice(filters.startMonth - 1, filters.endMonth).map((_, idx) => {
                      const actualMonthIdx = filters.startMonth - 1 + idx;
                      const currentMonthTotal = report.products.reduce((sum, p) => sum + (p.monthlySales[actualMonthIdx]?.totalSales || 0), 0);
                      const prevMonthTotal = actualMonthIdx > 0 ? report.products.reduce((sum, p) => sum + (p.monthlySales[actualMonthIdx - 1]?.totalSales || 0), 0) : 0;
                      const diffAmount = actualMonthIdx > 0 ? currentMonthTotal - prevMonthTotal : 0;
                      const diffPercent = actualMonthIdx > 0 && prevMonthTotal !== 0 ? ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100 : 0;

                      return (
                        <div
                          key={actualMonthIdx}
                          className="relative p-3 rounded-lg bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-700 text-sm">
                              {monthOptions[actualMonthIdx]?.label}
                            </span>
                            {actualMonthIdx !== 0 && (
                              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                diffAmount < 0
                                  ? 'bg-red-100 text-red-700'
                                  : diffAmount > 0
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {diffAmount >= 0 ? '↑' : '↓'} {Math.abs(diffPercent).toFixed(1)}%
                              </div>
                            )}
                          </div>
                          {actualMonthIdx === 0 ? (
                            <div className="text-slate-400 text-[11px] italic flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              ไม่มีข้อมูลเปรียบเทียบ
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-baseline justify-between">
                                <span className="text-[10px] text-slate-500 font-medium">ผลต่าง:</span>
                                <span className={`text-sm font-bold tabular-nums ${
                                  diffAmount < 0 ? 'text-red-600' : diffAmount > 0 ? 'text-green-600' : 'text-slate-600'
                                }`}>
                                  {diffAmount >= 0 ? '+' : ''}{formatCurrencyTh(diffAmount)} ฿
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {state.status === "idle" && (
              <div className="text-center py-12 text-slate-500">
                กรุณาเลือกพนักงานและปีเพื่อดูรายงาน
              </div>
            )}

            {state.status === "error" && (
              <div className="text-center py-12 text-red-600">
                {state.message}
              </div>
            )}

            {state.status === "loading" && (
              <div className="text-center py-12 text-slate-500">
                กำลังโหลดข้อมูล...
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

