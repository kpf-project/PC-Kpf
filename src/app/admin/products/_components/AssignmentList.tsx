"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, RefreshCw, Trash2, ShoppingBag, ChevronLeft, ChevronRight, Edit } from "lucide-react";
import clsx from "clsx";
import type { ProductAssignment } from "@/lib/supabaseProducts";

type StoreOption = {
  id: string;
  name: string;
  province?: string | null;
};

interface AssignmentListProps {
  assignments: ProductAssignment[];
  stores: StoreOption[];
  isLoading: boolean;
  onDelete: (assignmentId: string) => Promise<void>;
  onEdit?: (productId: string) => void;
}

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return currencyFormatter.format(value).replace("฿", "฿ ");
}

export default function AssignmentList({
  assignments,
  stores,
  isLoading,
  onDelete,
  onEdit
}: AssignmentListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Responsive items per page
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Detect mobile/desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setItemsPerPage(10); // Mobile: 10
      } else {
        setItemsPerPage(20); // Desktop: 20
      }
    };

    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Filtered assignments (search across ALL pages)
  const filteredAssignments = useMemo(() => {
    if (!searchQuery.trim()) {
      return assignments;
    }

    const query = searchQuery.trim().toLowerCase();
    return assignments.filter(
      (assignment) =>
        assignment.productName.toLowerCase().includes(query) ||
        assignment.productCode.toLowerCase().includes(query)
    );
  }, [assignments, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredAssignments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAssignments = filteredAssignments.slice(startIndex, endIndex);

  // Ensure current page is valid
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-4 rounded-3xl border-2 border-sky-200 bg-white/60 p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
            <ShoppingBag className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">รายการสินค้าที่ผูกไว้ทั้งหมด</p>
            <p className="text-xs text-slate-500">
              แสดง {filteredAssignments.length} รายการ
              {searchQuery && ` (ค้นหา: "${searchQuery}")`}
            </p>
          </div>
        </div>

        {/* Search Box */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาสินค้า..."
            className="w-full rounded-2xl border-2 border-sky-200 bg-white px-4 py-2 pl-10 text-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
        </div>
      ) : filteredAssignments.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
          {searchQuery
            ? `ไม่พบสินค้าที่ค้นหา "${searchQuery}"`
            : "ยังไม่มีสินค้าที่ผูกกับพนักงาน"}
        </div>
      ) : (
        <>
          {/* Assignment List */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {paginatedAssignments.map((assignment) => {
              const store = assignment.storeId
                ? stores.find((item) => item.id === assignment.storeId)
                : null;
              const storeLabel = store?.name ?? (assignment.storeId ? "ร้านถูกลบ" : "ทุกพื้นที่");

              return (
                <div
                  key={assignment.assignmentId}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {assignment.productName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {assignment.productCode + " · " + storeLabel}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {assignment.units.map((unit) => (
                          <span
                            key={unit.assignmentUnitId}
                            className={clsx(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                              unit.isActive
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-50 text-slate-400"
                            )}
                          >
                            <span>{unit.unitName}</span>
                            <span className="text-[11px] text-slate-400">
                              {formatCurrency(unit.pricePc)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(assignment.productId)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-600 transition hover:bg-sky-100"
                        >
                          <Edit className="h-4 w-4" /> แก้ไข
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDelete(assignment.assignmentId)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" /> ลบ
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border-2 border-sky-200 bg-white/60 px-4 py-4 backdrop-blur-sm sm:flex-row">
              <p className="text-sm font-medium text-slate-600">
                แสดง {startIndex + 1}-{Math.min(endIndex, filteredAssignments.length)} จาก{" "}
                {filteredAssignments.length} รายการ
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-sky-200 bg-white text-slate-700 transition-all hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={clsx(
                          "inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-all",
                          currentPage === pageNum
                            ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30"
                            : "border-2 border-sky-200 bg-white text-slate-700 hover:bg-sky-50"
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-sky-200 bg-white text-slate-700 transition-all hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
