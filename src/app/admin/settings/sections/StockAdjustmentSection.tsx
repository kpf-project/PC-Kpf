"use client";

import { useState, useMemo, useCallback, useEffect, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Plus,
  Minus,
  Edit3,
  ShoppingCart,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  X,
  Layers,
  Calendar,
  ChevronRight,
  Save,
  ArrowRight,
  Box,
  Store,
  User,
  Ticket,
  Receipt,
  Clock,
  Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useModal } from "@/contexts/ModalContext";
import { motion, AnimatePresence } from "framer-motion";

// =============================================
// Types
// =============================================

type InventoryItem = {
  productId: string;
  productCode: string;
  productName: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  quantityInBase: number;
  displayText: string;
  displayUnits: Array<{
    unitId: string;
    unitName: string;
    count: number;
    multiplier: number;
  }>;
  updatedAt: string;
  nearestExpiry?: {
    expiryDate: string;
    daysUntilExpiry: number;
    lotNumber: string;
    expiryStatus: "ok" | "warning" | "critical" | "expired";
  } | null;
  totalBatches?: number;
};

type ProductUnit = {
  unitId: string;
  unitName: string;
  multiplierToBase: number;
  isBase: boolean;
};

type BatchInfo = {
  batchId: string;
  lotNumber: string;
  expiryDate: string;
  quantityInBase: number;
  displayText: string;
  daysUntilExpiry: number;
  expiryStatus: "ok" | "warning" | "critical" | "expired";
};

type AdjustmentCartItem = {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  adjustmentType: "add" | "reduce" | "set";
  unitId: string;
  unitName: string;
  quantity: number;
  note: string;
  selectedBatches: Array<{
    batchId: string;
    lotNumber: string;
    expiryDate: string;
    quantityInThisUnit: number;
  }>;
  selectedBatchId?: string; // For Rapid Mode
  selectedBatchNumber?: string; // For Rapid Mode
  currentBalanceInBase: number;
  afterBalanceInBase: number;
  displayBefore: string;
  displayAfter: string;
  multiplierToBase: number;
};

type EmployeeOption = {
  id: string;
  name: string;
  employeeCode: string | null;
  defaultStoreId?: string | null;
};

type StoreOption = {
  id: string;
  name: string;
  province?: string | null;
};

// =============================================
// Main Component
// =============================================

