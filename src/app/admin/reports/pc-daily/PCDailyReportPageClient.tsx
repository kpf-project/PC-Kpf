"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminNav from "@/app/admin/_components/AdminNav";
import { PaginationControls } from "@/app/admin/reports/_components/PaginationControls";
import { ReportFilters } from "./components/ReportFilters";
import { ReportCard } from "./components/ReportCard";
import dayjs from "dayjs";

type EmployeeOption = {
  id: string;
  name: string;
};

type StoreOption = {
  id: string;
  name: string;
};

type FilterState = {
  date: string | null;
  dateEnd: string | null;
  employeeId: string | null;
  storeId: string | null;
  status: "all" | "draft" | "submitted";
  page: number;
  limit: number;
};

type PCDailyReport = {
  id: string;
  report_date: string;
  employee_id: string;
  employee_name: string;
  store_id: string;
  store_name: string;
  customer_activities: string | null;
  competitor_promo_photos: string[];
  competitor_promo_notes: string | null;
  store_promo_photos: string[];
  store_promo_notes: string | null;
  status: "draft" | "submitted";
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

type PCShelfPhoto = {
  id: string;
  report_id: string;
  photo_url: string;
  storage_path: string;
  caption: string | null;
  uploaded_at: string;
  created_at: string;
};

type PCStockUsage = {
  id: string;
  report_id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  quantities: Record<string, number>;
  total_base_units: number;
  created_at: string;
};

type ReportData = {
  success: boolean;
  reports: PCDailyReport[];
  photos: Record<string, PCShelfPhoto[]>;
  stockUsage: Record<string, PCStockUsage[]>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type Props = {
  employeeOptions: EmployeeOption[];
  storeOptions: StoreOption[];
};

export function PCDailyReportPageClient({ employeeOptions, storeOptions }: Props) {
  const today = dayjs().format("YYYY-MM-DD");

  const [filters, setFilters] = useState<FilterState>({
    date: today,
    dateEnd: null,
    employeeId: null,
    storeId: null,
    status: "all",
    page: 1,
    limit: 20,
  });

  const [isExporting, setIsExporting] = useState(false);

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();

    if (filters.date) params.append("date", filters.date);
    if (filters.dateEnd) params.append("dateEnd", filters.dateEnd);
    if (filters.employeeId) params.append("employee_id", filters.employeeId);
    if (filters.storeId) params.append("store_id", filters.storeId);
    if (filters.status !== "all") params.append("status", filters.status);

    params.append("page", String(filters.page));
    params.append("limit", String(filters.limit));
    params.append("include_details", "true");

    return params.toString();
  }, [filters]);

  // Fetch reports
  const { data, isLoading, error } = useQuery<ReportData>({
    queryKey: ["pc-daily-reports", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/admin/pc-reports?${queryParams}`);
      if (!res.ok) {
        throw new Error("Failed to fetch reports");
      }
      return res.json();
    },
    staleTime: 30000, // 30 seconds
  });

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      page: 1, // Reset to first page when filters change
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      date: today,
      dateEnd: null,
      employeeId: null,
      storeId: null,
      status: "all",
      page: 1,
      limit: 20,
    });
  }, [today]);

  // Pagination handlers
  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handlePageSizeChange = useCallback((limit: number) => {
    setFilters((prev) => ({ ...prev, limit, page: 1 }));
  }, []);

  // Export all reports to PDF
  const handleExportAll = useCallback(async () => {
    setIsExporting(true);
    try {
      const exportParams = new URLSearchParams();
      if (filters.date) exportParams.append("date", filters.date);
      if (filters.dateEnd) exportParams.append("dateEnd", filters.dateEnd);
      if (filters.employeeId) exportParams.append("employee_id", filters.employeeId);
      if (filters.storeId) exportParams.append("store_id", filters.storeId);
      if (filters.status !== "all") exportParams.append("status", filters.status);
      exportParams.append("format", "pdf");

      const res = await fetch(`/api/admin/pc-reports/export?${exportParams.toString()}`);

      if (!res.ok) {
        throw new Error("Failed to export reports");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pc-reports-${filters.date || "all"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export error:", err);
      alert("เกิดข้อผิดพลาดในการ export PDF");
    } finally {
      setIsExporting(false);
    }
  }, [filters]);

  // Pagination info
  const paginationInfo = useMemo(() => {
    if (!data?.pagination) {
      return {
        page: 1,
        pageSize: filters.limit,
        totalRows: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      };
    }

    return {
      page: data.pagination.page,
      pageSize: data.pagination.limit,
      totalRows: data.pagination.total,
      totalPages: data.pagination.totalPages,
      hasNextPage: data.pagination.page < data.pagination.totalPages,
      hasPrevPage: data.pagination.page > 1,
    };
  }, [data, filters.limit]);

  return (
    <>
      <AdminNav />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-800">
              📋 รายงาน PC รายวัน
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              ดูรายงานการทำงานของ PC ประจำวัน พร้อมรูปถ่าย สินค้าที่แกะ และกิจกรรมลูกค้า
            </p>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <ReportFilters
              filters={filters}
              employeeOptions={employeeOptions}
              storeOptions={storeOptions}
              onFilterChange={handleFilterChange}
              onClear={handleClearFilters}
              onExportAll={handleExportAll}
              isExporting={isExporting}
              disabled={isLoading}
            />
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                <p className="mt-4 text-sm text-slate-600">กำลังโหลดรายงาน...</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm font-medium text-red-800">
                เกิดข้อผิดพลาดในการโหลดข้อมูล
              </p>
              <p className="mt-1 text-xs text-red-600">
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
            </div>
          )}

          {/* Report count */}
          {!isLoading && !error && data && (
            <div className="mb-4 text-sm text-slate-600">
              พบ {data.pagination.total} รายงาน
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && data && data.reports.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <span className="text-3xl">📭</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-800">
                ไม่พบรายงาน
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                ไม่มีรายงานที่ตรงกับเงื่อนไขการค้นหา
              </p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-4 inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                ล้างฟิลเตอร์
              </button>
            </div>
          )}

          {/* Report list */}
          {!isLoading && !error && data && data.reports.length > 0 && (
            <div className="space-y-6">
              {data.reports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  photos={data.photos[report.id] || []}
                  stockUsage={data.stockUsage[report.id] || []}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && !error && data && data.reports.length > 0 && (
            <PaginationControls
              pagination={paginationInfo}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              disabled={isLoading}
              pageSizeOptions={[10, 20, 50]}
            />
          )}
        </div>
      </div>
    </>
  );
}
