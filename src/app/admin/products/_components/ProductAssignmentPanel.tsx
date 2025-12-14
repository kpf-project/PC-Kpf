"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Package,
  Search,
  CheckCircle,
  Save,
  X,
  Trash2,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { ProductCatalogItem, ProductAssignment } from "@/lib/supabaseProducts";

// Types
type EmployeeOption = {
  id: string;
  name: string;
  storeIds?: string[];
};

type StoreOption = {
  id: string;
  name: string;
  province?: string | null;
};

type AssignmentUnitForm = {
  unitId: string;
  unitName: string;
  multiplierToBase: number;
  pricePc: string;
  enabled: boolean;
};

type SelectedProductState = {
  productId: string;
  productCode: string;
  productName: string;
  units: AssignmentUnitForm[];
};

// Utility: Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Props
interface ProductAssignmentPanelProps {
  employees: EmployeeOption[];
  stores: StoreOption[];
  catalog: ProductCatalogItem[];
  assignments: ProductAssignment[];
  companies: Array<{ id: string; name: string }>;
  selectedEmployeeId: string;
  selectedStoreId: string;
  onEmployeeChange: (employeeId: string) => void;
  onStoreChange: (storeId: string) => void;
  onSave: (productIds: string[], unitsData: Map<string, AssignmentUnitForm[]>) => Promise<void>;
  onRefresh: () => Promise<void>;
  isLoading?: boolean;
  isSaving?: boolean;
  error?: string | null;
  success?: string | null;
  autoSelectProductId?: string;
  onAutoSelectComplete?: () => void;
}

