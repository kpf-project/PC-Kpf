"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Plus,
  Download,
  Upload,
  RefreshCw,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Sparkles,
  Package,
  Users,
  TrendingUp,
  Trash2,
  Save,
  Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { useModal } from "@/contexts/ModalContext";
import { useQuery } from "@tanstack/react-query";

import type {
  ProductAssignment,
  ProductCatalogItem,
  UpsertAssignmentInput,
  UpsertProductCatalogInput,
} from "@/lib/supabaseProducts";
import ImportModal from "@/components/ImportModal";
import CopyAssignmentModal from "@/components/CopyAssignmentModal";
import BulkCompanyAssignmentModal from "@/components/BulkCompanyAssignmentModal";

// Import new components
import SearchBar from "./_components/SearchBar";
import ProductCard from "./_components/ProductCard";
import ProductForm, { type CatalogFormState, type CatalogUnitForm } from "./_components/ProductForm";
import BulkToolbar from "./_components/BulkToolbar";
import ProductAssignmentPanel from "./_components/ProductAssignmentPanel";
import AssignmentList from "./_components/AssignmentList";

type EmployeeOption = {
  id: string;
  name: string;
  defaultStoreId?: string | null;
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

// Bulk Assignment Types
type BulkAssignmentUnit = {
  unitId: string;
  unitName: string;
  multiplierToBase: number;
  pricePc: string;
  enabled: boolean;
};

type BulkAssignmentProduct = {
  productId: string;
  productCode: string;
  productName: string;
  isSelected: boolean;
  units: BulkAssignmentUnit[];
};

// Quick Add Row Type
type QuickAddUnitForm = {
  tempUnitId: string;
  name: string;
  sku: string;
  isBase: boolean;
  multiplierToBase: string;
};

type QuickAddRow = {
  tempId: string;
  code: string;
  name: string;
  description: string;
  units: QuickAddUnitForm[];
  showUnits: boolean;
};

const emptyCatalogForm = (): CatalogFormState => ({
  code: "",
  name: "",
  description: "",
  companyId: null,
  isActive: true,
  units: [
    {
      id: undefined,
      name: "ซอง",
      sku: "",
      multiplierToBase: "1",
      isBase: true,
    },
  ],
});

const emptyQuickAddRow = (): QuickAddRow => ({
  tempId: Math.random().toString(36).substring(7),
  code: "",
  name: "",
  description: "",
  units: [
    {
      tempUnitId: Math.random().toString(36).substring(7),
      name: "ซอง",
      sku: "",
      isBase: true,
      multiplierToBase: "1",
    },
  ],
  showUnits: false,
});

// Removed unused formatCurrency function

const EDIT_PRODUCT_MODAL_ID = "edit-product-modal";

export default function ProductsPageNew() {
  const { openModal, closeModal } = useModal();

  // ✅ React Query - Cached master data (5 min cache)
  const { data: catalog = [], isLoading: isLoadingCatalog, error: catalogQueryError, refetch: refetchCatalog } = useQuery({
    queryKey: ['products-catalog'],
    queryFn: async () => {
      const res = await fetch('/api/admin/products/catalog');
      if (!res.ok) throw new Error('ไม่สามารถโหลดรายการสินค้าได้');
      const data = await res.json();
      return (data.products ?? []) as ProductCatalogItem[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await fetch('/api/admin/employees');
      if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลพนักงานได้');
      const data = await res.json();
      return (data.employees ?? []) as EmployeeOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stores');
      if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลร้านค้าได้');
      const data = await res.json();
      return (data.stores ?? []) as StoreOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const res = await fetch('/api/admin/companies');
      if (!res.ok) return [];
      const data = await res.json();
      return (data.companies ?? []) as Array<{ id: string; name: string }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Catalog State
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogSuccess, setCatalogSuccess] = useState<string | null>(null);
  const [catalogForm, setCatalogForm] = useState<CatalogFormState>(emptyCatalogForm());
  const [isSavingCatalog, setIsSavingCatalog] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductCatalogItem | null>(null);

  // Assignment State
  const [assignments, setAssignments] = useState<ProductAssignment[]>([]);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  // Removed unused isSavingAssignment

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  // Removed unused setSelectedProductId and setAssignmentUnits

  // UI State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportAssignmentsModalOpen, setIsImportAssignmentsModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isBulkCompanyModalOpen, setIsBulkCompanyModalOpen] = useState(false);
  const [autoSelectProductId, setAutoSelectProductId] = useState<string | undefined>(undefined);

  // Search, Filter, Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Bulk selection
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // Quick Add Mode
  const [isQuickAddMode, setIsQuickAddMode] = useState(false);
  const [quickAddRows, setQuickAddRows] = useState<QuickAddRow[]>([emptyQuickAddRow()]);
  const [isSavingQuickAdd, setIsSavingQuickAdd] = useState(false);

  // Bulk Assignment Mode
  const [isBulkAssignMode, setIsBulkAssignMode] = useState(false);
  const [bulkAssignProducts, setBulkAssignProducts] = useState<BulkAssignmentProduct[]>([]);
  const [_isSavingBulkAssign, _setIsSavingBulkAssign] = useState(false);

  // Tab Mode
  const [activeTab, setActiveTab] = useState<"manage" | "assign">("manage");

  // ✅ Data loads automatically via React Query hooks above
  // Set error state from query
  useEffect(() => {
    if (catalogQueryError) {
      setCatalogError(catalogQueryError instanceof Error ? catalogQueryError.message : 'เกิดข้อผิดพลาด');
    }
  }, [catalogQueryError]);

  // Control SiteNav visibility for edit modal
  useEffect(() => {
    if (isEditModalOpen) {
      openModal(EDIT_PRODUCT_MODAL_ID);
    } else {
      closeModal(EDIT_PRODUCT_MODAL_ID);
    }
  }, [isEditModalOpen, openModal, closeModal]);

  // Auto-select store if employee has only one
  useEffect(() => {
    if (!selectedEmployeeId) {
      return;
    }
    const employee = employees.find((emp) => emp.id === selectedEmployeeId);
    if (employee && employee.storeIds && employee.storeIds.length === 1) {
      setSelectedStoreId(employee.storeIds[0]);
    } else {
      setSelectedStoreId("");
    }
  }, [selectedEmployeeId, employees]);

  // Load assignments when employee/store changes
  useEffect(() => {
    if (!selectedEmployeeId) {
      setAssignments([]);
      return;
    }
    void loadAssignments(selectedEmployeeId, selectedStoreId);
  }, [selectedEmployeeId, selectedStoreId]);

  // Auto-clear success messages
  useEffect(() => {
    if (!catalogSuccess && !assignmentSuccess) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCatalogSuccess(null);
      setAssignmentSuccess(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [catalogSuccess, assignmentSuccess]);

  // Reset page when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, companyFilter]);

  // API Functions
  async function loadAssignments(employeeId: string, storeId: string): Promise<void> {
    setAssignmentsLoading(true);
    setAssignmentError(null);
    try {
      const params = new URLSearchParams({ employeeId });
      if (storeId) {
        params.set("storeId", storeId);
      }
      const response = await fetch("/api/admin/products/assignments?" + params.toString());
      if (!response.ok) {
        throw new Error("ไม่สามารถดึงข้อมูลการผูกสินค้าได้");
      }
      const data = (await response.json()) as { assignments?: ProductAssignment[] };
      setAssignments(data.assignments ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถดึงข้อมูลการผูกสินค้าได้";
      setAssignments([]);
      setAssignmentError(message);
    } finally {
      setAssignmentsLoading(false);
    }
  }

  // Initialize bulk assignment products when entering bulk mode
  useEffect(() => {
    if (!isBulkAssignMode || !selectedEmployeeId || catalog.length === 0) {
      // Only clear if actually has items (avoid unnecessary re-render)
      setBulkAssignProducts(prev => prev.length > 0 ? [] : prev);
      return;
    }

    const bulkProducts: BulkAssignmentProduct[] = catalog.map((product) => {
      const existingAssignment = assignments.find((a) => a.productId === product.id);

      return {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        isSelected: Boolean(existingAssignment),
        units: product.units.map((unit) => {
          const existingUnit = existingAssignment?.units.find((u) => u.unitId === unit.id);
          return {
            unitId: unit.id,
            unitName: unit.name,
            multiplierToBase: unit.multiplierToBase,
            pricePc: existingUnit?.pricePc.toString() || "",
            enabled: existingUnit?.isActive || false,
          };
        }),
      };
    });

    setBulkAssignProducts(bulkProducts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBulkAssignMode, selectedEmployeeId, catalog.length, assignments.length]);

  // Form Handlers
  function handleAddCatalogUnit(): void {
    setCatalogForm((prev) => {
      const nextUnits = [...prev.units];
      const hasBase = nextUnits.some((unit) => unit.isBase);
      nextUnits.push({
        id: undefined,
        name: "",
        sku: "",
        multiplierToBase: "1",
        isBase: !hasBase,
      });
      return { ...prev, units: nextUnits };
    });
  }

  function handleUpdateCatalogUnit(index: number, update: Partial<CatalogUnitForm>): void {
    setCatalogForm((prev) => {
      const nextUnits = prev.units.map((unit, unitIndex) =>
        unitIndex === index ? { ...unit, ...update } : unit
      );
      if (update.isBase) {
        return {
          ...prev,
          units: nextUnits.map((unit, unitIndex) => ({
            ...unit,
            isBase: unitIndex === index,
            multiplierToBase: unitIndex === index ? "1" : unit.multiplierToBase,
          })),
        };
      }
      return { ...prev, units: nextUnits };
    });
  }

  function handleRemoveCatalogUnit(index: number): void {
    setCatalogForm((prev) => {
      if (prev.units.length <= 1) {
        return prev;
      }
      const nextUnits = prev.units.filter((_, unitIndex) => unitIndex !== index);
      if (!nextUnits.some((unit) => unit.isBase)) {
        nextUnits[0] = { ...nextUnits[0], isBase: true, multiplierToBase: "1" };
      }
      return { ...prev, units: nextUnits };
    });
  }

  function resetCatalogForm(): void {
    setCatalogForm(emptyCatalogForm());
    setCatalogError(null);
    setCatalogSuccess(null);
  }

  async function submitCatalogForm(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSavingCatalog) {
      return;
    }
    setIsSavingCatalog(true);
    setCatalogError(null);
    try {
      const payload: UpsertProductCatalogInput = {
        id: catalogForm.id,
        code: catalogForm.code.trim(),
        name: catalogForm.name.trim(),
        description: catalogForm.description.trim() || null,
        companyId: catalogForm.companyId,
        isActive: catalogForm.isActive,
        units: catalogForm.units.map((unit) => ({
          id: unit.id,
          name: unit.name.trim(),
          sku: unit.sku.trim() || null,
          isBase: unit.isBase,
          multiplierToBase: Number(unit.isBase ? "1" : unit.multiplierToBase || "0"),
        })),
      };

      const response = await fetch("/api/admin/products/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "ไม่สามารถบันทึกข้อมูลสินค้าได้");
      }

      await refetchCatalog();
      setCatalogSuccess(payload.id ? "บันทึกสินค้าเรียบร้อย" : "เพิ่มสินค้าเรียบร้อย");
      setCatalogForm(emptyCatalogForm());
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลสินค้าได้";
      setCatalogError(message);
    } finally {
      setIsSavingCatalog(false);
    }
  }

  function handleEditCatalog(product: ProductCatalogItem): void {
    setEditingProduct(product);
    setCatalogForm({
      id: product.id,
      code: product.code,
      name: product.name,
      description: product.description ?? "",
      companyId: product.companyId,
      isActive: product.isActive,
      units: product.units.map((unit) => ({
        id: unit.id,
        name: unit.name,
        sku: unit.sku ?? "",
        multiplierToBase: String(unit.multiplierToBase),
        isBase: unit.isBase,
      })),
    });
    setIsEditModalOpen(true);
  }

  async function handleDeleteCatalog(productId: string): Promise<void> {
    if (!window.confirm("⚠️ การลบสินค้านี้จะลบการผูกสินค้ากับพนักงานทั้งหมด\n\nต้องการดำเนินการต่อหรือไม่?")) {
      return;
    }

    setCatalogError(null);
    try {
      const response = await fetch("/api/admin/products/catalog", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "ไม่สามารถลบสินค้าได้");
      }

      await refetchCatalog();
      setCatalogSuccess("ลบสินค้าเรียบร้อย");

      if (catalogForm.id === productId) {
        setCatalogForm(emptyCatalogForm());
      }

      setSelectedProducts((prev) => {
        const updated = new Set(prev);
        updated.delete(productId);
        return updated;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถลบสินค้าได้";
      setCatalogError(message);
    }
  }

  // Quick Add handlers
  function addQuickAddRow(): void {
    setQuickAddRows((prev) => [...prev, emptyQuickAddRow()]);
  }

  function removeQuickAddRow(tempId: string): void {
    if (quickAddRows.length === 1) return;
    setQuickAddRows((prev) => prev.filter((row) => row.tempId !== tempId));
  }

  function updateQuickAddRow(
    tempId: string,
    field: keyof Omit<QuickAddRow, "units" | "showUnits">,
    value: string
  ): void {
    setQuickAddRows((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, [field]: value } : row))
    );
  }

  function toggleShowUnits(tempId: string): void {
    setQuickAddRows((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, showUnits: !row.showUnits } : row))
    );
  }

  function addQuickAddUnit(tempId: string): void {
    setQuickAddRows((prev) =>
      prev.map((row) => {
        if (row.tempId !== tempId) return row;
        const hasBase = row.units.some((u) => u.isBase);
        return {
          ...row,
          units: [
            ...row.units,
            {
              tempUnitId: Math.random().toString(36).substring(7),
              name: "",
              sku: "",
              isBase: !hasBase,
              multiplierToBase: "1",
            },
          ],
        };
      })
    );
  }

  function removeQuickAddUnit(tempId: string, tempUnitId: string): void {
    setQuickAddRows((prev) =>
      prev.map((row) => {
        if (row.tempId !== tempId) return row;
        if (row.units.length <= 1) return row;
        const nextUnits = row.units.filter((u) => u.tempUnitId !== tempUnitId);
        if (!nextUnits.some((u) => u.isBase)) {
          nextUnits[0] = { ...nextUnits[0], isBase: true, multiplierToBase: "1" };
        }
        return { ...row, units: nextUnits };
      })
    );
  }

  function updateQuickAddUnit(
    tempId: string,
    tempUnitId: string,
    update: Partial<QuickAddUnitForm>
  ): void {
    setQuickAddRows((prev) =>
      prev.map((row) => {
        if (row.tempId !== tempId) return row;
        const nextUnits = row.units.map((unit) =>
          unit.tempUnitId === tempUnitId ? { ...unit, ...update } : unit
        );
        if (update.isBase) {
          return {
            ...row,
            units: nextUnits.map((unit) => ({
              ...unit,
              isBase: unit.tempUnitId === tempUnitId,
              multiplierToBase: unit.tempUnitId === tempUnitId ? "1" : unit.multiplierToBase,
            })),
          };
        }
        return { ...row, units: nextUnits };
      })
    );
  }

  async function handleSaveQuickAdd(): Promise<void> {
    setCatalogError(null);
    setCatalogSuccess(null);

    const validRows = quickAddRows.filter((row) => row.code.trim() && row.name.trim());
    if (validRows.length === 0) {
      setCatalogError("กรุณากรอกข้อมูลอย่างน้อย 1 รายการ");
      return;
    }

    setIsSavingQuickAdd(true);

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const row of validRows) {
      try {
        const payload: UpsertProductCatalogInput = {
          code: row.code.trim(),
          name: row.name.trim(),
          description: row.description.trim() || null,
          isActive: true,
          units: row.units.map((unit) => ({
            name: unit.name.trim(),
            sku: unit.sku.trim() || null,
            isBase: unit.isBase,
            multiplierToBase: Number(unit.isBase ? "1" : unit.multiplierToBase || "0"),
          })),
        };

        const response = await fetch("/api/admin/products/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? "บันทึกไม่สำเร็จ");
        }

        successCount++;
      } catch (error) {
        failCount++;
        errors.push(`${row.name}: ${error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"}`);
      }
    }

    setIsSavingQuickAdd(false);
    await refetchCatalog();

    if (failCount === 0) {
      setCatalogSuccess(`เพิ่มสินค้าสำเร็จ ${successCount} รายการ`);
      setQuickAddRows([emptyQuickAddRow()]);
      setIsQuickAddMode(false);
    } else {
      setCatalogError(
        `เพิ่มสำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ:\n${errors.join("\n")}`
      );
    }
  }

  // Bulk assignment handlers (prefixed with _ to indicate unused)
  function _handleToggleBulkProduct(productId: string): void {
    setBulkAssignProducts((prev) =>
      prev.map((product) =>
        product.productId === productId ? { ...product, isSelected: !product.isSelected } : product
      )
    );
  }

  function _handleToggleAllBulkProducts(): void {
    const allSelected = bulkAssignProducts.every((p) => p.isSelected);
    setBulkAssignProducts((prev) =>
      prev.map((product) => ({ ...product, isSelected: !allSelected }))
    );
  }

  function _handleBulkUnitChange(
    productId: string,
    unitId: string,
    update: Partial<BulkAssignmentUnit>
  ): void {
    setBulkAssignProducts((prev) =>
      prev.map((product) => {
        if (product.productId !== productId) return product;
        return {
          ...product,
          units: product.units.map((unit) =>
            unit.unitId === unitId ? { ...unit, ...update } : unit
          ),
        };
      })
    );
  }

  async function _handleSaveBulkAssignments(): Promise<void> {
    if (!selectedEmployeeId) {
      setAssignmentError("กรุณาเลือกพนักงาน");
      return;
    }

    const selectedProductsData = bulkAssignProducts.filter((p) => p.isSelected);
    if (selectedProductsData.length === 0) {
      setAssignmentError("กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");
      return;
    }

    _setIsSavingBulkAssign(true);
    setAssignmentError(null);
    setAssignmentSuccess(null);

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const product of selectedProductsData) {
      try {
        const payload: UpsertAssignmentInput = {
          productId: product.productId,
          employeeId: selectedEmployeeId,
          storeId: selectedStoreId || null,
          units: product.units
            .filter((unit) => unit.enabled && unit.pricePc)
            .map((unit) => ({
              unitId: unit.unitId,
              pricePc: Number(unit.pricePc),
              enabled: unit.enabled,
            })),
        };

        const response = await fetch("/api/admin/products/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? "บันทึกไม่สำเร็จ");
        }

        successCount++;
      } catch (error) {
        failCount++;
        errors.push(
          `${product.productName}: ${error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"}`
        );
      }
    }

    _setIsSavingBulkAssign(false);
    await loadAssignments(selectedEmployeeId, selectedStoreId);

    if (failCount === 0) {
      setAssignmentSuccess(`ผูกสินค้าสำเร็จ ${successCount} รายการ`);
      setIsBulkAssignMode(false);
    } else {
      const errorMsg = `ผูกสำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ${errors.length > 0 ? "\n" + errors.slice(0, 5).join("\n") : ""}`;
      setAssignmentError(errorMsg);
    }
  }

  // Handler for ProductAssignmentPanel save
  async function handleProductAssignmentSave(
    productIds: string[],
    unitsData: Map<string, AssignmentUnitForm[]>
  ): Promise<void> {
    if (!selectedEmployeeId) {
      setAssignmentError("กรุณาเลือกพนักงาน");
      return;
    }

    if (productIds.length === 0) {
      setAssignmentError("กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");
      return;
    }

    setIsSavingAssignment(true);
    setAssignmentError(null);
    setAssignmentSuccess(null);

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const productId of productIds) {
      try {
        const units = unitsData.get(productId);
        if (!units) continue;

        const payload: UpsertAssignmentInput = {
          productId,
          employeeId: selectedEmployeeId,
          storeId: selectedStoreId || null,
          units: units
            .filter((unit) => unit.enabled && unit.pricePc)
            .map((unit) => ({
              unitId: unit.unitId,
              pricePc: Number(unit.pricePc),
              enabled: unit.enabled,
            })),
        };

        const response = await fetch("/api/admin/products/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? "บันทึกไม่สำเร็จ");
        }

        successCount++;
      } catch (error) {
        failCount++;
        const productName = catalog.find((p) => p.id === productId)?.name ?? productId;
        errors.push(
          `${productName}: ${error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"}`
        );
      }
    }

    setIsSavingAssignment(false);
    await loadAssignments(selectedEmployeeId, selectedStoreId);

    if (failCount === 0) {
      setAssignmentSuccess(`ผูกสินค้าสำเร็จ ${successCount} รายการ`);
    } else {
      const errorMsg = `ผูกสำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ${errors.length > 0 ? "\n" + errors.slice(0, 5).join("\n") : ""}`;
      setAssignmentError(errorMsg);
    }
  }

  async function handleBulkDelete(): Promise<void> {
    if (selectedProducts.size === 0) {
      setCatalogError("กรุณาเลือกสินค้าที่ต้องการลบ");
      return;
    }

    if (
      !window.confirm(
        `⚠️ ต้องการลบสินค้า ${selectedProducts.size} รายการหรือไม่?\n\nการลบจะมีผลทันที และไม่สามารถกู้คืนได้`
      )
    ) {
      return;
    }

    setCatalogError(null);
    setCatalogSuccess(null);

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const productId of selectedProducts) {
      try {
        const response = await fetch("/api/admin/products/catalog", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: productId }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? "ลบไม่สำเร็จ");
        }

        successCount++;
      } catch (error) {
        failCount++;
        const productName = catalog.find((p) => p.id === productId)?.name ?? productId;
        errors.push(`${productName}: ${error instanceof Error ? error.message : "ลบไม่สำเร็จ"}`);
      }
    }

    await refetchCatalog();
    setSelectedProducts(new Set());

    if (failCount === 0) {
      setCatalogSuccess(`ลบสินค้าสำเร็จ ${successCount} รายการ`);
    } else {
      setCatalogError(
        `ลบสำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ:\n${errors.join("\n")}`
      );
    }
  }

  async function handleBulkAssignCompany(companyId: string | null): Promise<void> {
    if (selectedProducts.size === 0) {
      setCatalogError("กรุณาเลือกสินค้าที่ต้องการกำหนดบริษัท");
      return;
    }

    setCatalogError(null);
    setCatalogSuccess(null);

    try {
      const response = await fetch("/api/admin/products/bulk-update-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: Array.from(selectedProducts),
          companyId: companyId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "ไม่สามารถอัปเดตบริษัทได้");
      }

      await refetchCatalog();
      setSelectedProducts(new Set());
      setCatalogSuccess(data.message ?? `อัปเดตบริษัทให้ ${selectedProducts.size} สินค้าเรียบร้อย`);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการอัปเดตบริษัท");
    }
  }


  async function handleDeleteAssignment(assignmentId: string): Promise<void> {
    if (!window.confirm("ต้องการลบการผูกสินค้านี้หรือไม่?")) {
      return;
    }
    try {
      const response = await fetch("/api/admin/products/assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "ไม่สามารถลบการผูกสินค้าได้");
      }
      await loadAssignments(selectedEmployeeId, selectedStoreId);
      setAssignmentSuccess("ลบการผูกสินค้าสำเร็จ");
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถลบการผูกสินค้าได้";
      setAssignmentError(message);
    }
  }

  function handleEditAssignment(productId: string): void {
    // Set auto-select product ID
    setAutoSelectProductId(productId);

    // Scroll to ProductAssignmentPanel
    setTimeout(() => {
      const panel = document.getElementById("product-assignment-panel");
      if (panel) {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }

  async function handleExport(format: "csv" | "excel"): Promise<void> {
    try {
      const response = await fetch(`/api/admin/products/export?format=${format}`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "ไม่สามารถ export ข้อมูลได้");
      }

      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      let filename =
        filenameMatch?.[1]?.replace(/['"]/g, "") ??
        `products-export.${format === "csv" ? "csv" : "xlsx"}`;
      filename = filename.trim();

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setCatalogSuccess(`Export ${format.toUpperCase()} สำเร็จ`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถ export ข้อมูลได้";
      setCatalogError(message);
    }
  }

  async function handleImport(file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/admin/products/import", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? data?.message ?? "ไม่สามารถ import ข้อมูลได้");
    }

    await refetchCatalog();
    setCatalogSuccess("Import ข้อมูลสำเร็จ");
  }

  async function handleExportAssignments(format: "csv" | "excel"): Promise<void> {
    try {
      const params = new URLSearchParams();
      params.set("format", format);
      if (selectedEmployeeId) {
        params.set("employeeId", selectedEmployeeId);
      }
      if (selectedStoreId) {
        params.set("storeId", selectedStoreId);
      }

      const response = await fetch(`/api/admin/product-assignments/export?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "ไม่สามารถ export ข้อมูลการผูกสินค้าได้");
      }

      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      let filename =
        filenameMatch?.[1]?.replace(/['"]/g, "") ??
        `product-assignments-export.${format === "csv" ? "csv" : "xlsx"}`;
      filename = filename.trim();

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setAssignmentSuccess(`Export ${format.toUpperCase()} การผูกสินค้าสำเร็จ`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถ export ข้อมูลการผูกสินค้าได้";
      setAssignmentError(message);
    }
  }

  async function handleImportAssignments(file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/admin/product-assignments/import", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? data?.message ?? "ไม่สามารถ import ข้อมูลการผูกสินค้าได้");
    }

    const result = await response.json();

    if (selectedEmployeeId) {
      await loadAssignments(selectedEmployeeId, selectedStoreId);
    }

    setAssignmentSuccess(
      result.message || `Import การผูกสินค้าสำเร็จ ${result.success || 0} รายการ`
    );
  }

  // Search and filter logic
  const filteredCatalog = useMemo(() => {
    let filtered = catalog;

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(query) || product.code.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((product) =>
        statusFilter === "active" ? product.isActive : !product.isActive
      );
    }

    if (companyFilter !== "all") {
      filtered = filtered.filter((product) =>
        companyFilter === "none" ? !product.companyId : product.companyId === companyFilter
      );
    }

    return filtered;
  }, [catalog, searchQuery, statusFilter, companyFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredCatalog.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCatalog = filteredCatalog.slice(startIndex, endIndex);

  // Bulk selection handlers
  const handleToggleAll = useCallback(() => {
    if (selectedProducts.size === paginatedCatalog.length && paginatedCatalog.length > 0) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(paginatedCatalog.map((p) => p.id)));
    }
  }, [paginatedCatalog, selectedProducts.size]);

  const handleToggleProduct = useCallback((productId: string) => {
    setSelectedProducts((prev) => {
      const updated = new Set(prev);
      if (updated.has(productId)) {
        updated.delete(productId);
      } else {
        updated.add(productId);
      }
      return updated;
    });
  }, []);

  // Filter stores for selected employee (unused - prefixed with _)
  const _storeOptionsForEmployee = useMemo(() => {
    if (!selectedEmployeeId) {
      return stores;
    }
    const employee = employees.find((emp) => emp.id === selectedEmployeeId);
    if (!employee || !employee.storeIds || employee.storeIds.length === 0) {
      return stores;
    }
    return stores.filter((store) => employee.storeIds!.includes(store.id));
  }, [stores, selectedEmployeeId, employees]);

  // Statistics
  const stats = useMemo(() => {
    return {
      totalProducts: catalog.length,
      activeProducts: catalog.filter((p) => p.isActive).length,
      totalUnits: catalog.reduce((sum, p) => sum + p.units.length, 0),
      totalAssignments: assignments.length,
    };
  }, [catalog, assignments]);

  // Continued in next message due to length...
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-sky-50/50 via-white to-blue-50/30 px-0 pb-20 sm:px-4 lg:px-6">
      {/* Hero Header - Ultra Compact for Mobile */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-none sm:rounded-3xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 px-3 sm:px-8 py-4 sm:py-12 text-white shadow-[0_16px_64px_rgba(56,189,248,0.25)]"
      >
        {/* Decorative background - Disable on mobile for performance */}
        <div className="absolute inset-0 opacity-0 sm:opacity-10">
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-white blur-3xl" />
        </div>

        <div className="relative">
          <div className="flex items-center justify-between gap-3 sm:flex-col sm:gap-6 lg:flex-row">
            <div className="flex-1 min-w-0">
              {/* Mobile: Compact single line */}
              <div className="flex items-center gap-2 sm:gap-3">
                <Sparkles className="h-5 w-5 sm:h-8 sm:w-8 flex-shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-4xl font-extrabold lg:text-5xl leading-tight truncate">
                    จัดการสินค้า
                  </h1>
                  <p className="text-[10px] sm:text-sm font-semibold uppercase tracking-wide text-white/80 sm:hidden">
                    Products Management
                  </p>
                </div>
              </div>

              {/* Desktop: Full title */}
              <p className="mt-3 max-w-3xl text-base text-white/90 lg:text-lg hidden sm:block">
                ระบบจัดการสินค้าแบบครบวงจร พร้อมกำหนดหน่วยขาย ผูกสินค้ากับพนักงาน และตั้งราคาเฉพาะพื้นที่ได้อย่างง่ายดาย
              </p>
            </div>

            {/* Buttons - Icon only on mobile */}
            <div className="flex gap-2 sm:gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl border-2 border-white/30 bg-white/10 w-9 h-9 sm:w-auto sm:h-auto sm:px-5 sm:py-3 text-xs sm:text-sm font-bold text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-90"
              >
                <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">Import</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport("excel")}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl bg-white w-9 h-9 sm:w-auto sm:h-auto sm:px-5 sm:py-3 text-xs sm:text-sm font-bold text-sky-600 shadow-xl transition-all hover:bg-white/95 active:scale-90"
              >
                <Download className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>

          {/* Stats Cards - Compact Horizontal Scroll on Mobile */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-4 sm:mt-8"
          >
            {/* Mobile: Grid 2x2 Compact */}
            <div className="grid grid-cols-2 gap-2 sm:hidden">
              <div className="rounded-xl border-2 border-white/30 bg-white/10 px-3 py-3 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Package className="h-6 w-6 text-white/90" />
                  <p className="text-2xl font-bold">{stats.totalProducts}</p>
                </div>
                <p className="text-xs font-semibold text-white/80 mt-1">สินค้าทั้งหมด</p>
              </div>
              <div className="rounded-xl border-2 border-white/30 bg-white/10 px-3 py-3 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-white/90" />
                  <p className="text-2xl font-bold">{stats.activeProducts}</p>
                </div>
                <p className="text-xs font-semibold text-white/80 mt-1">สินค้าใช้งาน</p>
              </div>
              <div className="rounded-xl border-2 border-white/30 bg-white/10 px-3 py-3 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Package className="h-6 w-6 text-white/90" />
                  <p className="text-2xl font-bold">{stats.totalUnits}</p>
                </div>
                <p className="text-xs font-semibold text-white/80 mt-1">หน่วยขาย</p>
              </div>
              <div className="rounded-xl border-2 border-white/30 bg-white/10 px-3 py-3 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Users className="h-6 w-6 text-white/90" />
                  <p className="text-2xl font-bold">{stats.totalAssignments}</p>
                </div>
                <p className="text-xs font-semibold text-white/80 mt-1">การผูกสินค้า</p>
              </div>
            </div>

            {/* Tablet+: Grid */}
            <div className="hidden sm:grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border-2 border-white/30 bg-white/10 px-5 py-4 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <Package className="h-10 w-10 text-white/90" />
                  <div>
                    <p className="text-sm font-semibold text-white/80">สินค้าทั้งหมด</p>
                    <p className="text-2xl font-bold">{stats.totalProducts}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border-2 border-white/30 bg-white/10 px-5 py-4 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-10 w-10 text-white/90" />
                  <div>
                    <p className="text-sm font-semibold text-white/80">สินค้าใช้งาน</p>
                    <p className="text-2xl font-bold">{stats.activeProducts}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border-2 border-white/30 bg-white/10 px-5 py-4 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <Package className="h-10 w-10 text-white/90" />
                  <div>
                    <p className="text-sm font-semibold text-white/80">หน่วยขาย</p>
                    <p className="text-2xl font-bold">{stats.totalUnits}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border-2 border-white/30 bg-white/10 px-5 py-4 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <Users className="h-10 w-10 text-white/90" />
                  <div>
                    <p className="text-sm font-semibold text-white/80">การผูกสินค้า</p>
                    <p className="text-2xl font-bold">{stats.totalAssignments}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.header>

      {/* Success/Error Messages */}
      <AnimatePresence>
        {catalogSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mt-6 rounded-2xl border-2 border-emerald-200 bg-white/95 p-4 shadow-2xl shadow-emerald-500/20 backdrop-blur-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-900">สำเร็จ!</h4>
                <p className="mt-1 text-sm text-slate-700">{catalogSuccess}</p>
              </div>
            </div>
          </motion.div>
        )}
        {catalogError && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mt-6 rounded-2xl border-2 border-red-200 bg-white/95 p-4 shadow-2xl shadow-red-500/20 backdrop-blur-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-400 to-red-600 text-white shadow-lg">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-900">เกิดข้อผิดพลาด</h4>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{catalogError}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs Navigation - Compact on Mobile */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mt-3 sm:mt-8 px-2 sm:px-0"
      >
        <div className="inline-flex w-full sm:w-auto rounded-xl sm:rounded-2xl border-2 border-sky-200/50 bg-white/60 p-1 sm:p-2 shadow-lg shadow-sky-500/10 backdrop-blur-md">
          <button
            onClick={() => setActiveTab("manage")}
            className={clsx(
              "flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-bold transition-all duration-300",
              activeTab === "manage"
                ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            )}
          >
            <Package className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>สินค้า</span>
          </button>
          <button
            onClick={() => setActiveTab("assign")}
            className={clsx(
              "flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-bold transition-all duration-300",
              activeTab === "assign"
                ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            )}
          >
            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>ผูก</span>
          </button>
        </div>
      </motion.div>

      {/* Main Content Area */}
      <div className="mt-3 sm:mt-8">
        {activeTab === "manage" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex w-full max-w-full flex-col gap-6 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_500px]"
          >
            {/* Left: Product List */}
            <div className="min-w-0 space-y-3 sm:space-y-6 overflow-hidden px-2 sm:px-0">
              {/* Search and Filters */}
              <div className="grid gap-2 sm:gap-4 md:grid-cols-3">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  products={catalog}
                  onProductSelect={(productId) => {
                    const product = catalog.find((p) => p.id === productId);
                    if (product) {
                      handleEditCatalog(product);
                    }
                  }}
                />

                <div className="relative">
                  <Filter className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="w-full appearance-none rounded-xl sm:rounded-2xl border-2 border-sky-200 bg-white/80 py-2 sm:py-3 pl-10 sm:pl-12 pr-8 sm:pr-10 text-sm sm:text-base text-slate-900 backdrop-blur-sm transition-all focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                  >
                    <option value="all">ทั้งหมด</option>
                    <option value="active">ใช้งาน</option>
                    <option value="inactive">ปิด</option>
                  </select>
                </div>

                <div className="relative">
                  <Filter className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-slate-400" />
                  <select
                    value={companyFilter}
                    onChange={(e) => setCompanyFilter(e.target.value)}
                    className="w-full appearance-none rounded-xl sm:rounded-2xl border-2 border-sky-200 bg-white/80 py-2 sm:py-3 pl-10 sm:pl-12 pr-8 sm:pr-10 text-sm sm:text-base text-slate-900 backdrop-blur-sm transition-all focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/20"
                  >
                    <option value="all">ทุกบริษัท</option>
                    <option value="none">ไม่ระบุ</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setIsQuickAddMode(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-purple-500/30 transition-all hover:from-purple-600 hover:to-purple-700 sm:px-5 sm:py-2.5 sm:text-sm"
                >
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">เพิ่มหลายรายการ</span>
                  <span className="sm:hidden">เพิ่มหลาย</span>
                </button>

                {selectedProducts.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 rounded-2xl border-2 border-sky-200 bg-sky-50 px-3 py-2 sm:px-4"
                  >
                    <input
                      type="checkbox"
                      checked={
                        selectedProducts.size === paginatedCatalog.length &&
                        paginatedCatalog.length > 0
                      }
                      onChange={handleToggleAll}
                      className="h-4 w-4 cursor-pointer rounded-lg border-2 border-sky-300 text-sky-600 sm:h-5 sm:w-5"
                    />
                    <span className="text-xs font-semibold text-slate-700 sm:text-sm">
                      <span className="hidden sm:inline">เลือกทั้งหมดในหน้านี้</span>
                      <span className="sm:hidden">ทั้งหมด</span>
                    </span>
                  </motion.div>
                )}

                {(searchQuery || statusFilter !== "all" || companyFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setCompanyFilter("all");
                    }}
                    className="inline-flex items-center gap-1 rounded-2xl border-2 border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 sm:gap-2 sm:px-4 sm:text-sm"
                  >
                    <X className="h-4 w-4" />
                    <span className="hidden sm:inline">ล้างตัวกรอง</span>
                    <span className="sm:hidden">ล้าง</span>
                  </button>
                )}

                <button
                  onClick={() => void refetchCatalog()}
                  className="inline-flex items-center gap-1 rounded-2xl border-2 border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 sm:gap-2 sm:px-4 sm:text-sm"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">รีเฟรช</span>
                </button>
              </div>

              {/* Quick Add Mode - Fluid Mobile Design */}
              {isQuickAddMode && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="rounded-none sm:rounded-3xl border-0 sm:border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50/30 p-0 sm:p-6 shadow-none sm:shadow-[0_8px_32px_rgba(168,85,247,0.15)]"
                >
                  {/* Header - Sticky */}
                  <div className="sticky top-0 z-20 bg-gradient-to-r from-purple-600 to-purple-500 sm:bg-none sm:relative px-4 py-3 sm:p-0 sm:mb-6 flex items-center justify-between gap-2 shadow-lg sm:shadow-none">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/20 sm:bg-purple-600 text-white">
                        <Package className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-bold text-white sm:text-slate-900">
                          เพิ่มหลายรายการ
                        </h2>
                        <p className="text-xs text-white/80 sm:text-sm sm:text-slate-500 hidden sm:block">
                          กรอกข้อมูลในตารางด้านล่าง แล้วกด &ldquo;บันทึกทั้งหมด&rdquo;
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsQuickAddMode(false);
                        setQuickAddRows([emptyQuickAddRow()]);
                      }}
                      className="flex-shrink-0 inline-flex items-center justify-center rounded-lg sm:rounded-2xl border-2 border-white/30 sm:border-slate-200 bg-white/10 sm:bg-white h-9 w-9 sm:h-auto sm:w-auto sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white sm:text-slate-700 transition hover:bg-white/20 sm:hover:bg-slate-50"
                    >
                      <X className="h-4 w-4" />
                      <span className="hidden sm:inline">ปิด</span>
                    </button>
                  </div>

                  {/* Product Cards */}
                  <div className="space-y-3 sm:space-y-4 px-3 sm:px-0 py-3 sm:py-0">
                    {quickAddRows.map((row, rowIndex) => (
                      <div
                        key={row.tempId}
                        className="rounded-2xl border-2 border-purple-300/60 bg-white shadow-lg shadow-purple-500/10"
                      >
                        {/* Card Header */}
                        <div className="bg-gradient-to-r from-purple-100 to-purple-50 px-4 py-2.5 border-b-2 border-purple-200/60">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-purple-900">สินค้าที่ {rowIndex + 1}</span>
                            <span className="text-xs font-semibold text-purple-600">
                              {row.code || row.name || "ยังไม่กรอก"}
                            </span>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-3 sm:p-4 space-y-3">
                          {/* Product Info */}
                          <div className="space-y-2.5">
                            <div>
                              <label className="text-xs font-bold text-purple-900 mb-1 block">
                                รหัสสินค้า *
                              </label>
                              <input
                                type="text"
                                value={row.code}
                                onChange={(e) => updateQuickAddRow(row.tempId, "code", e.target.value)}
                                placeholder="เช่น SKU-001"
                                className="w-full rounded-xl border-2 border-purple-200 bg-purple-50/30 px-4 py-3 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/20 transition-all"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-purple-900 mb-1 block">
                                ชื่อสินค้า *
                              </label>
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => updateQuickAddRow(row.tempId, "name", e.target.value)}
                                placeholder="เช่น น้ำดื่ม 600ml"
                                className="w-full rounded-xl border-2 border-purple-200 bg-purple-50/30 px-4 py-3 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/20 transition-all"
                              />
                            </div>
                            <div className="hidden sm:block">
                              <label className="text-xs font-bold text-purple-900 mb-1 block">
                                รายละเอียด
                              </label>
                              <input
                                type="text"
                                value={row.description}
                                onChange={(e) =>
                                  updateQuickAddRow(row.tempId, "description", e.target.value)
                                }
                                placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                                className="w-full rounded-xl border-2 border-purple-200 bg-purple-50/30 px-4 py-3 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/20 transition-all"
                              />
                            </div>
                          </div>

                          {/* Units Management - Collapsible */}
                          <div className="mt-3 rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50/50 to-purple-50/30 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleShowUnits(row.tempId)}
                              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-purple-100/50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-purple-600" />
                                <span className="text-sm font-bold text-purple-900">
                                  จัดการหน่วย ({row.units.length})
                                </span>
                              </div>
                              <svg
                                className={`h-5 w-5 text-purple-600 transition-transform ${row.showUnits ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2.5}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </button>

                            {row.showUnits && (
                              <div className="bg-white border-t-2 border-purple-200/60 p-3">
                                <div className="space-y-3">
                                  {row.units.map((unit) => {
                                    const multiplierValue = unit.isBase ? "1" : unit.multiplierToBase;
                                    const multiplierNumber = Number.parseFloat(multiplierValue || "0");
                                    const multiplierLabel =
                                      Number.isFinite(multiplierNumber) && multiplierNumber > 0
                                        ? multiplierNumber
                                        : 0;
                                    const canRemove = row.units.length > 1;

                                    return (
                                      <div
                                        key={unit.tempUnitId}
                                        className="rounded-xl border-2 border-purple-200/60 bg-gradient-to-br from-white to-purple-50/20 p-3 shadow-sm"
                                      >
                                        <div className="space-y-2.5">
                                          {/* Unit Name */}
                                          <div>
                                            <label className="text-xs font-bold text-purple-900 mb-1 block">
                                              ชื่อหน่วย *
                                            </label>
                                            <input
                                              type="text"
                                              value={unit.name}
                                              onChange={(e) =>
                                                updateQuickAddUnit(row.tempId, unit.tempUnitId, {
                                                  name: e.target.value,
                                                })
                                              }
                                              placeholder="เช่น กล่อง, แพ็ค"
                                              className="w-full rounded-lg border-2 border-purple-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                            />
                                          </div>

                                          {/* SKU - Hide on small mobile */}
                                          <div className="hidden sm:block">
                                            <label className="text-xs font-bold text-purple-900 mb-1 block">
                                              SKU
                                            </label>
                                            <input
                                              type="text"
                                              value={unit.sku}
                                              onChange={(e) =>
                                                updateQuickAddUnit(row.tempId, unit.tempUnitId, {
                                                  sku: e.target.value,
                                                })
                                              }
                                              placeholder="SKU-001"
                                              className="w-full rounded-lg border-2 border-purple-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                            />
                                          </div>

                                          {/* Multiplier */}
                                          {!unit.isBase && (
                                            <div>
                                              <label className="text-xs font-bold text-purple-900 mb-1 block">
                                                จำนวนซองต่อหน่วย
                                              </label>
                                              <input
                                                type="number"
                                                min="1"
                                                step="1"
                                                value={multiplierValue}
                                                onChange={(e) =>
                                                  updateQuickAddUnit(row.tempId, unit.tempUnitId, {
                                                    multiplierToBase: e.target.value,
                                                  })
                                                }
                                                className="w-full rounded-lg border-2 border-purple-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                              />
                                              <p className="mt-1 text-xs font-medium text-slate-500">
                                                1 {unit.name || "หน่วย"} = {multiplierLabel.toLocaleString("th-TH")} ซอง
                                              </p>
                                            </div>
                                          )}

                                          {/* Action Buttons */}
                                          <div className="flex gap-2 pt-1">
                                            {!unit.isBase && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  updateQuickAddUnit(row.tempId, unit.tempUnitId, {
                                                    isBase: true,
                                                  })
                                                }
                                                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-sky-300 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 hover:border-sky-400 active:scale-95 transition-all"
                                              >
                                                <Sparkles className="h-3.5 w-3.5" />
                                                ตั้งเป็นหน่วยฐาน
                                              </button>
                                            )}
                                            {unit.isBase && (
                                              <div className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-sky-300 bg-gradient-to-r from-sky-100 to-blue-100 px-3 py-2 text-xs font-bold text-sky-700">
                                                <Sparkles className="h-3.5 w-3.5" />
                                                ★ หน่วยฐาน
                                              </div>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() =>
                                                removeQuickAddUnit(row.tempId, unit.tempUnitId)
                                              }
                                              disabled={!canRemove}
                                              className="inline-flex items-center justify-center h-10 w-10 rounded-lg border-2 border-red-300 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-400 disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-all"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {/* Add Unit Button */}
                                  <button
                                    type="button"
                                    onClick={() => addQuickAddUnit(row.tempId)}
                                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50/30 px-4 py-3 text-sm font-bold text-purple-700 hover:bg-purple-100 hover:border-purple-400 active:scale-95 transition-all"
                                  >
                                    <Plus className="h-5 w-5" />
                                    เพิ่มหน่วยใหม่
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Delete Product Button */}
                          <div className="mt-4 pt-3 border-t-2 border-purple-100">
                            <button
                              type="button"
                              onClick={() => removeQuickAddRow(row.tempId)}
                              disabled={quickAddRows.length === 1}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-red-300 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3 text-sm font-bold text-red-600 hover:from-red-100 hover:to-rose-100 hover:border-red-400 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
                            >
                              <Trash2 className="h-5 w-5" />
                              ลบสินค้านี้
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Actions - Sticky */}
                  <div className="sticky bottom-0 bg-white sm:bg-transparent border-t-2 sm:border-t-0 border-purple-200 p-3 sm:p-0 sm:mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:shadow-none">
                    <button
                      type="button"
                      onClick={addQuickAddRow}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-purple-300 bg-white px-4 py-3 sm:py-2 text-sm font-bold text-purple-700 hover:bg-purple-50 hover:border-purple-400 active:scale-95 transition-all"
                    >
                      <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
                      เพิ่มสินค้าใหม่
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveQuickAdd}
                      disabled={isSavingQuickAdd}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-3 sm:py-2 text-sm font-bold text-white shadow-lg hover:from-purple-700 hover:to-purple-600 disabled:opacity-70 disabled:cursor-not-allowed active:scale-95 transition-all"
                    >
                      {isSavingQuickAdd ? (
                        <>
                          <div className="h-5 w-5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>กำลังบันทึก...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-5 w-5 sm:h-4 sm:w-4" />
                          <span>
                            บันทึก ({quickAddRows.filter((r) => r.code.trim() && r.name.trim()).length})
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.section>
              )}

              {/* Product Grid */}
              {isLoadingCatalog ? (
                <div className="flex min-h-[400px] items-center justify-center rounded-3xl border-2 border-dashed border-sky-200 bg-white/40">
                  <div className="text-center">
                    <RefreshCw className="mx-auto h-12 w-12 animate-spin text-sky-500" />
                    <p className="mt-4 text-sm font-medium text-slate-600">กำลังโหลดข้อมูล...</p>
                  </div>
                </div>
              ) : filteredCatalog.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex min-h-[400px] flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed border-sky-200 bg-white/40 py-16 text-center"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-blue-100">
                    <Package className="h-10 w-10 text-sky-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">ไม่พบสินค้า</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {searchQuery || statusFilter !== "all" || companyFilter !== "all"
                        ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"
                        : "เริ่มต้นโดยเพิ่มสินค้าใหม่ด้านขวา"}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    {paginatedCatalog.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        isSelected={selectedProducts.has(product.id)}
                        onToggleSelect={handleToggleProduct}
                        onEdit={handleEditCatalog}
                        onDelete={handleDeleteCatalog}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border-2 border-sky-200 bg-white/60 px-4 py-4 backdrop-blur-sm sm:flex-row sm:px-6">
                      <p className="text-center text-sm font-medium text-slate-600 sm:text-left">
                        แสดง {startIndex + 1}-{Math.min(endIndex, filteredCatalog.length)} จาก{" "}
                        {filteredCatalog.length} รายการ
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

            {/* Right: Add Product Button (Desktop only) */}
            <div className="hidden min-w-0 sm:block lg:sticky lg:top-4 lg:h-fit">
              <button
                type="button"
                onClick={() => {
                  resetCatalogForm();
                  setEditingProduct(null);
                  setIsEditModalOpen(true);
                }}
                className="group w-full rounded-2xl border-2 border-dashed border-blue-300 bg-gradient-to-br from-white via-blue-50/40 to-sky-50/60 p-8 text-center transition-all hover:border-blue-400 hover:shadow-xl hover:shadow-blue-200/30"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-sky-500 to-indigo-600 shadow-xl">
                      <Plus className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900 mb-1">เพิ่มสินค้าใหม่</p>
                    <p className="text-sm text-blue-600 font-medium">คลิกเพื่อเปิดฟอร์ม</p>
                  </div>
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === "assign" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Import/Export Actions Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-sky-100 bg-white/60 p-4 backdrop-blur-sm">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportAssignmentsModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-100"
                >
                  <Upload className="h-4 w-4" />
                  Import
                </button>
                <button
                  type="button"
                  onClick={() => handleExportAssignments("csv")}
                  className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExportAssignments("excel")}
                  className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Export Excel
                </button>
              </div>

              {selectedEmployeeId && (
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(true)}
                  disabled={isSavingAssignment}
                  className="inline-flex items-center gap-2 rounded-2xl border-2 border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:border-sky-400 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Copy className="h-4 w-4" />
                  คัดลอกจากพนักงานอื่น
                </button>
              )}
            </div>

            {/* New Two-Panel Assignment Layout */}
            <div id="product-assignment-panel">
              <ProductAssignmentPanel
                employees={employees}
                stores={stores}
                catalog={catalog}
                assignments={assignments}
                companies={companies}
                selectedEmployeeId={selectedEmployeeId}
                selectedStoreId={selectedStoreId}
                onEmployeeChange={setSelectedEmployeeId}
                onStoreChange={setSelectedStoreId}
                onSave={handleProductAssignmentSave}
                onRefresh={async () => {
                  if (selectedEmployeeId) {
                    await loadAssignments(selectedEmployeeId, selectedStoreId);
                  }
                }}
                isLoading={assignmentsLoading}
                isSaving={isSavingAssignment}
                error={assignmentError}
                success={assignmentSuccess}
                autoSelectProductId={autoSelectProductId}
                onAutoSelectComplete={() => setAutoSelectProductId(undefined)}
              />
            </div>

            {/* Existing Assignments List with Pagination + Search */}
            <div className="mt-16">
              <AssignmentList
                assignments={assignments}
                stores={stores}
                isLoading={assignmentsLoading}
                onDelete={handleDeleteAssignment}
                onEdit={handleEditAssignment}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Floating Action Button - Mobile Only (Add Product) */}
      {activeTab === "manage" && (
        <div className="fixed z-[998] sm:hidden print:hidden" style={{ bottom: "calc(1.5rem + 56px + 0.75rem)", right: "1.5rem" }}>
          <button
            type="button"
            onClick={() => {
              resetCatalogForm();
              setEditingProduct(null);
              setIsEditModalOpen(true);
            }}
            className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 text-white shadow-[0_8px_30px_-8px_rgba(147,51,234,0.5)] transition-all active:scale-90 hover:shadow-[0_12px_40px_-10px_rgba(147,51,234,0.7)]"
            aria-label="เพิ่มสินค้าใหม่"
          >
            <Plus className="h-7 w-7 transition-transform group-active:scale-90" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Bulk Toolbar */}
      <BulkToolbar
        selectedCount={selectedProducts.size}
        onBulkDelete={handleBulkDelete}
        onBulkAssignCompany={() => setIsBulkCompanyModalOpen(true)}
        onCancel={() => setSelectedProducts(new Set())}
      />

      {/* Import Modals */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
        title="นำเข้าข้อมูลสินค้า"
        acceptedFormats="CSV, Excel"
        templateDownloadUrl="/api/admin/products/export?format=csv"
      />

      <ImportModal
        isOpen={isImportAssignmentsModalOpen}
        onClose={() => setIsImportAssignmentsModalOpen(false)}
        onImport={handleImportAssignments}
        title="นำเข้าข้อมูลการผูกสินค้า"
        acceptedFormats="CSV, Excel"
        templateDownloadUrl="/api/admin/product-assignments/template"
      />

      <CopyAssignmentModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        targetEmployeeId={selectedEmployeeId}
        targetStoreId={selectedStoreId}
        targetStoreName={
          selectedStoreId ? stores.find((s) => s.id === selectedStoreId)?.name : undefined
        }
        employees={employees}
        stores={stores}
        onSuccess={() => {
          if (selectedEmployeeId) {
            void loadAssignments(selectedEmployeeId, selectedStoreId);
          }
        }}
      />

      <BulkCompanyAssignmentModal
        isOpen={isBulkCompanyModalOpen}
        onClose={() => setIsBulkCompanyModalOpen(false)}
        selectedProducts={Array.from(selectedProducts).map((id) => {
          const product = catalog.find((p) => p.id === id);
          return {
            id,
            code: product?.code ?? "",
            name: product?.name ?? "",
          };
        })}
        onSave={handleBulkAssignCompany}
      />

      {/* Add/Edit Product Modal - Stunning Design */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-gradient-to-br from-slate-900/30 via-blue-900/20 to-indigo-900/30 backdrop-blur-md p-4"
          onClick={() => {
            setIsEditModalOpen(false);
            setEditingProduct(null);
            resetCatalogForm();
          }}
        >
          <div
            className="w-full max-w-4xl rounded-t-3xl md:rounded-3xl bg-white shadow-2xl border-t md:border-2 border-white/50 max-h-[92vh] md:max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Stunning Header */}
            <div className="relative px-6 py-6 md:py-8 flex-shrink-0 overflow-hidden">
              {/* Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-indigo-600" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.2),transparent_50%)]" />

              {/* Content */}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/30 rounded-2xl blur-lg" />
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30">
                      {editingProduct ? (
                        <Package className="h-7 w-7 text-white" />
                      ) : (
                        <Plus className="h-7 w-7 text-white" />
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-white drop-shadow-lg">
                      {editingProduct ? "แก้ไขข้อมูลสินค้า" : "เพิ่มสินค้าใหม่"}
                    </h2>
                    <p className="text-sm text-blue-100 mt-0.5">
                      {editingProduct ? editingProduct.name : "กรอกข้อมูลสินค้าเพื่อเพิ่มเข้าระบบ"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingProduct(null);
                    resetCatalogForm();
                  }}
                  className="rounded-xl p-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            {/* Form Content - Scrollable */}
            <div className="p-5 md:p-6 overflow-y-auto flex-1 bg-gradient-to-b from-slate-50/50 to-white" style={{ touchAction: 'pan-y' }}>
              <ProductForm
                formState={catalogForm}
                onFormChange={setCatalogForm}
                onSubmit={async (e) => {
                  e.preventDefault();
                  await submitCatalogForm(e);
                  setIsEditModalOpen(false);
                  setEditingProduct(null);
                }}
                onReset={() => {
                  resetCatalogForm();
                  setIsEditModalOpen(false);
                  setEditingProduct(null);
                }}
                isSaving={isSavingCatalog}
                onAddUnit={handleAddCatalogUnit}
                onUpdateUnit={handleUpdateCatalogUnit}
                onRemoveUnit={handleRemoveCatalogUnit}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