export default function StockAdjustmentSection() {
  const { user: _user } = useAuth();
  const { openModal, closeModal } = useModal();
  const queryClient = useQueryClient();

  // State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [isRapidMode, setIsRapidMode] = useState(false); // New Rapid Mode State
  const [searchTerm, setSearchTerm] = useState("");
  const [batchDrawerOpen, setBatchDrawerOpen] = useState(false);
  const [batchDrawerProduct, setBatchDrawerProduct] = useState<InventoryItem | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [cart, setCart] = useState<AdjustmentCartItem[]>([]);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  // Assigned stores state
  const [assignedStores, setAssignedStores] = useState<StoreOption[]>([]);
  const [isLoadingAssignedStores, setIsLoadingAssignedStores] = useState(false);

  // =============================================
  // Data Fetching
  // =============================================

  // Fetch employees
  const { data: employees = [] } = useQuery<EmployeeOption[]>({
    queryKey: ["employees-simple"],
    queryFn: async () => {
      const res = await fetch("/api/admin/employees?fields=id,name,employeeCode");
      if (!res.ok) throw new Error("Failed to fetch employees");
      const result = await res.json();
      return result.employees || [];
    },
  });

  // Fetch stores
  const { data: stores = [] } = useQuery<StoreOption[]>({
    queryKey: ["stores-simple"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stores?fields=id,name,province");
      if (!res.ok) throw new Error("Failed to fetch stores");
      const result = await res.json();
      return result.stores || [];
    },
  });

  // Fetch inventory
  const {
    data: inventory = [],
    isLoading: loadingInventory,
    refetch: _refetchInventory,
  } = useQuery<InventoryItem[]>({
    queryKey: ["stock-inventory", selectedEmployeeId, selectedStoreId],
    queryFn: async () => {
      if (!selectedEmployeeId || !selectedStoreId) return [];

      const params = new URLSearchParams({
        employeeId: selectedEmployeeId,
        storeId: selectedStoreId,
      });

      const res = await fetch(`/api/stock/inventory?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch inventory");

      const result = await res.json();
      return result.inventory || [];
    },
    enabled: Boolean(selectedEmployeeId && selectedStoreId),
    staleTime: 30000,
  });

  // Fetch product units
  const { data: productUnits = [] } = useQuery<
    Array<{ productId: string; units: ProductUnit[] }>
  >({
    queryKey: ["product-units-for-adjustment"],
    queryFn: async () => {
      const res = await fetch("/api/admin/products?view=catalog");
      if (!res.ok) throw new Error("Failed to fetch product units");
      const result = await res.json();

      return result.products.map((p: { id: string; units: Array<{ id: string; name: string; multiplierToBase: number; isBase: boolean }> }) => ({
        productId: p.id,
        units: p.units.map((u: { id: string; name: string; multiplierToBase: number; isBase: boolean }) => ({
          unitId: u.id,
          unitName: u.name,
          multiplierToBase: u.multiplierToBase,
          isBase: u.isBase,
        })),
      }));
    },
  });

  // ✅ Fetch assigned stores for the selected employee
  useEffect(() => {
    if (!selectedEmployeeId) {
      setAssignedStores([]);
      return;
    }

    let active = true;
    const fetchAssignedStores = async () => {
      setIsLoadingAssignedStores(true);
      try {
        const response = await fetch(`/api/admin/employees/${selectedEmployeeId}/stores`);
        if (!response.ok) {
          throw new Error("ไม่สามารถโหลดรายการร้านที่ได้รับมอบหมายได้");
        }
        const data = (await response.json()) as {
          success: boolean;
          assignments?: Array<{ storeId: string; storeName: string; isPrimary: boolean }>;
        };
        if (!active) return;

        const list: StoreOption[] = (data.assignments ?? []).map((assignment) => {
          const fullStore = stores.find(s => s.id === assignment.storeId);
          return {
            id: assignment.storeId,
            name: assignment.storeName,
            province: fullStore?.province,
          };
        });
        setAssignedStores(list);
      } catch (error) {
        if (!active) return;
        console.error("Failed to fetch assigned stores:", error);
        setAssignedStores([]);
      } finally {
        if (active) setIsLoadingAssignedStores(false);
      }
    };

    void fetchAssignedStores();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId]);

  // ✅ Auto-fill store if employee has only one assigned store
  useEffect(() => {
    if (assignedStores.length === 1 && !selectedStoreId) {
      setSelectedStoreId(assignedStores[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedStores.length, assignedStores[0]?.id]);

  // ✅ Sync modal state with ModalContext (for SiteNav positioning)
  useEffect(() => {
    const MODAL_ID = 'stock-adjustment-modal';
    if (showAdjustModal) {
      openModal(MODAL_ID);
    } else {
      closeModal(MODAL_ID);
    }

    return () => {
      // Cleanup: always close modal on unmount
      closeModal(MODAL_ID);
    };
  }, [showAdjustModal, openModal, closeModal]);

  // =============================================
  // Helpers
  // =============================================

  const getUnitsForProduct = useCallback(
    (productId: string): ProductUnit[] => {
      const product = productUnits.find((p) => p.productId === productId);
      return product?.units || [];
    },
    [productUnits]
  );

  const getInventoryItem = useCallback(
    (productId: string): InventoryItem | null => {
      return inventory.find((item) => item.productId === productId) || null;
    },
    [inventory]
  );

  const calculateAfterBalance = useCallback(
    (
      currentBalanceInBase: number,
      adjustmentType: "add" | "reduce" | "set",
      quantity: number,
      multiplierToBase: number
    ): number => {
      const quantityInBase = quantity * multiplierToBase;

      if (adjustmentType === "add") {
        return currentBalanceInBase + quantityInBase;
      } else if (adjustmentType === "reduce") {
        return Math.max(0, currentBalanceInBase - quantityInBase);
      } else {
        return quantityInBase;
      }
    },
    []
  );

  const smartDisplayStock = useCallback(
    (quantityInBase: number, productId: string): string => {
      const units = getUnitsForProduct(productId);
      if (units.length === 0) return `${quantityInBase}`;

      const sortedUnits = [...units].sort(
        (a, b) => b.multiplierToBase - a.multiplierToBase
      );

      let remaining = quantityInBase;
      const parts: string[] = [];

      for (const unit of sortedUnits) {
        const count = Math.floor(remaining / unit.multiplierToBase);
        if (count > 0) {
          parts.push(`${count} ${unit.unitName}`);
          remaining -= count * unit.multiplierToBase;
        }
      }

      return parts.length > 0 ? parts.join(" ") : "0";
    },
    [getUnitsForProduct]
  );

  // =============================================
  // Cart Operations
  // =============================================

  const handleRemoveFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleClearCart = useCallback(() => {
    if (confirm("ยืนยันการล้างรายการทั้งหมด?")) {
      setCart([]);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (cart.length === 0) {
      alert("ไม่มีรายการปรับสต็อก");
      return;
    }

    if (
      !confirm(
        `ยืนยันการบันทึกการปรับสต็อก ${cart.length} รายการ?\n\nการดำเนินการนี้จะบันทึกลงฐานข้อมูลทันที`
      )
    ) {
      return;
    }

    submitMutation.mutate(cart);
  }, [cart]);

  // =============================================
  // Submit Mutation
  // =============================================

  const submitMutation = useMutation({
    mutationFn: async (adjustments: AdjustmentCartItem[]) => {
      const payload = adjustments.map((item) => ({
        transaction_type:
          item.adjustmentType === "add"
            ? "adjustment-add"
            : item.adjustmentType === "reduce"
              ? "adjustment-reduce"
              : "adjustment-set",
        employee_id: selectedEmployeeId,
        store_id: selectedStoreId,
        product_id: item.productId,
        unit_id: item.unitId,
        quantity: item.quantity,
        adjustment_type: item.adjustmentType,
        adjustment_reason: item.note || "Stock adjustment",
        selected_batches: item.selectedBatches.map((b) => ({
          batch_id: b.batchId,
          quantity: b.quantityInThisUnit,
        })),
      }));

      const res = await fetch("/api/stock/adjustment/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustments: payload }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to submit adjustments");
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["stock-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["stock-batches"] }); // Invalidate batches too
      setCart([]);
      setShowAdjustModal(false);
      alert("✅ บันทึกการปรับสต็อกสำเร็จ");
    },
    onError: (error) => {
      alert(`❌ ${error instanceof Error ? error.message : "เกิดข้อผิดพลาด"}`);
    },
  });

  // =============================================
  // Filtered Inventory
  // =============================================

  const filteredInventory = useMemo(() => {
    if (!searchTerm.trim()) return inventory;

    const term = searchTerm.toLowerCase();
    return inventory.filter(
      (item) =>
        item.productCode.toLowerCase().includes(term) ||
        item.productName.toLowerCase().includes(term) ||
        item.companyName?.toLowerCase().includes(term)
    );
  }, [inventory, searchTerm]);

  // =============================================
  // Render Helpers
  // =============================================

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);
  // Batch Selection Handler
  const handleSelectBatch = useCallback((batch: BatchInfo) => {
    if (!batchDrawerProduct) return;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === batchDrawerProduct.productId);

      if (existingIndex >= 0) {
        // Update existing item with new batch
        const newCart = [...prev];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          selectedBatchId: batch.batchId,
          selectedBatchNumber: batch.lotNumber,
          // If quantity was 0 (just selecting batch), keep it 0. If it had quantity, keep it.
        };
        return newCart;
      } else {
        // Create new item with 0 quantity but selected batch
        const baseUnit = batchDrawerProduct.displayUnits.find(u => u.multiplier === 1) || batchDrawerProduct.displayUnits[0];
        const newItem: AdjustmentCartItem = {
          id: crypto.randomUUID(),
          productId: batchDrawerProduct.productId,
          productCode: batchDrawerProduct.productCode,
          productName: batchDrawerProduct.productName,
          adjustmentType: "add", // Default to add
          unitId: baseUnit.unitId,
          unitName: baseUnit.unitName,
          quantity: 0, // Start with 0
          note: "",
          selectedBatches: [],
          selectedBatchId: batch.batchId,
          selectedBatchNumber: batch.lotNumber,
          currentBalanceInBase: batchDrawerProduct.quantityInBase,
          afterBalanceInBase: batchDrawerProduct.quantityInBase,
          displayBefore: batchDrawerProduct.displayText,
          displayAfter: "...",
          multiplierToBase: baseUnit.multiplier,
        };
        return [...prev, newItem];
      }
    });
    setBatchDrawerOpen(false);
    setBatchDrawerProduct(null);
  }, [batchDrawerProduct]);

  // Rapid Mode Handlers
  const handleRapidAdd = useCallback((product: InventoryItem) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.productId);

      if (existingIndex >= 0) {
        const item = prev[existingIndex];
        // Check if batch is selected
        if (!item.selectedBatchId) {
          setBatchDrawerProduct(product);
          setBatchDrawerOpen(true);
          return prev;
        }

        // Update existing item
        const newCart = [...prev];

        // If currently reducing, decrease the reduction (move towards 0 or positive)
        if (item.adjustmentType === "reduce") {
          if (item.quantity === 1) {
            // Remove item if it reaches 0
            return prev.filter((_, i) => i !== existingIndex);
          }
          newCart[existingIndex] = { ...item, quantity: item.quantity - 1 };
        } else {
          // Increase addition
          newCart[existingIndex] = { ...item, quantity: item.quantity + 1 };
        }
        return newCart;
      } else {
        // No item in cart yet -> Open Drawer
        setBatchDrawerProduct(product);
        setBatchDrawerOpen(true);
        return prev;
      }
    });
  }, []);

  const handleRapidRemove = useCallback((product: InventoryItem) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.productId);

      if (existingIndex >= 0) {
        const item = prev[existingIndex];
        // Check if batch is selected
        if (!item.selectedBatchId) {
          setBatchDrawerProduct(product);
          setBatchDrawerOpen(true);
          return prev;
        }

        // Update existing item
        const newCart = [...prev];

        // If currently adding, decrease the addition
        if (item.adjustmentType === "add") {
          if (item.quantity === 1) {
            // Remove item if it reaches 0
            return prev.filter((_, i) => i !== existingIndex);
          }
          newCart[existingIndex] = { ...item, quantity: item.quantity - 1 };
        } else {
          // Increase reduction
          newCart[existingIndex] = { ...item, quantity: item.quantity + 1 };
        }
        return newCart;
      } else {
        // No item in cart yet -> Open Drawer
        setBatchDrawerProduct(product);
        setBatchDrawerOpen(true);
        return prev;
      }
    });
  }, []);

  const handleRapidUpdate = useCallback((product: InventoryItem, newQty: number, unitSummary?: string) => {
    setCart((prev) => {
      if (newQty === 0) {
        return prev.filter((item) => item.productId !== product.productId);
      }

      const existingIndex = prev.findIndex((item) => item.productId === product.productId);
      const adjustmentType = newQty > 0 ? "add" : "reduce";
      const absQty = Math.abs(newQty);

      if (existingIndex >= 0) {
        const item = prev[existingIndex];
        if (!item.selectedBatchId) {
          setBatchDrawerProduct(product);
          setBatchDrawerOpen(true);
          return prev;
        }

        const newCart = [...prev];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: absQty,
          adjustmentType,
          unitName: unitSummary || newCart[existingIndex].unitName // Update with multi-unit summary
        };
        return newCart;
      } else {
        // Should not happen via input if readOnly is set correctly, but safe to handle
        setBatchDrawerProduct(product);
        setBatchDrawerOpen(true);
        return prev;
      }
    });
  }, []);

  const availableStores = assignedStores.length > 0 ? assignedStores : stores;
  const hasMultipleStores = availableStores.length > 1;

  return (
    <>
      <div className="w-full bg-gradient-to-br from-blue-50 via-cyan-50 to-white px-2 py-4 sm:px-4 md:px-6 lg:p-8 font-sans">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-24">

          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex w-full items-center gap-4">
              {/* Header & Filters */}
              <div className="w-full space-y-4">
                <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-cyan-600">
                      Stock Adjustment
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">ปรับปรุงยอดสต็อกสินค้า</p>
                  </div>

                  {/* Rapid Mode Toggle */}
                  <button
                    onClick={() => setIsRapidMode(!isRapidMode)}
                    className={`group relative flex items-center gap-3 rounded-2xl border px-4 py-2 transition-all duration-300 ${isRapidMode
                      ? "border-cyan-400 bg-cyan-50/50 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                      : "border-slate-200 bg-white/50 hover:border-blue-300"
                      }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 ${isRapidMode
                        ? "bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg scale-110"
                        : "bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600"
                        }`}
                    >
                      <Zap className={`h-5 w-5 ${isRapidMode ? "fill-white" : ""}`} />
                    </div>
                    <div className="text-left">
                      <p
                        className={`text-xs font-bold uppercase tracking-wider ${isRapidMode ? "text-cyan-600" : "text-slate-500"
                          }`}
                      >
                        Rapid Mode
                      </p>
                      <p className={`text-sm font-medium ${isRapidMode ? "text-blue-700" : "text-slate-700"}`}>
                        {isRapidMode ? "ปรับด่วน (เปิด)" : "ปรับปกติ"}
                      </p>
                    </div>
                    {isRapidMode && (
                      <span className="absolute -right-1 -top-1 flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-500"></span>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>


            {/* Stats Cards */}
            {selectedEmployee && selectedStoreId && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex gap-3"
              >
                <div className="px-4 py-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white shadow-sm">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">สินค้าทั้งหมด</p>
                  <p className="text-xl font-bold text-blue-700">{inventory.length}</p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white shadow-sm">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">ในตะกร้า</p>
                  <p className="text-xl font-bold text-cyan-600">{cart.length}</p>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Filters Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl sm:rounded-3xl border border-white/50 bg-white/40 backdrop-blur-md shadow-xl shadow-blue-100/50 overflow-hidden"
          >
            <div className="p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div className="flex items-center gap-2 text-blue-800">
                  <Filter className="h-5 w-5" />
                  <h2 className="text-lg font-bold">ตัวกรองการค้นหา</h2>
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="p-2 rounded-full hover:bg-white/50 transition-colors text-blue-600"
                >
                  <ChevronRight
                    className={`h-5 w-5 transition-transform duration-300 ${showFilters ? "rotate-90" : ""
                      }`}
                  />
                </button>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 pb-2">
                      {/* Employee Select */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-500" />
                          พนักงาน
                        </label>
                        <div className="relative">
                          <select
                            value={selectedEmployeeId}
                            onChange={(e) => {
                              setSelectedEmployeeId(e.target.value);
                              setCart([]);
                              setSelectedStoreId("");
                            }}
                            className="w-full appearance-none rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-slate-700 shadow-sm transition-all hover:border-blue-300 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                          >
                            <option value="">เลือกพนักงาน...</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} {emp.employeeCode && `(${emp.employeeCode})`}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <ChevronRight className="h-4 w-4 rotate-90" />
                          </div>
                        </div>
                      </div>

                      {/* Store Select */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Store className="h-4 w-4 text-cyan-500" />
                          ร้านค้า / สาขา
                        </label>
                        <div className="relative">
                          <select
                            value={selectedStoreId}
                            onChange={(e) => {
                              setSelectedStoreId(e.target.value);
                              setCart([]);
                            }}
                            disabled={!selectedEmployeeId || isLoadingAssignedStores || !hasMultipleStores}
                            className="w-full appearance-none rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-slate-700 shadow-sm transition-all hover:border-blue-300 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
                          >
                            <option value="">
                              {isLoadingAssignedStores
                                ? "กำลังโหลด..."
                                : !hasMultipleStores && availableStores.length === 1
                                  ? availableStores[0].name
                                  : "เลือกร้านค้า..."}
                            </option>
                            {hasMultipleStores &&
                              availableStores.map((store) => (
                                <option key={store.id} value={store.id}>
                                  {store.name} {store.province && `(${store.province})`}
                                </option>
                              ))}
                          </select>
                          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <ChevronRight className="h-4 w-4 rotate-90" />
                          </div>
                        </div>
                        {!hasMultipleStores && availableStores.length === 1 && (
                          <p className="text-xs text-blue-500 font-medium ml-1">
                            * เลือกให้อัตโนมัติ (มีสิทธิ์เพียง 1 ร้าน)
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Main Content Area */}
          <AnimatePresence mode="wait">
            {selectedEmployeeId && selectedStoreId ? (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Search Bar */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-blue-400 group-focus-within:text-blue-600 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder="ค้นหาสินค้าด้วย ชื่อ, รหัส หรือ บริษัท..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-2xl border-none bg-white py-4 pl-12 pr-12 text-lg shadow-lg shadow-blue-100/50 ring-1 ring-blue-100 transition-all placeholder:text-slate-300 hover:shadow-xl hover:shadow-blue-200/50 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>

                {/* Inventory Grid */}
                {loadingInventory ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <RefreshCw className="h-10 w-10 animate-spin text-blue-500 mb-4" />
                    <p className="text-slate-500 font-medium">กำลังโหลดข้อมูลสต็อก...</p>
                  </div>
                ) : filteredInventory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-3xl border border-dashed border-blue-200">
                    <Box className="h-16 w-16 text-blue-200 mb-4" />
                    <p className="text-lg font-semibold text-slate-600">
                      {searchTerm ? "ไม่พบสินค้าที่ค้นหา" : "ไม่มีสินค้าในสต็อก"}
                    </p>
                    <p className="text-slate-400">ลองเปลี่ยนคำค้นหา หรือเลือกเงื่อนไขอื่น</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {filteredInventory.map((item) => {
                      if (isRapidMode) {
                        const cartItem = cart.find(c => c.productId === item.productId);
                        return (
                          <RapidProductCard
                            key={item.productId}
                            item={item}
                            cartItem={cartItem}
                            onAdd={() => handleRapidAdd(item)}
                            onRemove={() => handleRapidRemove(item)}
                            onUpdate={(qty, unitSummary) => handleRapidUpdate(item, qty, unitSummary)}
                            onOpenBatchDrawer={() => {
                              setBatchDrawerProduct(item);
                              setBatchDrawerOpen(true);
                            }}
                            getUnitsForProduct={getUnitsForProduct}
                          />
                        );
                      }
                      return (
                        <ProductCard
                          key={item.productId}
                          item={item}
                          onClick={() => {
                            setSelectedProduct(item);
                            setShowAdjustModal(true);
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-24 px-4 text-center bg-white/40 backdrop-blur-sm rounded-3xl border border-white shadow-xl"
              >
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <Package className="h-12 w-12 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">เริ่มต้นใช้งาน</h3>
                <p className="text-slate-500 max-w-md">
                  กรุณาเลือก <span className="text-blue-600 font-bold">พนักงาน</span> และ{" "}
                  <span className="text-cyan-600 font-bold">ร้านค้า</span>{" "}
                  ด้านบนเพื่อดูรายการสินค้าและเริ่มทำการปรับสต็อก
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div >
      </div >

      {/* Floating Dock (Glass Command Center) - Moved outside container */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 sm:bottom-6 left-2 right-2 sm:left-4 sm:right-4 mx-auto max-w-4xl"
            style={{ zIndex: 9999 }}
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 rounded-2xl border border-white/40 bg-white/95 p-3 sm:p-2 shadow-2xl shadow-blue-500/20 backdrop-blur-xl">
              {/* Cart Info */}
              <div
                onClick={() => setShowAdjustModal(true)}
                className="flex flex-1 cursor-pointer items-center gap-3 sm:gap-4 px-2 sm:px-4"
              >
                <div className="relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg flex-shrink-0">
                  <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="absolute -right-1 -top-1 sm:-right-2 sm:-top-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold ring-2 ring-white">
                    {cart.length}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                    รายการแก้ไข
                  </p>
                  <p className="text-sm sm:text-base font-bold text-slate-800 truncate">
                    {cart.length} รายการ
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={handleClearCart}
                  className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500 flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button
                  onClick={() => setShowAdjustModal(true)}
                  className="flex h-10 sm:h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 sm:px-6 text-sm sm:text-base font-bold text-white shadow-md hover:shadow-lg transition-all active:scale-95 flex-shrink-0"
                >
                  <span>ตรวจสอบ</span>
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Adjustment Modal */}
      <AnimatePresence>
        {
          showAdjustModal && (
            <AdjustmentModal
              product={selectedProduct}
              employeeId={selectedEmployeeId}
              storeId={selectedStoreId}
              cart={cart}
              productUnits={productUnits}
              onAddToCart={(item) => setCart((prev) => [...prev, item])}
              onRemoveFromCart={handleRemoveFromCart}
              onClearCart={handleClearCart}
              onSubmit={handleSubmit}
              onClose={() => {
                setShowAdjustModal(false);
                setSelectedProduct(null);
              }}
              getUnitsForProduct={getUnitsForProduct}
              getInventoryItem={getInventoryItem}
              calculateAfterBalance={calculateAfterBalance}
              smartDisplayStock={smartDisplayStock}
              submitMutation={submitMutation}
            />
          )
        }
      </AnimatePresence >

      {/* Batch Selection Drawer */}
      <BatchSelectionDrawer
        isOpen={batchDrawerOpen}
        onClose={() => {
          setBatchDrawerOpen(false);
          setBatchDrawerProduct(null);
        }}
        product={batchDrawerProduct}
        employeeId={selectedEmployeeId}
        storeId={selectedStoreId}
        onSelectBatch={handleSelectBatch}
      />
    </>
  );
}

// =============================================
// Sub-Components
// =============================================

const ProductCard = memo(({ item, onClick }: { item: InventoryItem; onClick: () => void }) => (
  <motion.button
    layout
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ scale: 1.02, y: -2 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="group relative flex flex-col items-start w-full p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-100/50 hover:border-blue-200 transition-all text-left overflow-hidden"
  >
    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="bg-blue-50 p-2 rounded-full text-blue-600">
        <Edit3 className="h-4 w-4" />
      </div>
    </div>

    {/* Logo + Product Code Row */}
    <div className="flex items-center gap-2 mb-3">
      {item.companyLogoUrl && (
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-white border border-slate-100 shadow-sm flex-shrink-0">
          <img
            src={item.companyLogoUrl}
            alt={item.companyName || "Company"}
            className="w-full h-full object-contain p-1"
          />
        </div>
      )}
      <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-mono text-xs font-bold tracking-wide group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
        {item.productCode}
      </span>
    </div>

    <h3 className="font-bold text-slate-800 text-base sm:text-lg leading-tight mb-4 line-clamp-3 group-hover:text-blue-700 transition-colors">
      {item.productName}
    </h3>

    <div className="mt-auto w-full pt-4 border-t border-slate-50 flex items-center justify-between">
      <div className="flex items-center gap-2 text-slate-600">
        <Package className="h-4 w-4 text-cyan-500" />
        <span className="font-semibold text-sm">{item.displayText}</span>
      </div>

      {item.nearestExpiry && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 text-amber-700 text-xs font-medium">
          <Calendar className="h-3 w-3" />
          <span>{new Date(item.nearestExpiry.expiryDate).toLocaleDateString("th-TH")}</span>
        </div>
      )}
    </div>
  </motion.button>
));

ProductCard.displayName = "ProductCard";

const RapidProductCard = memo(({
  item,
  cartItem,
  onAdd: _onAdd,
  onRemove: _onRemove,
  onUpdate,
  onOpenBatchDrawer,
  getUnitsForProduct,
}: {
  item: InventoryItem;
  cartItem?: AdjustmentCartItem;
  onAdd: () => void;
  onRemove: () => void;
  onUpdate: (qty: number, unitSummary?: string) => void;
  onOpenBatchDrawer: () => void;
  getUnitsForProduct: (productId: string) => ProductUnit[];
}) => {
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [unitQuantities, setUnitQuantities] = useState<Record<string, number>>({});
  const quantity = cartItem ? cartItem.quantity : 0;
  const isNegative = cartItem?.adjustmentType === "reduce";
  const _displayQty = isNegative ? -quantity : quantity;
  const selectedBatchNumber = cartItem?.selectedBatchNumber;

  // Get available units for this product
  const availableUnits = getUnitsForProduct(item.productId);

  // Auto-select base unit on mount
  useEffect(() => {
    if (!selectedUnitId && availableUnits.length > 0) {
      const baseUnit = availableUnits.find(u => u.isBase) || availableUnits[0];
      setSelectedUnitId(baseUnit.unitId);
    }
  }, [availableUnits, selectedUnitId]);

  const selectedUnit = availableUnits.find(u => u.unitId === selectedUnitId);

  // Calculate total quantity from all units
  const totalQty = Object.entries(unitQuantities).reduce((sum, [unitId, qty]) => {
    const unit = availableUnits.find(u => u.unitId === unitId);
    return sum + (qty * (unit?.multiplierToBase || 1));
  }, 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative w-full rounded-2xl border transition-all ${quantity > 0
        ? isNegative
          ? "bg-red-50/50 border-red-200 shadow-sm"
          : "bg-emerald-50/50 border-emerald-200 shadow-sm"
        : "bg-white border-slate-100"
        }`}
    >
      <div className="flex flex-col gap-3 p-3 pr-6 sm:p-4 sm:pr-8">
        {/* Row 1: Image + Product Info */}
        <div className="flex items-start gap-3 min-w-0">
          {/* Image - Fixed size, no shrink */}
          <div className="relative h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-white">
            {item.companyLogoUrl ? (
              <img
                src={item.companyLogoUrl}
                alt={item.companyName || "Product"}
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-50 text-slate-300">
                <Package className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            )}
          </div>

          {/* Product Info - Can shrink */}
          <div className="flex-1 min-w-0">
            {/* Code + Company + Badges */}
            <div className="flex flex-wrap items-center gap-1 mb-1">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 flex-shrink-0">
                {item.productCode}
              </span>
              {item.companyName && (
                <span className="text-[10px] sm:text-xs text-slate-400 font-medium truncate max-w-[80px] sm:max-w-[120px]">
                  • {item.companyName}
                </span>
              )}
              {item.totalBatches && item.totalBatches > 0 && (
                <span className="inline-flex items-center gap-0.5 sm:gap-1 rounded-full bg-blue-100 px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-blue-600 flex-shrink-0">
                  <Layers className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  <span className="hidden xs:inline">{item.totalBatches} Lot</span>
                  <span className="xs:hidden">{item.totalBatches}</span>
                </span>
              )}
            </div>

            {/* Product Name */}
            <h3 className="font-bold text-slate-800 text-xs sm:text-sm line-clamp-2 mb-1 leading-tight">
              {item.productName}
            </h3>

            {/* Stock Display */}
            <p className="text-[10px] sm:text-xs text-slate-500">
              คงเหลือ: <span className="font-semibold text-slate-700">{item.displayText}</span>
            </p>
          </div>
        </div>

        {/* Row 2: Batch Selection */}
        <button
          onClick={onOpenBatchDrawer}
          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${selectedBatchNumber
            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
            : "bg-amber-100 text-amber-700 hover:bg-amber-200 animate-pulse"
            }`}
        >
          <Ticket className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">
            {selectedBatchNumber ? `LOT: ${selectedBatchNumber}` : "เลือก LOT (จำเป็น)"}
          </span>
          <ChevronRight className="h-3 w-3 opacity-50 flex-shrink-0" />
        </button>

        {/* Row 3: Multi-Unit Input */}
        {selectedBatchNumber && (
          <div className="space-y-2">
            {/* Mobile: Tabs */}
            <div className="lg:hidden">
              <div className="flex gap-1 mb-2 overflow-x-auto">
                {availableUnits.map((unit) => (
                  <button
                    key={unit.unitId}
                    onClick={() => setSelectedUnitId(unit.unitId)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${selectedUnitId === unit.unitId
                      ? "bg-blue-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                  >
                    {unit.unitName}
                  </button>
                ))}
              </div>

              {/* Selected unit controls */}
              {selectedUnit && (
                <div className="bg-white/90 rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        const current = unitQuantities[selectedUnitId] || 0;
                        if (current > 0) {
                          setUnitQuantities({ ...unitQuantities, [selectedUnitId]: current - 1 });
                        }
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 transition-colors flex-shrink-0"
                    >
                      <Minus className="h-4 w-4" />
                    </button>

                    <input
                      type="number"
                      min="0"
                      value={unitQuantities[selectedUnitId] || ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setUnitQuantities({ ...unitQuantities, [selectedUnitId]: val });
                      }}
                      placeholder="0"
                      className="w-24 text-center text-base font-bold bg-white rounded-lg border border-slate-200 outline-none text-blue-600 py-1.5 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />

                    <button
                      onClick={() => {
                        const current = unitQuantities[selectedUnitId] || 0;
                        setUnitQuantities({ ...unitQuantities, [selectedUnitId]: current + 1 });
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-600 transition-colors flex-shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop: All Units Stacked Vertically */}
            <div className="hidden lg:block space-y-2">
              {availableUnits.map((unit) => (
                <div key={unit.unitId} className="bg-white/90 rounded-lg border border-slate-200 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 min-w-[50px]">{unit.unitName}</span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const current = unitQuantities[unit.unitId] || 0;
                          if (current > 0) {
                            setUnitQuantities({ ...unitQuantities, [unit.unitId]: current - 1 });
                          }
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded-md bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>

                      <input
                        type="number"
                        min="0"
                        value={unitQuantities[unit.unitId] || ""}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setUnitQuantities({ ...unitQuantities, [unit.unitId]: val });
                        }}
                        placeholder="0"
                        className="w-16 text-center text-sm font-bold bg-white rounded-md border border-slate-200 outline-none text-blue-600 py-1 focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                      />

                      <button
                        onClick={() => {
                          const current = unitQuantities[unit.unitId] || 0;
                          setUnitQuantities({ ...unitQuantities, [unit.unitId]: current + 1 });
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded-md bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-600 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary & Add Button */}
            {totalQty > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-xs font-bold text-blue-700">รวมทั้งหมด:</span>
                  <span className="text-sm font-bold text-blue-900">{totalQty} (หน่วยฐาน)</span>
                </div>

                <button
                  onClick={() => {
                    // Add multi-unit to cart
                    const summary = Object.entries(unitQuantities)
                      .filter(([_, qty]) => qty > 0)
                      .map(([unitId, qty]) => {
                        const unit = availableUnits.find(u => u.unitId === unitId);
                        return `${qty} ${unit?.unitName}`;
                      })
                      .join(' ');

                    // Call onUpdate with total quantity in base unit AND the multi-unit summary
                    onUpdate(totalQty, summary);

                    // Clear quantities after adding
                    setUnitQuantities({});
                  }}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold text-sm hover:shadow-lg transition-all"
                >
                  เพิ่มลงตะกร้า
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});
RapidProductCard.displayName = "RapidProductCard";



const BatchSelectionDrawer = memo(({
  isOpen,
  onClose,
  product,
  employeeId,
  storeId,
  onSelectBatch
}: {
  isOpen: boolean;
  onClose: () => void;
  product: InventoryItem | null;
  employeeId: string;
  storeId: string;
  onSelectBatch: (batch: BatchInfo) => void;
}) => {
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["stock-batches", product?.productId, employeeId, storeId],
    queryFn: async () => {
      if (!product) return [];
      const params = new URLSearchParams({
        productId: product.productId,
        employeeId,
        storeId,
      });
      const res = await fetch(`/api/stock/batches/by-product?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch batches");
      const result = await res.json();
      return (result.data?.batches || []).map((b: { id: string; lotNumber: string; expiryDate: string | null; remainingQuantity: number; daysUntilExpiry: number | null; expiryStatus: string }) => ({
        batchId: b.id,
        lotNumber: b.lotNumber,
        expiryDate: b.expiryDate,
        quantityInBase: b.remainingQuantity || 0,
        displayText: `${b.remainingQuantity || 0}`,
        daysUntilExpiry: b.daysUntilExpiry,
        expiryStatus: b.expiryStatus,
      })) as BatchInfo[];
    },
    enabled: isOpen && !!product,
    staleTime: 0,
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
            style={{ position: 'fixed' }}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">เลือก LOT สินค้า</h3>
                <p className="text-sm text-slate-500">{product?.productName}</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : batches.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  ไม่พบข้อมูล LOT
                </div>
              ) : (
                batches.map((batch) => (
                  <button
                    key={batch.batchId}
                    onClick={() => onSelectBatch(batch)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:bg-blue-50 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${batch.expiryStatus === 'expired' ? 'bg-red-100 text-red-600' :
                        batch.expiryStatus === 'critical' ? 'bg-orange-100 text-orange-600' :
                          batch.expiryStatus === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                            'bg-blue-100 text-blue-600'
                        }`}>
                        <Ticket className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-700 group-hover:text-blue-700">
                          Lot: {batch.lotNumber}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Exp: {new Date(batch.expiryDate).toLocaleDateString("th-TH")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800">{batch.displayText}</p>
                      <p className="text-xs text-slate-400">คงเหลือ</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});
BatchSelectionDrawer.displayName = "BatchSelectionDrawer";

// =============================================
// Modal Component
// =============================================

interface AdjustmentModalProps {
  product: InventoryItem | null;
  employeeId: string;
  storeId: string;
  cart: AdjustmentCartItem[];
  productUnits: Array<{ productId: string; units: ProductUnit[] }>;
  onAddToCart: (item: AdjustmentCartItem) => void;
  onRemoveFromCart: (id: string) => void;
  onClearCart: () => void;
  onSubmit: () => void;
  onClose: () => void;
  getUnitsForProduct: (productId: string) => ProductUnit[];
  getInventoryItem: (productId: string) => InventoryItem | null;
  calculateAfterBalance: (
    currentBalanceInBase: number,
    adjustmentType: "add" | "reduce" | "set",
    quantity: number,
    multiplierToBase: number
  ) => number;
  smartDisplayStock: (quantityInBase: number, productId: string) => string;
  submitMutation: {
    isPending: boolean;
    mutate: (data: AdjustmentCartItem[]) => void;
  };
}

function AdjustmentModal({
  product,
  employeeId,
  storeId,
  cart,
  onAddToCart,
  onRemoveFromCart,
  onClearCart,
  onSubmit,
  onClose,
  getUnitsForProduct,
  calculateAfterBalance,
  smartDisplayStock,
  submitMutation,
}: AdjustmentModalProps) {
  const [mode, setMode] = useState<"add" | "cart">(product ? "add" : "cart");
  const [adjustmentType, setAdjustmentType] = useState<"add" | "reduce" | "set">("add");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [note, setNote] = useState("");
  const [selectedBatches, setSelectedBatches] = useState<
    Map<string, { batchId: string; lotNumber: string; expiryDate: string; quantityInThisUnit: number }>
  >(new Map());

  // Multi-unit state
  const [unitQuantities, setUnitQuantities] = useState<Record<string, number>>({});

  // Get available units for this product (must be before useEffect that uses it)
  const availableUnits = product ? getUnitsForProduct(product.productId) : [];

  // Load batches using useQuery
  const { data: batches = [], isLoading: loadingBatches } = useQuery({
    queryKey: ["stock-batches", product?.productId, employeeId, storeId],
    queryFn: async () => {
      if (!product) return [];
      const params = new URLSearchParams({
        productId: product.productId,
        employeeId,
        storeId,
      });
      // Use the correct endpoint that returns remainingQuantity
      const res = await fetch(`/api/stock/batches/by-product?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch batches");
      const result = await res.json();

      // Map the response to BatchInfo type
      return (result.data?.batches || []).map((b: { id: string; lotNumber: string; expiryDate: string | null; remainingQuantity: number; daysUntilExpiry: number | null; expiryStatus: string }) => ({
        batchId: b.id,
        lotNumber: b.lotNumber,
        expiryDate: b.expiryDate,
        quantityInBase: b.remainingQuantity || 0, // Use remainingQuantity instead of initialQuantity
        displayText: `${b.remainingQuantity || 0}`,
        daysUntilExpiry: b.daysUntilExpiry,
        expiryStatus: b.expiryStatus,
      })) as BatchInfo[];
    },
    enabled: !!product, // Changed: Don't require selectedUnitId anymore
    staleTime: 0, // Always fetch fresh data
  });

  // Reset selected batches and unit quantities when product changes
  useEffect(() => {
    setSelectedBatches(new Map());
    setUnitQuantities({});
    setSelectedUnitId("");
  }, [product?.productId]);

  // Auto-select first unit on mobile when modal opens
  useEffect(() => {
    if (availableUnits.length > 0 && !selectedUnitId) {
      const baseUnit = availableUnits.find(u => u.isBase) || availableUnits[0];
      setSelectedUnitId(baseUnit.unitId);
    }
  }, [availableUnits, selectedUnitId]);

  const handleToggleBatch = (batch: BatchInfo) => {
    setSelectedBatches((prev) => {
      const next = new Map(prev);
      if (next.has(batch.batchId)) {
        next.delete(batch.batchId);
      } else {
        next.set(batch.batchId, {
          batchId: batch.batchId,
          lotNumber: batch.lotNumber,
          expiryDate: batch.expiryDate,
          quantityInThisUnit: 0,
        });
      }
      return next;
    });
  };

  const _handleQuantityChange = (batchId: string, qty: number) => {
    setSelectedBatches((prev) => {
      const next = new Map(prev);
      const batch = next.get(batchId);
      if (batch) {
        batch.quantityInThisUnit = qty;
        next.set(batchId, batch);
      }
      return next;
    });
  };

  // Calculate total quantity from multi-unit inputs
  const totalQuantityFromUnits = Object.entries(unitQuantities).reduce((sum, [unitId, qty]) => {
    const unit = availableUnits.find(u => u.unitId === unitId);
    return sum + (qty * (unit?.multiplierToBase || 1));
  }, 0);

  // Legacy: total from batch selection (old single-unit mode)
  const _totalQuantity = Array.from(selectedBatches.values()).reduce(
    (sum, b) => sum + b.quantityInThisUnit,
    0
  );

  const handleAddToCart = () => {
    if (!product) return;

    if (totalQuantityFromUnits <= 0) {
      alert("กรุณาระบุจำนวนที่มากกว่า 0");
      return;
    }

    if (selectedBatches.size === 0) {
      alert("กรุณาเลือก LOT อย่างน้อย 1 รายการ");
      return;
    }

    // Use base unit as the primary unit for display
    const baseUnit = availableUnits.find(u => u.isBase) || availableUnits[0];
    if (!baseUnit) {
      alert("ไม่พบหน่วยฐานของสินค้า");
      return;
    }

    const afterBalance = calculateAfterBalance(
      product.quantityInBase,
      adjustmentType,
      totalQuantityFromUnits,
      1 // Already in base units
    );

    // Build display string from actual unit quantities entered
    const displayQuantity = Object.entries(unitQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([unitId, qty]) => {
        const unit = availableUnits.find(u => u.unitId === unitId);
        return `${qty} ${unit?.unitName}`;
      })
      .join(' ');

    const cartItem: AdjustmentCartItem = {
      id: crypto.randomUUID(),
      productId: product.productId,
      productCode: product.productCode,
      productName: product.productName,
      adjustmentType,
      unitId: baseUnit.unitId,
      unitName: displayQuantity, // Use multi-unit display instead of base unit name
      quantity: totalQuantityFromUnits,
      note,
      selectedBatches: Array.from(selectedBatches.values()),
      currentBalanceInBase: product.quantityInBase,
      afterBalanceInBase: afterBalance,
      displayBefore: product.displayText,
      displayAfter: smartDisplayStock(afterBalance, product.productId),
      multiplierToBase: 1, // Already in base units
    };

    onAddToCart(cartItem);

    // Reset form
    setAdjustmentType("add");
    setSelectedUnitId("");
    setNote("");
    setSelectedBatches(new Map());
    setUnitQuantities({});
    setMode("cart");
  };

  const getExpiryStatusColor = (status: string) => {
    switch (status) {
      case "ok":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "warning":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "critical":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "expired":
        return "bg-rose-100 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center md:p-4 bg-slate-900/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full h-full md:h-auto md:max-w-5xl md:max-h-[90vh] bg-white md:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border-0 md:border md:border-white/50"
      >
        {/* Modal Header - Glass & Gradient */}
        <div className="flex-shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />

          <div className="relative px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
              <div className="p-2 sm:p-2.5 md:p-3 bg-white/10 rounded-xl sm:rounded-2xl backdrop-blur-md border border-white/20 shadow-inner flex-shrink-0">
                {mode === "add" ? <Edit3 className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" /> : <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg md:text-2xl font-bold text-white tracking-tight truncate">
                  {mode === "add" ? "ปรับปรุงสต็อก" : "รายการในตะกร้า"}
                </h2>
                {mode === "add" && product && (
                  <div className="flex items-center gap-1 sm:gap-2 text-blue-50 mt-0.5 sm:mt-1 overflow-hidden">
                    <span className="opacity-80 text-[10px] sm:text-xs md:text-sm font-medium flex-shrink-0">{product.productCode}</span>
                    <span className="hidden sm:block w-1 h-1 rounded-full bg-blue-200/50 flex-shrink-0" />
                    <span className="opacity-90 text-[10px] sm:text-xs md:text-sm font-medium truncate">{product.productName}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
              {mode === "cart" && cart.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setMode("add")}
                  className="hidden sm:flex px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs sm:text-sm font-bold transition-colors backdrop-blur-sm border border-white/10"
                >
                  + เพิ่มรายการ
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm flex-shrink-0"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 relative">
          <AnimatePresence mode="wait">
            {mode === "add" && product ? (
              <motion.div
                key="add-mode"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6 space-y-8"
              >
                {/* 1. Adjustment Type Cards - Icon Only */}
                <div className="flex justify-center gap-3 sm:gap-4">
                  {[
                    { id: "add", label: "เพิ่มสต็อก", icon: Plus, color: "emerald", bgActive: "bg-emerald-500", bgHover: "hover:bg-emerald-50" },
                    { id: "reduce", label: "ลดสต็อก", icon: Minus, color: "rose", bgActive: "bg-rose-500", bgHover: "hover:bg-rose-50" },
                    { id: "set", label: "กำหนดใหม่", icon: Edit3, color: "blue", bgActive: "bg-blue-500", bgHover: "hover:bg-blue-50" },
                  ].map((type) => (
                    <motion.button
                      key={type.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setAdjustmentType(type.id as "add" | "reduce" | "set")}
                      className={`relative flex flex-col items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 transition-all duration-300 ${adjustmentType === type.id
                        ? `${type.bgActive} border-transparent text-white shadow-lg`
                        : `bg-white border-slate-200 text-slate-600 ${type.bgHover}`
                        }`}
                      title={type.label}
                    >
                      <type.icon className="h-8 w-8 sm:h-10 sm:w-10" />
                      <span className="text-[10px] sm:text-xs font-bold mt-1 hidden sm:block">
                        {type.id === "add" ? "เพิ่ม" : type.id === "reduce" ? "ลด" : "ตั้ง"}
                      </span>
                    </motion.button>
                  ))}
                </div>

                {/* Full Width: Batch Selection with Multi-Unit Input */}
                <div className="w-full">
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full min-h-[400px]">
                      <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Ticket className="h-5 w-5 text-blue-600" />
                          <h3 className="font-bold text-slate-800">เลือก LOT สินค้า</h3>
                        </div>
                        {selectedBatches.size > 0 && (
                          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                            เลือกแล้ว {selectedBatches.size} รายการ
                          </span>
                        )}
                      </div>

                      <div className="flex-1 p-3 sm:p-4 md:p-5 overflow-y-auto max-h-[400px] custom-scrollbar space-y-3">
                        {loadingBatches ? (
                          <div className="h-full flex flex-col items-center justify-center text-blue-500 py-10">
                            <RefreshCw className="h-8 w-8 animate-spin mb-4" />
                            <p className="font-medium">กำลังโหลดข้อมูล LOT...</p>
                          </div>
                        ) : batches.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                            <Box className="h-12 w-12 mb-4 opacity-50" />
                            <p className="font-medium">ไม่พบข้อมูล LOT</p>
                          </div>
                        ) : (
                          batches.map((batch: BatchInfo) => {
                            const isSelected = selectedBatches.has(batch.batchId);
                            const _selectedQty = selectedBatches.get(batch.batchId)?.quantityInThisUnit || 0;

                            return (
                              <motion.div
                                layout="position"
                                key={batch.batchId}
                                onClick={() => !isSelected && handleToggleBatch(batch)}
                                className={`relative group rounded-2xl border-2 transition-all cursor-pointer ${isSelected
                                  ? "border-blue-500 bg-blue-50/30 shadow-md ring-2 ring-blue-100"
                                  : "border-slate-100 bg-white hover:border-blue-300 hover:shadow-sm"
                                  }`}
                              >
                                {/* Ticket Perforation Effect (Visual) */}
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-50 border border-slate-200" />
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 rounded-full bg-slate-50 border border-slate-200" />

                                <div className="p-3 sm:p-4 pl-4 sm:pl-6 pr-4 sm:pr-6">
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className="font-mono font-bold text-xs sm:text-sm text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md flex-shrink-0">
                                          {batch.lotNumber}
                                        </span>
                                        <div className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md border text-[9px] sm:text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${getExpiryStatusColor(batch.expiryStatus)}`}>
                                          <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                          <span className="truncate">{new Date(batch.expiryDate).toLocaleDateString("th-TH")}</span>
                                        </div>
                                      </div>
                                      <div className="text-xs sm:text-sm text-slate-500 font-medium">
                                        คงเหลือ: <span className="text-slate-900 font-bold">{smartDisplayStock(batch.quantityInBase, product.productId)}</span>
                                      </div>
                                    </div>

                                    <div onClick={(e) => { e.stopPropagation(); handleToggleBatch(batch); }} className="flex-shrink-0 self-start sm:self-center">
                                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "bg-blue-500 border-blue-500" : "bg-white border-slate-300 group-hover:border-blue-400"
                                        }`}>
                                        {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
                                      </div>
                                    </div>
                                  </div>

                                  <AnimatePresence>
                                    {isSelected && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="pt-3 sm:pt-4 mt-3 sm:mt-4 pl-2 pr-6 border-t border-blue-200/50">
                                          <label className="block text-xs font-bold text-blue-800 mb-3">
                                            ปรับจำนวนสินค้า (หลายหน่วย):
                                          </label>

                                          {/* Mobile: Tabs */}
                                          <div className="lg:hidden">
                                            <div className="flex gap-1 mb-2 overflow-x-auto">
                                              {availableUnits.map((unit) => (
                                                <button
                                                  key={unit.unitId}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedUnitId(unit.unitId);
                                                  }}
                                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${selectedUnitId === unit.unitId
                                                    ? "bg-blue-500 text-white"
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                    }`}
                                                >
                                                  {unit.unitName}
                                                </button>
                                              ))}
                                            </div>

                                            {/* Selected unit controls */}
                                            {selectedUnitId && (() => {
                                              const selectedUnit = availableUnits.find(u => u.unitId === selectedUnitId);
                                              if (!selectedUnit) return null;
                                              return (
                                                <div className="flex items-center gap-2 bg-white rounded-lg border border-blue-200 p-2">
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const current = unitQuantities[selectedUnitId] || 0;
                                                      if (current > 0) {
                                                        setUnitQuantities({ ...unitQuantities, [selectedUnitId]: current - 1 });
                                                      }
                                                    }}
                                                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors"
                                                  >
                                                    <Minus className="h-4 w-4" />
                                                  </button>

                                                  <div className="flex-1 text-center">
                                                    <input
                                                      type="number"
                                                      min="0"
                                                      value={unitQuantities[selectedUnitId] || ""}
                                                      onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        setUnitQuantities({ ...unitQuantities, [selectedUnitId]: val });
                                                      }}
                                                      onClick={(e) => e.stopPropagation()}
                                                      placeholder="0"
                                                      className="w-full text-center text-base font-bold bg-transparent outline-none text-blue-600"
                                                    />
                                                    <p className="text-[9px] text-slate-400 font-medium">{selectedUnit.unitName}</p>
                                                  </div>

                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const current = unitQuantities[selectedUnitId] || 0;
                                                      setUnitQuantities({ ...unitQuantities, [selectedUnitId]: current + 1 });
                                                    }}
                                                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 transition-colors"
                                                  >
                                                    <Plus className="h-4 w-4" />
                                                  </button>
                                                </div>
                                              );
                                            })()}
                                          </div>

                                          {/* Desktop: All Units in One Row - Equal Width */}
                                          <div className="hidden lg:grid gap-1" style={{ gridTemplateColumns: `repeat(${availableUnits.length}, 1fr)` }}>
                                            {availableUnits.map((unit) => (
                                              <div key={unit.unitId} className="flex flex-col items-center gap-0.5 bg-white rounded-md border border-blue-200 p-1">
                                                <span className="text-[10px] font-bold text-slate-700 whitespace-nowrap">{unit.unitName}</span>

                                                <div className="flex items-center gap-0.5 w-full">
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const current = unitQuantities[unit.unitId] || 0;
                                                      if (current > 0) {
                                                        setUnitQuantities({ ...unitQuantities, [unit.unitId]: current - 1 });
                                                      }
                                                    }}
                                                    className="h-6 w-6 flex items-center justify-center rounded bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors flex-shrink-0"
                                                  >
                                                    <Minus className="h-2.5 w-2.5" />
                                                  </button>

                                                  <input
                                                    type="number"
                                                    min="0"
                                                    value={unitQuantities[unit.unitId] || ""}
                                                    onChange={(e) => {
                                                      const val = parseInt(e.target.value) || 0;
                                                      setUnitQuantities({ ...unitQuantities, [unit.unitId]: val });
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    placeholder="0"
                                                    className="flex-1 text-center text-xs font-bold bg-white rounded border border-blue-200 outline-none text-blue-600 px-0.5 py-0.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                                                  />

                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const current = unitQuantities[unit.unitId] || 0;
                                                      setUnitQuantities({ ...unitQuantities, [unit.unitId]: current + 1 });
                                                    }}
                                                    className="h-6 w-6 flex items-center justify-center rounded bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 transition-colors flex-shrink-0"
                                                  >
                                                    <Plus className="h-2.5 w-2.5" />
                                                  </button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>

                                          {/* Summary */}
                                          {totalQuantityFromUnits > 0 && (
                                            <div className="mt-3 p-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                                              <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">รวม:</span>
                                                <span className="text-sm font-bold text-blue-900">{totalQuantityFromUnits} (หน่วยฐาน)</span>
                                              </div>
                                              <p className="text-[9px] text-blue-600 mt-0.5">
                                                {Object.entries(unitQuantities)
                                                  .filter(([_, qty]) => qty > 0)
                                                  .map(([unitId, qty]) => {
                                                    const unit = availableUnits.find(u => u.unitId === unitId);
                                                    return `${qty} ${unit?.unitName}`;
                                                  })
                                                  .join(' + ')}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </motion.div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Note Section */}
                    <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 mt-4">
                      <label className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-cyan-500" />
                        หมายเหตุ
                      </label>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        placeholder="ระบุสาเหตุการปรับสต็อก..."
                        className="w-full rounded-xl border-2 border-slate-100 bg-slate-50/50 px-4 py-3 text-slate-700 font-medium focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all outline-none resize-none text-sm"
                      />
                    </div>
                  </div> {/* Close w-full div */}
              </motion.div>
            ) : (
              /* Cart Mode - Receipt Style */
              <motion.div
                key="cart-mode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6"
              >
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                      <ShoppingCart className="h-10 w-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-600 mb-2">ตะกร้าว่างเปล่า</h3>
                    <p className="text-slate-400">ยังไม่มีรายการปรับสต็อกที่เลือก</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item, index) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        key={item.id}
                        className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="flex">
                          {/* Color Strip */}
                          <div className={`w-2 ${item.adjustmentType === "add" ? "bg-emerald-500" :
                            item.adjustmentType === "reduce" ? "bg-rose-500" :
                              "bg-blue-500"
                            }`} />

                          <div className="flex-1 p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${item.adjustmentType === "add" ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
                                    item.adjustmentType === "reduce" ? "bg-rose-50 border-rose-100 text-rose-700" :
                                      "bg-blue-50 border-blue-100 text-blue-700"
                                    }`}>
                                    {item.adjustmentType === "add" ? "เพิ่มสต็อก" : item.adjustmentType === "reduce" ? "ลดสต็อก" : "กำหนดค่า"}
                                  </span>
                                  <span className="text-xs font-mono text-slate-400">{item.productCode}</span>
                                </div>
                                <h4 className="font-bold text-slate-800 text-lg">{item.productName}</h4>
                              </div>
                              <button
                                onClick={() => onRemoveFromCart(item.id)}
                                className="p-2 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>

                            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl">
                              <div className="flex-1">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">จำนวนที่ปรับ</p>
                                <p className="text-base font-bold text-slate-800">
                                  {item.unitName}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  ({item.quantity.toLocaleString()} หน่วยฐาน)
                                </p>
                              </div>
                              <div className="w-px h-8 bg-slate-200" />
                              <div className="flex-1">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">ผลลัพธ์</p>
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <span className="text-slate-400 line-through">{item.displayBefore}</span>
                                  <ArrowRight className="h-3 w-3 text-slate-300" />
                                  <span className={`font-bold ${item.adjustmentType === "add" ? "text-emerald-600" :
                                    item.adjustmentType === "reduce" ? "text-rose-600" :
                                      "text-blue-600"
                                    }`}>
                                    {item.displayAfter}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal Footer (Fixed) */}
        <div className="flex-shrink-0 p-6 bg-white border-t border-slate-100 z-10">
          {mode === "add" ? (
            <div className="flex items-center justify-between gap-6">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ยอดรวมที่เลือก</span>
                <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-cyan-600">
                  {totalQuantityFromUnits.toLocaleString()}
                </span>
                {totalQuantityFromUnits > 0 && (
                  <span className="text-xs text-slate-500 mt-1">
                    {Object.entries(unitQuantities)
                      .filter(([_, qty]) => qty > 0)
                      .map(([unitId, qty]) => {
                        const unit = availableUnits.find(u => u.unitId === unitId);
                        return `${qty} ${unit?.unitName}`;
                      })
                      .join(' + ')}
                  </span>
                )}
              </div>
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.4)" }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddToCart}
                disabled={totalQuantityFromUnits <= 0 || selectedBatches.size === 0}
                className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-lg shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Plus className="h-6 w-6" />
                เพิ่มลงตะกร้า
              </motion.button>
            </div>
          ) : (
            <div className="flex gap-4">
              <button
                onClick={onClearCart}
                className="px-6 py-4 rounded-2xl border-2 border-slate-100 text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-200 transition-colors"
              >
                ล้างรายการ
              </button>
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.4)" }}
                whileTap={{ scale: 0.98 }}
                onClick={onSubmit}
                disabled={submitMutation.isPending || cart.length === 0}
                className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-lg shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {submitMutation.isPending ? (
                  <RefreshCw className="h-6 w-6 animate-spin" />
                ) : (
                  <Save className="h-6 w-6" />
                )}
                บันทึกการปรับสต็อก ({cart.length})
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