export default function ProductAssignmentPanel({
  employees,
  stores,
  catalog,
  assignments,
  companies,
  selectedEmployeeId,
  selectedStoreId,
  onEmployeeChange,
  onStoreChange,
  onSave,
  onRefresh,
  isLoading = false,
  isSaving = false,
  error = null,
  success = null,
  autoSelectProductId,
  onAutoSelectComplete,
}: ProductAssignmentPanelProps) {
  // State
  const [searchInput, setSearchInput] = useState("");
  const [_categoryFilter, _setCategoryFilter] = useState<string>("all"); // Unused - prefixed
  const [statusFilter, setStatusFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [selectedProductsData, setSelectedProductsData] = useState<Map<string, SelectedProductState>>(new Map());
  const [showMobilePriceModal, setShowMobilePriceModal] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Debounced search
  const debouncedSearch = useDebounce(searchInput, 300);

  // Detect mobile/desktop for items per page
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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, companyFilter]);

  // Filter stores for selected employee
  const storeOptionsForEmployee = useMemo(() => {
    if (!selectedEmployeeId) return stores;
    const employee = employees.find((emp) => emp.id === selectedEmployeeId);
    if (!employee || !employee.storeIds || employee.storeIds.length === 0) {
      return stores;
    }
    return stores.filter((store) => employee.storeIds!.includes(store.id));
  }, [stores, selectedEmployeeId, employees]);

  // Check if product is assigned
  const isProductAssigned = useCallback(
    (productId: string): boolean => {
      return assignments.some((a) => a.productId === productId);
    },
    [assignments]
  );

  // Filtered catalog
  const filteredCatalog = useMemo(() => {
    let filtered = catalog;

    // Search filter
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.code.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter === "assigned") {
      filtered = filtered.filter((product) => isProductAssigned(product.id));
    } else if (statusFilter === "unassigned") {
      filtered = filtered.filter((product) => !isProductAssigned(product.id));
    }

    // Company filter
    if (companyFilter !== "all") {
      filtered = filtered.filter((product) =>
        companyFilter === "none" ? !product.companyId : product.companyId === companyFilter
      );
    }

    return filtered;
  }, [catalog, debouncedSearch, statusFilter, companyFilter, isProductAssigned]);

  // Pagination
  const totalPages = Math.ceil(filteredCatalog.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCatalog = filteredCatalog.slice(startIndex, endIndex);

  // Ensure current page is valid
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Toggle product selection
  const handleToggleProduct = useCallback((productId: string) => {
    setSelectedProductIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(productId)) {
        updated.delete(productId);
        // Also remove from selectedProductsData
        setSelectedProductsData((prevData) => {
          const newData = new Map(prevData);
          newData.delete(productId);
          return newData;
        });
      } else {
        updated.add(productId);
      }
      return updated;
    });
  }, []);

  // Toggle all products
  const handleToggleAll = useCallback(() => {
    if (selectedProductIds.size === filteredCatalog.length && filteredCatalog.length > 0) {
      setSelectedProductIds(new Set());
      setSelectedProductsData(new Map());
    } else {
      setSelectedProductIds(new Set(filteredCatalog.map((p) => p.id)));
    }
  }, [filteredCatalog, selectedProductIds.size]);

  // Initialize product data when selected
  useEffect(() => {
    const newData = new Map(selectedProductsData);
    let hasChanges = false;

    selectedProductIds.forEach((productId) => {
      if (!newData.has(productId)) {
        const product = catalog.find((p) => p.id === productId);
        if (product) {
          const existingAssignment = assignments.find((a) => a.productId === productId);
          newData.set(productId, {
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            units: product.units.map((unit) => {
              const existingUnit = existingAssignment?.units.find((u) => u.unitId === unit.id);
              return {
                unitId: unit.id,
                unitName: unit.name,
                multiplierToBase: unit.multiplierToBase,
                pricePc: existingUnit?.pricePc ? existingUnit.pricePc.toString() : "",
                enabled: existingUnit?.isActive || false,
              };
            }),
          });
          hasChanges = true;
        }
      }
    });

    // Remove deselected products
    newData.forEach((_, productId) => {
      if (!selectedProductIds.has(productId)) {
        newData.delete(productId);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setSelectedProductsData(newData);
    }
  }, [selectedProductIds, catalog, assignments, selectedProductsData]);

  // Auto-select product when editing from AssignmentList
  useEffect(() => {
    if (autoSelectProductId && catalog.length > 0) {
      const productExists = catalog.some((p) => p.id === autoSelectProductId);
      if (productExists) {
        setSelectedProductIds((prev) => {
          const updated = new Set(prev);
          updated.add(autoSelectProductId);
          return updated;
        });
      }
      // Call completion callback
      if (onAutoSelectComplete) {
        onAutoSelectComplete();
      }
    }
  }, [autoSelectProductId, catalog, onAutoSelectComplete]);

  // Update unit data
  const handleUnitChange = useCallback(
    (productId: string, unitId: string, update: Partial<AssignmentUnitForm>) => {
      setSelectedProductsData((prev) => {
        const newData = new Map(prev);
        const productData = newData.get(productId);
        if (productData) {
          newData.set(productId, {
            ...productData,
            units: productData.units.map((unit) =>
              unit.unitId === unitId ? { ...unit, ...update } : unit
            ),
          });
        }
        return newData;
      });
    },
    []
  );

  // Handle save
  const handleSave = async () => {
    if (selectedProductIds.size === 0) {
      return;
    }

    const unitsData = new Map<string, AssignmentUnitForm[]>();
    selectedProductsData.forEach((productData, productId) => {
      unitsData.set(productId, productData.units);
    });

    await onSave(Array.from(selectedProductIds), unitsData);
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedProductIds(new Set());
    setSelectedProductsData(new Map());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">ผูกสินค้าให้พนักงาน</h2>
          <p className="text-sm text-slate-500">
            เลือกหลายสินค้าพร้อมกัน กำหนดราคา แล้วบันทึกทีเดียว
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading || isSaving}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={clsx("h-4 w-4", isLoading && "animate-spin")} />
          รีเฟรช
        </button>
      </div>

      {/* Employee & Store Selection */}
      <div className="grid gap-4 rounded-3xl border-2 border-sky-100 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm md:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-700">พนักงาน *</label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => onEmployeeChange(e.target.value)}
            disabled={isSaving}
            className="mt-2 w-full rounded-2xl border-2 border-sky-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">เลือกพนักงาน</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">ร้าน/พื้นที่</label>
          <select
            value={selectedStoreId}
            onChange={(e) => onStoreChange(e.target.value)}
            disabled={!selectedEmployeeId || isSaving}
            className="mt-2 w-full rounded-2xl border-2 border-sky-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">ทุกพื้นที่ที่รับผิดชอบ</option>
            {storeOptionsForEmployee.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} {store.province ? `(${store.province})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error/Success Messages */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1">
                {error.split("\n").map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700"
          >
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1">{success}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!selectedEmployeeId ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <Package className="mx-auto h-16 w-16 text-slate-300" />
          <h3 className="mt-4 text-lg font-bold text-slate-700">กรุณาเลือกพนักงาน</h3>
          <p className="mt-2 text-sm text-slate-500">
            เลือกพนักงานก่อนเพื่อเริ่มผูกสินค้า
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: Two-Panel Layout */}
          <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,40%)_minmax(0,60%)]">
            {/* Left Panel: Product List */}
            <LeftPanel
              paginatedCatalog={paginatedCatalog}
              filteredCatalog={filteredCatalog}
              selectedProductIds={selectedProductIds}
              searchInput={searchInput}
              statusFilter={statusFilter}
              companyFilter={companyFilter}
              companies={companies}
              isProductAssigned={isProductAssigned}
              isLoading={isLoading}
              currentPage={currentPage}
              totalPages={totalPages}
              startIndex={startIndex}
              endIndex={endIndex}
              onSearchChange={setSearchInput}
              onStatusFilterChange={setStatusFilter}
              onCompanyFilterChange={setCompanyFilter}
              onToggleProduct={handleToggleProduct}
              onToggleAll={handleToggleAll}
              onPageChange={setCurrentPage}
            />

            {/* Right Panel: Assignment Configuration */}
            <RightPanel
              selectedProductsData={selectedProductsData}
              selectedProductIds={selectedProductIds}
              isSaving={isSaving}
              onUnitChange={handleUnitChange}
              onSave={handleSave}
              onClear={handleClearSelection}
            />
          </div>

          {/* Mobile: Single Panel + Modal */}
          <div className="space-y-4 lg:hidden">
            <MobileProductList
              paginatedCatalog={paginatedCatalog}
              filteredCatalog={filteredCatalog}
              selectedProductIds={selectedProductIds}
              searchInput={searchInput}
              statusFilter={statusFilter}
              companyFilter={companyFilter}
              companies={companies}
              isProductAssigned={isProductAssigned}
              isLoading={isLoading}
              currentPage={currentPage}
              totalPages={totalPages}
              startIndex={startIndex}
              endIndex={endIndex}
              onSearchChange={setSearchInput}
              onStatusFilterChange={setStatusFilter}
              onCompanyFilterChange={setCompanyFilter}
              onToggleProduct={handleToggleProduct}
              onToggleAll={handleToggleAll}
              onOpenPriceModal={() => setShowMobilePriceModal(true)}
              onPageChange={setCurrentPage}
            />

            {/* Mobile Action Bar */}
            {selectedProductIds.size > 0 && (
              <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-sky-200 bg-white p-4 shadow-2xl"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-900">
                    เลือกแล้ว {selectedProductIds.size} รายการ
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      ล้าง
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMobilePriceModal(true)}
                      className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-sky-600 hover:to-blue-700"
                    >
                      ตั้งราคา
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Mobile Price Modal */}
            <AnimatePresence>
              {showMobilePriceModal && (
                <MobilePriceModal
                  selectedProductsData={selectedProductsData}
                  selectedProductIds={selectedProductIds}
                  isSaving={isSaving}
                  onClose={() => setShowMobilePriceModal(false)}
                  onUnitChange={handleUnitChange}
                  onSave={async () => {
                    await handleSave();
                    setShowMobilePriceModal(false);
                  }}
                  onClear={handleClearSelection}
                />
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

// Left Panel Component (Desktop)
function LeftPanel({
  paginatedCatalog,
  filteredCatalog,
  selectedProductIds,
  searchInput,
  statusFilter,
  companyFilter,
  companies,
  isProductAssigned,
  isLoading,
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  onSearchChange,
  onStatusFilterChange,
  onCompanyFilterChange,
  onToggleProduct,
  onToggleAll,
  onPageChange,
}: {
  paginatedCatalog: ProductCatalogItem[];
  filteredCatalog: ProductCatalogItem[];
  selectedProductIds: Set<string>;
  searchInput: string;
  statusFilter: "all" | "assigned" | "unassigned";
  companyFilter: string;
  companies: Array<{ id: string; name: string }>;
  isProductAssigned: (productId: string) => boolean;
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: "all" | "assigned" | "unassigned") => void;
  onCompanyFilterChange: (value: string) => void;
  onToggleProduct: (productId: string) => void;
  onToggleAll: () => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex h-[700px] flex-col rounded-3xl border-2 border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b-2 border-slate-100 p-6">
        <h3 className="text-lg font-bold text-slate-900">รายการสินค้า</h3>
        <p className="text-sm text-slate-500">
          แสดง {startIndex + 1}-{Math.min(endIndex, filteredCatalog.length)} จาก {filteredCatalog.length} รายการ
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3 border-b border-slate-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นหาชื่อหรือรหัสสินค้า..."
            className="w-full rounded-2xl border-2 border-sky-200 bg-white px-4 py-2.5 pl-11 text-sm transition-all focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as "all" | "assigned" | "unassigned")}
          className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-medium transition-all focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20"
        >
          <option value="all">สถานะ: ทั้งหมด</option>
          <option value="assigned">สถานะ: ผูกแล้ว</option>
          <option value="unassigned">สถานะ: ยังไม่ผูก</option>
        </select>

        <select
          value={companyFilter}
          onChange={(e) => onCompanyFilterChange(e.target.value)}
          className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-medium transition-all focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20"
        >
          <option value="all">บริษัท: ทั้งหมด</option>
          <option value="none">ไม่ระบุบริษัท</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>

        {filteredCatalog.length > 0 && (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100">
            <input
              type="checkbox"
              checked={selectedProductIds.size === filteredCatalog.length}
              onChange={onToggleAll}
              className="h-5 w-5 rounded-lg border-2 border-sky-300 text-sky-600 focus:ring-2 focus:ring-sky-500/30"
            />
            <span className="text-sm font-semibold text-slate-700">
              เลือกทั้งหมด ({filteredCatalog.length} รายการ)
            </span>
          </label>
        )}
      </div>

      {/* Product List */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-sky-500" />
          </div>
        ) : filteredCatalog.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">ไม่พบสินค้า</p>
            <p className="text-xs text-slate-500">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>
          </div>
        ) : (
          paginatedCatalog.map((product) => {
            const isSelected = selectedProductIds.has(product.id);
            const hasAssignment = isProductAssigned(product.id);

            return (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onClick={() => onToggleProduct(product.id)}
                className={clsx(
                  "group cursor-pointer rounded-xl border-2 p-3 transition-all",
                  isSelected
                    ? "border-sky-400 bg-sky-50 shadow-md"
                    : "border-slate-200 bg-white hover:border-sky-300 hover:shadow-sm"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleProduct(product.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-2 border-sky-300 text-sky-600 focus:ring-2 focus:ring-sky-500/30"
                  />

                  {product.companyLogoUrl ? (
                    <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden bg-transparent">
                      <Image
                        src={product.companyLogoUrl}
                        alt={product.companyName || "Company Logo"}
                        width={40}
                        height={40}
                        className="object-contain mix-blend-multiply"
                      />
                    </div>
                  ) : (
                    <div
                      className={clsx(
                        "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-all",
                        hasAssignment
                          ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white"
                          : "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500"
                      )}
                    >
                      <Package className="h-5 w-5" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-slate-900 truncate leading-tight">
                          {product.name}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">{product.code}</p>
                      </div>
                      {hasAssignment && (
                        <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {product.units.length} หน่วย
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="border-t-2 border-slate-100 p-4">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-sky-200 bg-white text-slate-700 transition-all hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 3) {
                  pageNum = i + 1;
                } else if (currentPage <= 2) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 1) {
                  pageNum = totalPages - 2 + i;
                } else {
                  pageNum = currentPage - 1 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={clsx(
                      "inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold transition-all",
                      currentPage === pageNum
                        ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg"
                        : "border-2 border-sky-200 bg-white text-slate-700 hover:bg-sky-50"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-sky-200 bg-white text-slate-700 transition-all hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">
            หน้า {currentPage} / {totalPages}
          </p>
        </div>
      )}
    </div>
  );
}

// Right Panel Component (Desktop)
function RightPanel({
  selectedProductsData,
  selectedProductIds,
  isSaving,
  onUnitChange,
  onSave,
  onClear,
}: {
  selectedProductsData: Map<string, SelectedProductState>;
  selectedProductIds: Set<string>;
  isSaving: boolean;
  onUnitChange: (productId: string, unitId: string, update: Partial<AssignmentUnitForm>) => void;
  onSave: () => Promise<void>;
  onClear: () => void;
}) {
  return (
    <div className="flex h-[700px] flex-col rounded-3xl border-2 border-sky-200 bg-gradient-to-br from-white to-sky-50/30 shadow-sm">
      {/* Header */}
      <div className="border-b-2 border-sky-100 bg-white/60 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              สินค้าที่เลือก: {selectedProductIds.size} รายการ
            </h3>
            <p className="text-sm text-slate-500">กำหนดราคาสำหรับแต่ละหน่วย</p>
          </div>
          {selectedProductIds.size > 0 && (
            <button
              type="button"
              onClick={onClear}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              ล้าง
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedProductIds.size === 0 ? (
          <div className="flex h-full min-h-[400px] items-center justify-center rounded-3xl border-2 border-dashed border-sky-200 bg-white/40 p-8 text-center">
            <div>
              <Package className="mx-auto h-16 w-16 text-sky-300" />
              <h3 className="mt-4 text-lg font-bold text-slate-700">
                เลือกสินค้าจากรายการด้านซ้าย
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                คุณสามารถเลือกหลายรายการพร้อมกันได้
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(selectedProductsData.values()).map((product) => (
              <motion.div
                key={product.productId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-2xl border-2 border-sky-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-sm">
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate leading-tight">
                      {product.productName}
                    </h4>
                    <p className="text-xs text-slate-500">{product.productCode}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {product.units.map((unit) => (
                    <div
                      key={unit.unitId}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={unit.enabled}
                        onChange={(e) =>
                          onUnitChange(product.productId, unit.unitId, {
                            enabled: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-sky-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {unit.unitName}
                        </p>
                        <p className="text-xs text-slate-500">
                          × {unit.multiplierToBase}
                        </p>
                      </div>
                      <input
                        type="number"
                        value={unit.pricePc}
                        onChange={(e) =>
                          onUnitChange(product.productId, unit.unitId, {
                            pricePc: e.target.value,
                          })
                        }
                        disabled={!unit.enabled}
                        placeholder="฿"
                        min="0"
                        step="0.01"
                        className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-right focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {selectedProductIds.size > 0 && (
        <div className="border-t-2 border-sky-100 bg-white/60 p-6 backdrop-blur-sm">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-base font-bold text-white shadow-lg shadow-sky-500/30 transition hover:from-sky-600 hover:to-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                บันทึกทั้งหมด ({selectedProductIds.size} รายการ)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// Mobile Product List Component
function MobileProductList({
  paginatedCatalog,
  filteredCatalog,
  selectedProductIds,
  searchInput,
  statusFilter,
  companyFilter,
  companies,
  isProductAssigned,
  isLoading,
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  onSearchChange,
  onStatusFilterChange,
  onCompanyFilterChange,
  onToggleProduct,
  onToggleAll,
  onOpenPriceModal: _onOpenPriceModal,
  onPageChange,
}: {
  paginatedCatalog: ProductCatalogItem[];
  filteredCatalog: ProductCatalogItem[];
  selectedProductIds: Set<string>;
  searchInput: string;
  statusFilter: "all" | "assigned" | "unassigned";
  companyFilter: string;
  companies: Array<{ id: string; name: string }>;
  isProductAssigned: (productId: string) => boolean;
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: "all" | "assigned" | "unassigned") => void;
  onCompanyFilterChange: (value: string) => void;
  onToggleProduct: (productId: string) => void;
  onToggleAll: () => void;
  onOpenPriceModal: () => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นหาชื่อหรือรหัสสินค้า..."
            className="w-full rounded-2xl border-2 border-sky-200 bg-white px-4 py-2.5 pl-11 text-sm transition-all focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as "all" | "assigned" | "unassigned")}
          className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-medium transition-all focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20"
        >
          <option value="all">สถานะ: ทั้งหมด</option>
          <option value="assigned">สถานะ: ผูกแล้ว</option>
          <option value="unassigned">สถานะ: ยังไม่ผูก</option>
        </select>

        <select
          value={companyFilter}
          onChange={(e) => onCompanyFilterChange(e.target.value)}
          className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-medium transition-all focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20"
        >
          <option value="all">บริษัท: ทั้งหมด</option>
          <option value="none">ไม่ระบุบริษัท</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>

        {filteredCatalog.length > 0 && (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100">
            <input
              type="checkbox"
              checked={selectedProductIds.size === filteredCatalog.length}
              onChange={onToggleAll}
              className="h-5 w-5 rounded-lg border-2 border-sky-300 text-sky-600"
            />
            <span className="text-sm font-semibold text-slate-700">
              เลือกทั้งหมด ({filteredCatalog.length} รายการ)
            </span>
          </label>
        )}
      </div>

      {/* Product List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-sky-500" />
          </div>
        ) : filteredCatalog.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">ไม่พบสินค้า</p>
            <p className="text-xs text-slate-500">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>
          </div>
        ) : (
          paginatedCatalog.map((product) => {
            const isSelected = selectedProductIds.has(product.id);
            const hasAssignment = isProductAssigned(product.id);

            return (
              <div
                key={product.id}
                onClick={() => onToggleProduct(product.id)}
                className={clsx(
                  "rounded-xl border-2 p-3 transition-all active:scale-[0.98]",
                  isSelected
                    ? "border-sky-400 bg-sky-50 shadow-md"
                    : "border-slate-200 bg-white active:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleProduct(product.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-2 border-sky-300 text-sky-600"
                  />

                  {product.companyLogoUrl ? (
                    <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden bg-transparent">
                      <Image
                        src={product.companyLogoUrl}
                        alt={product.companyName || "Company Logo"}
                        width={40}
                        height={40}
                        className="object-contain mix-blend-multiply"
                      />
                    </div>
                  ) : (
                    <div
                      className={clsx(
                        "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
                        hasAssignment
                          ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white"
                          : "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500"
                      )}
                    >
                      <Package className="h-5 w-5" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-slate-900 truncate leading-tight">
                          {product.name}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">{product.code}</p>
                      </div>
                      {hasAssignment && (
                        <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {product.units.length} หน่วย
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="rounded-2xl border-2 border-sky-200 bg-white/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
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
                      onClick={() => onPageChange(pageNum)}
                      className={clsx(
                        "inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-all",
                        currentPage === pageNum
                          ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg"
                          : "border-2 border-sky-200 bg-white text-slate-700 hover:bg-sky-50"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-sky-200 bg-white text-slate-700 transition-all hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <p className="text-center text-xs text-slate-500">
              แสดง {startIndex + 1}-{Math.min(endIndex, filteredCatalog.length)} จาก {filteredCatalog.length} | หน้า {currentPage}/{totalPages}
            </p>
          </div>
        </div>
      )}

      {/* Bottom spacing for floating action bar */}
      <div className="h-24" />
    </div>
  );
}

// Mobile Price Modal Component
function MobilePriceModal({
  selectedProductsData,
  selectedProductIds,
  isSaving,
  onClose,
  onUnitChange,
  onSave,
  onClear,
}: {
  selectedProductsData: Map<string, SelectedProductState>;
  selectedProductIds: Set<string>;
  isSaving: boolean;
  onClose: () => void;
  onUnitChange: (productId: string, unitId: string, update: Partial<AssignmentUnitForm>) => void;
  onSave: () => Promise<void>;
  onClear: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-100 p-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              ตั้งราคาสินค้า ({selectedProductIds.size} รายการ)
            </h3>
            <p className="text-sm text-slate-500">กำหนดราคาสำหรับแต่ละหน่วย</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {Array.from(selectedProductsData.values()).map((product) => (
            <div
              key={product.productId}
              className="rounded-xl border-2 border-sky-200 bg-white p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-sm">
                  <Package className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate leading-tight">
                    {product.productName}
                  </h4>
                  <p className="text-xs text-slate-500">{product.productCode}</p>
                </div>
              </div>

              <div className="space-y-2">
                {product.units.map((unit) => (
                  <div
                    key={unit.unitId}
                    className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={unit.enabled}
                      onChange={(e) =>
                        onUnitChange(product.productId, unit.unitId, {
                          enabled: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-sky-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {unit.unitName}
                      </p>
                      <p className="text-xs text-slate-500">
                        × {unit.multiplierToBase}
                      </p>
                    </div>
                    <input
                      type="number"
                      value={unit.pricePc}
                      onChange={(e) =>
                        onUnitChange(product.productId, unit.unitId, {
                          pricePc: e.target.value,
                        })
                      }
                      disabled={!unit.enabled}
                      placeholder="฿"
                      min="0"
                      step="0.01"
                      className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-right focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t-2 border-slate-100 p-6">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClear}
              disabled={isSaving}
              className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ล้าง
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="flex-[2] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:from-sky-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  บันทึก
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
