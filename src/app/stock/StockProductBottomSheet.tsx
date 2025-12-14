"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { X, Plus, Minus, Check, Search, Package, Layers, Zap, Smile } from "lucide-react";
import Image from "next/image";

type ProductUnit = {
  unitId: string;
  unitName: string;
  assignmentUnitId: string;
  multiplierToBase: number;
};

type Product = {
  productId: string;
  productCode: string;
  productName: string;
  companyId: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  assignmentId: string;
  units: ProductUnit[];
};

type StockInventoryItem = {
  productId: string;
  productCode: string;
  productName: string;
  quantityInBase: number;
  displayText: string;
  displayUnits: Array<{
    unitId: string;
    unitName: string;
    count: number;
    multiplier: number;
  }>;
  updatedAt: string;
};

type TransactionType = "receive" | "return" | "initial";

type StockProductBottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  stockInventory?: StockInventoryItem[];
  transactionType?: TransactionType;
  onAdd: (items: Array<{ assignmentId: string; unitQuantities: Record<string, number> }>) => void;
  title: string;
  actionLabel: string;
  recordingMode?: "quick" | "elderly";
  onModeChange?: (mode: "quick" | "elderly") => void;
  // ✅ For editing existing cart items (แบบเดียวกับ Sales page)
  editingData?: {
    assignmentId: string;
    unitQuantities: Record<string, number>;
  } | null;
};

export default function StockProductBottomSheet({
  isOpen,
  onClose,
  products,
  stockInventory = [],
  transactionType = "receive",
  onAdd,
  title,
  actionLabel,
  recordingMode = "quick",
  onModeChange,
  editingData = null,
}: StockProductBottomSheetProps) {
  console.log('[BottomSheet] Component rendered with props:', {
    isOpen,
    editingData,
    productsCount: products.length
  });

  // Multi-select state
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string>("");
  const [multiUnitQuantities, setMultiUnitQuantities] = useState<Record<string, Record<string, string>>>({});
  const [productSearch, setProductSearch] = useState("");
  const [_openDropdown, _setOpenDropdown] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.assignmentId === activeAssignmentId);
  const selectedProducts = products.filter((p) => selectedAssignmentIds.includes(p.assignmentId));

  // ✅ Debug log
  useEffect(() => {
    console.log('[BottomSheet] State changed:');
    console.log('  - activeAssignmentId:', activeAssignmentId);
    console.log('  - selectedProduct:', selectedProduct ? selectedProduct.productName : '❌ NOT FOUND');
    console.log('  - selectedProduct exists?', !!selectedProduct);
    console.log('  - products.length:', products.length);

    if (!selectedProduct && activeAssignmentId) {
      console.error('⚠️ PROBLEM: activeAssignmentId is set but selectedProduct NOT FOUND!');
      console.log('Looking for assignmentId:', activeAssignmentId);
      console.log('Available assignmentIds:', products.map(p => ({
        assignmentId: p.assignmentId,
        productCode: p.productCode
      })));
    }
  }, [activeAssignmentId, selectedProduct, products]);

  // Helper function to get stock balance for a product unit
  const getStockBalance = useCallback(
    (productId: string, unitId: string, multiplierToBase: number): number | null => {
      const inventoryItem = stockInventory.find((item) => item.productId === productId);
      if (!inventoryItem) return null;

      // Convert base quantity to this unit
      const balanceInUnit = Math.floor(inventoryItem.quantityInBase / multiplierToBase);
      return balanceInUnit;
    },
    [stockInventory]
  );

  // ✅ Pre-fill when editing (แบบเดียวกับ Sales page)
  useEffect(() => {
    console.log('[BottomSheet] Pre-fill effect triggered', {
      isOpen,
      editingData
    });

    if (isOpen && editingData) {
      console.log('[BottomSheet] Pre-filling form with editingData:', editingData);

      // Set selected products
      setSelectedAssignmentIds([editingData.assignmentId]);
      // Set active product (this shows the quantity form)
      setActiveAssignmentId(editingData.assignmentId);

      // Convert number quantities to string for the form
      const stringQuantities: Record<string, string> = {};
      Object.entries(editingData.unitQuantities).forEach(([unitId, qty]) => {
        stringQuantities[unitId] = qty.toString();
      });
      setMultiUnitQuantities({ [editingData.assignmentId]: stringQuantities });

      console.log('[BottomSheet] Pre-fill complete:', {
        selectedAssignmentIds: [editingData.assignmentId],
        activeAssignmentId: editingData.assignmentId,
        stringQuantities
      });
    }
  }, [isOpen, editingData]);

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      console.log('[BottomSheet] Closing - resetting form');
      setSelectedAssignmentIds([]);
      setActiveAssignmentId("");
      setMultiUnitQuantities({});
      setProductSearch("");
      _setOpenDropdown(null);
    }
  }, [isOpen]);

  // Handle product checkbox toggle
  const handleToggleProduct = (assignmentId: string) => {
    // ✅ Don't allow changing selection in edit mode (แบบเดียวกับ Sales page)
    if (editingData) {
      console.log('[BottomSheet] Blocked toggle - in edit mode');
      return;
    }

    setSelectedAssignmentIds((prev) => {
      if (prev.includes(assignmentId)) {
        const newList = prev.filter((id) => id !== assignmentId);
        if (activeAssignmentId === assignmentId) {
          setActiveAssignmentId(newList[0] || "");
        }
        setMultiUnitQuantities((prevQty) => {
          const newQty = { ...prevQty };
          delete newQty[assignmentId];
          return newQty;
        });
        return newList;
      } else {
        const newList = [...prev, assignmentId];
        setActiveAssignmentId(assignmentId);
        return newList;
      }
    });
  };

  const handleQuantityChange = (assignmentUnitId: string, value: string) => {
    if (!activeAssignmentId) return;
    setMultiUnitQuantities((prev) => ({
      ...prev,
      [activeAssignmentId]: {
        ...(prev[activeAssignmentId] || {}),
        [assignmentUnitId]: value,
      },
    }));
  };

  const incrementQuantity = (assignmentUnitId: string) => {
    if (!activeAssignmentId) return;
    const currentQty = multiUnitQuantities[activeAssignmentId]?.[assignmentUnitId] || "0";
    const current = parseInt(currentQty, 10);
    setMultiUnitQuantities((prev) => ({
      ...prev,
      [activeAssignmentId]: {
        ...(prev[activeAssignmentId] || {}),
        [assignmentUnitId]: String(current + 1),
      },
    }));
  };

  const decrementQuantity = (assignmentUnitId: string) => {
    if (!activeAssignmentId) return;
    const currentQty = multiUnitQuantities[activeAssignmentId]?.[assignmentUnitId] || "0";
    const current = parseInt(currentQty, 10);
    if (current > 0) {
      setMultiUnitQuantities((prev) => ({
        ...prev,
        [activeAssignmentId]: {
          ...(prev[activeAssignmentId] || {}),
          [assignmentUnitId]: String(current - 1),
        },
      }));
    }
  };

  const hasQuantity = () => {
    return selectedAssignmentIds.some((assignmentId) => {
      const quantities = multiUnitQuantities[assignmentId] || {};
      return Object.values(quantities).some((qty) => parseInt(qty || "0", 10) > 0);
    });
  };

  const handleSubmit = () => {
    const itemsToAdd: Array<{ assignmentId: string; unitQuantities: Record<string, number> }> = [];

    for (const assignmentId of selectedAssignmentIds) {
      const quantities = multiUnitQuantities[assignmentId] || {};
      const numericQuantities: Record<string, number> = {};

      Object.entries(quantities).forEach(([unitId, qtyStr]) => {
        const qty = parseInt(qtyStr || "0", 10);
        if (qty > 0) {
          numericQuantities[unitId] = qty;
        }
      });

      if (Object.keys(numericQuantities).length > 0) {
        itemsToAdd.push({
          assignmentId,
          unitQuantities: numericQuantities,
        });
      }
    }

    if (itemsToAdd.length === 0) return;

    onAdd(itemsToAdd);
    onClose();
  };

  // Filtered products based on search
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;

    const query = productSearch.trim().toLowerCase();
    return products.filter(
      (product) =>
        product.productName.toLowerCase().includes(query) ||
        product.productCode.toLowerCase().includes(query) ||
        product.companyName?.toLowerCase().includes(query)
    );
  }, [products, productSearch]);

  // Helper function to highlight search match
  const highlightMatch = useCallback((text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 font-semibold rounded px-0.5">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom Sheet Modal */}
      <div className="fixed inset-0 z-[120] flex flex-col overflow-hidden bg-white md:inset-x-auto md:inset-y-0 md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[calc(100%-2rem)] md:max-w-6xl md:h-[90vh] md:max-h-[90vh] md:rounded-[32px] md:border md:border-white/70 md:shadow-[0_20px_100px_-40px_rgba(37,99,235,0.7)]">

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-100 px-3 sm:px-4 md:px-6 pb-4 pt-safe pt-4 bg-gradient-to-r from-blue-50/50 via-white to-sky-50/50">
          <div>
            <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent">
              {title}
            </h2>
            <p className="text-xs text-slate-500">เลือกสินค้าและกรอกจำนวน (เลือกได้หลายรายการ)</p>
          </div>
          <div className="flex items-center gap-2">
            {onModeChange && (
              <div className="flex items-center gap-1 bg-white rounded-full p-1 shadow-md border border-slate-200">
                <button
                  type="button"
                  onClick={() => onModeChange("quick")}
                  title="โหมดเร็ว"
                  className={`relative flex items-center justify-center h-9 w-9 rounded-full transition-all duration-300 ${
                    recordingMode === "quick"
                      ? "bg-gradient-to-br from-blue-500 to-sky-500 text-white shadow-lg scale-110"
                      : "text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                  }`}
                >
                  <Zap className="h-4 w-4" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange("elderly")}
                  title="โหมดง่าย"
                  className={`relative flex items-center justify-center h-9 w-9 rounded-full transition-all duration-300 ${
                    recordingMode === "elderly"
                      ? "bg-gradient-to-br from-blue-500 to-sky-500 text-white shadow-lg scale-110"
                      : "text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                  }`}
                >
                  <Smile className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 transition hover:bg-red-200 hover:scale-105 active:scale-95 shadow-sm"
              aria-label="ปิด"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content - 2 Column Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

          {/* LEFT COLUMN: Product List */}
          <div className="flex-1 md:w-1/2 md:border-r md:border-slate-200 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 bg-gradient-to-br from-slate-50/30 via-white to-blue-50/20">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                เลือกสินค้า (เลือกได้หลายรายการ)
              </label>

              {/* Desktop: Search + Checkbox Cards */}
              <div className="space-y-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="ค้นหาสินค้า รหัส หรือบริษัท..."
                    className="w-full rounded-xl border-2 border-blue-200/60 bg-white py-3 pl-10 pr-10 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>

                {/* Results Counter */}
                {productSearch && (
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                      {filteredProducts.length}
                    </span>
                    แสดง {filteredProducts.length.toLocaleString('th-TH')} จาก {products.length.toLocaleString('th-TH')} รายการ
                  </p>
                )}

                {/* Product Checkbox Cards */}
                <div className="max-h-[500px] md:max-h-[calc(90vh-300px)] space-y-2 overflow-y-auto rounded-xl border-2 border-blue-100/60 bg-gradient-to-br from-white to-slate-50/50 p-2 sm:p-3 shadow-inner">
                  {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Package className="mb-3 h-12 w-12 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">
                        ไม่พบสินค้า
                      </p>
                      {productSearch && (
                        <p className="mt-1 text-xs text-slate-500">
                          ลองค้นหาด้วยคำอื่น
                        </p>
                      )}
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <label
                        key={product.assignmentId}
                        className={`group flex cursor-pointer items-start gap-2.5 sm:gap-3 rounded-xl border-2 bg-white p-2.5 sm:p-3 transition-all duration-200 hover:border-blue-400 hover:shadow-lg ${
                          selectedAssignmentIds.includes(product.assignmentId)
                            ? 'border-blue-500 bg-gradient-to-br from-blue-50 via-white to-sky-50/50 shadow-lg ring-2 ring-blue-200'
                            : 'border-blue-100/60'
                        }`}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedAssignmentIds.includes(product.assignmentId)}
                          onChange={() => handleToggleProduct(product.assignmentId)}
                          className="mt-1 h-5 w-5 flex-shrink-0 cursor-pointer text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />

                        {/* Company Logo */}
                        <div className="flex-shrink-0">
                          {product.companyLogoUrl ? (
                            <div className="relative h-11 w-11 sm:h-12 sm:w-12 overflow-hidden bg-transparent">
                              <Image
                                src={product.companyLogoUrl}
                                alt={product.companyName || 'Company logo'}
                                fill
                                className="object-contain mix-blend-multiply"
                                sizes="(max-width: 640px) 44px, 48px"
                                loading="lazy"
                                placeholder="empty"
                              />
                            </div>
                          ) : (
                            <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-100 to-sky-100 group-hover:from-blue-200 group-hover:to-sky-200 transition-all">
                              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-blue-900 text-xs sm:text-sm leading-tight">
                            {highlightMatch(product.productCode, productSearch)}
                          </p>
                          <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 line-clamp-2">
                            {highlightMatch(product.productName, productSearch)}
                          </p>
                          {product.companyName && (
                            <p className="mt-1 inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 sm:px-2 py-0.5 rounded-full">
                              {highlightMatch(product.companyName, productSearch)}
                            </p>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Quantity Form */}
          <div className="flex-1 md:w-1/2 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 bg-gradient-to-br from-white via-blue-50/10 to-sky-50/20">

            {/* Product Tabs */}
            {selectedProducts.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2 pb-3 border-b border-blue-100">
                {selectedProducts.map((prod) => (
                  <button
                    key={prod.assignmentId}
                    type="button"
                    onClick={() => setActiveAssignmentId(prod.assignmentId)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      activeAssignmentId === prod.assignmentId
                        ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {prod.companyLogoUrl && (
                      <div className="relative h-5 w-5 flex-shrink-0 overflow-hidden bg-transparent">
                        <Image
                          src={prod.companyLogoUrl}
                          alt={prod.companyName || 'Logo'}
                          fill
                          className="object-contain mix-blend-multiply"
                          sizes="20px"
                          loading="lazy"
                          placeholder="empty"
                        />
                      </div>
                    )}
                    <span className="truncate max-w-[120px]">{prod.productCode}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Unit Inputs */}
            {(() => {
              console.log('[BottomSheet] Rendering RIGHT column:');
              console.log('  - selectedProduct:', selectedProduct ? selectedProduct.productName : '❌ NOT FOUND');
              console.log('  - activeAssignmentId:', activeAssignmentId);
              console.log('  - Will show form?', !!selectedProduct && selectedProduct.units.length > 0);
              return null;
            })()}
            {selectedProduct && selectedProduct.units.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-600" />
                    กรอกจำนวน
                  </p>
                  {/* Show Product Code & Name */}
                  <div className="text-right">
                    <p className="text-xs font-semibold text-blue-600">รหัส: {selectedProduct.productCode}</p>
                    <p className="text-sm font-bold text-slate-900">{selectedProduct.productName}</p>
                  </div>
                </div>

                {selectedProduct.units.map((unit) => {
                  const quantities = multiUnitQuantities[activeAssignmentId] || {};
                  const quantity = parseInt(quantities[unit.assignmentUnitId] || "0", 10);
                  const stockBalance = getStockBalance(selectedProduct.productId, unit.unitId, unit.multiplierToBase);
                  const exceedsStock = transactionType === "return" && stockBalance !== null && quantity > stockBalance;

                  // Determine border/bg color based on transaction type
                  let borderColorClass = "";
                  let bgColorClass = "";

                  if (transactionType === "return") {
                    // Return: Show warning colors (red/amber/green)
                    if (exceedsStock || stockBalance === 0) {
                      borderColorClass = "border-rose-400";
                      bgColorClass = "bg-gradient-to-br from-rose-50 via-white to-red-50/50";
                    } else if (stockBalance !== null && stockBalance <= 10) {
                      borderColorClass = "border-amber-400";
                      bgColorClass = "bg-gradient-to-br from-amber-50 via-white to-orange-50/50";
                    } else if (stockBalance !== null) {
                      borderColorClass = "border-emerald-400";
                      bgColorClass = "bg-gradient-to-br from-emerald-50 via-white to-teal-50/50";
                    } else {
                      borderColorClass = "border-blue-200";
                      bgColorClass = "bg-gradient-to-br from-blue-50/30 via-white to-slate-50";
                    }
                  } else if (transactionType === "initial") {
                    // Initial: Show warning if stock exists
                    if (stockBalance !== null && stockBalance > 0) {
                      borderColorClass = "border-orange-400";
                      bgColorClass = "bg-gradient-to-br from-orange-50 via-white to-amber-50/50";
                    } else {
                      borderColorClass = "border-blue-200";
                      bgColorClass = "bg-gradient-to-br from-blue-50/30 via-white to-slate-50";
                    }
                  } else {
                    // Receive: Neutral blue (informational only)
                    borderColorClass = "border-blue-300";
                    bgColorClass = "bg-gradient-to-br from-blue-50/50 via-white to-sky-50/30";
                  }

                  return (
                    <div
                      key={`${activeAssignmentId}-${unit.assignmentUnitId}`}
                      className={`rounded-2xl border-2 p-4 shadow-sm transition-all duration-200 hover:shadow-lg ${borderColorClass} ${bgColorClass}`}
                    >
                      <div className="mb-3">
                        <p className="font-semibold text-slate-900">{unit.unitName}</p>
                        {stockBalance !== null && (
                          <div className="mt-2 space-y-1.5">
                            {/* Smart Display - แสดงสต็อกรวม */}
                            <div className="flex flex-wrap items-center gap-1.5 max-w-full">
                              <Package className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                              <span className="text-xs text-slate-600 flex-shrink-0">รวม:</span>
                              <span className="text-xs font-semibold text-blue-600 break-words">
                                {(() => {
                                  const inventoryItem = stockInventory.find((s) => s.productId === selectedProduct.productId);
                                  return inventoryItem?.displayText || "0";
                                })()}
                              </span>
                            </div>

                            {/* Transaction-specific display */}
                            {transactionType === "return" && (
                              <div
                                className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-white shadow-md max-w-full ${
                                  exceedsStock || stockBalance === 0
                                    ? "bg-gradient-to-r from-rose-500 to-red-500"
                                    : stockBalance <= 10
                                    ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                    : "bg-gradient-to-r from-emerald-500 to-teal-500"
                                }`}
                              >
                                <Layers className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="text-xs sm:text-sm font-bold break-words">
                                  {stockBalance === 0
                                    ? "สต็อกหมด"
                                    : exceedsStock
                                    ? `เกินสต็อก (เลือกได้ ${stockBalance.toLocaleString("th-TH")})`
                                    : `เลือกได้: สูงสุด ${stockBalance.toLocaleString("th-TH")} ${unit.unitName}`}
                                </span>
                              </div>
                            )}

                            {transactionType === "receive" && (
                              <div className="flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-blue-500 to-sky-500 text-white shadow-md max-w-full">
                                <Layers className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="text-xs sm:text-sm font-bold break-words">
                                  คงเหลือ: {stockBalance.toLocaleString("th-TH")} {unit.unitName}
                                </span>
                              </div>
                            )}

                            {transactionType === "initial" && (
                              <>
                                {stockBalance > 0 ? (
                                  <div className="flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md max-w-full">
                                    <Layers className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="text-xs sm:text-sm font-bold break-words">
                                      ⚠️ มีสต็อกอยู่แล้ว: {stockBalance.toLocaleString("th-TH")} {unit.unitName}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-blue-500 to-sky-500 text-white shadow-md max-w-full">
                                    <Layers className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="text-xs sm:text-sm font-bold">
                                      พร้อมตั้งค่าสต็อกเริ่มต้น
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quantity Input */}
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                          type="button"
                          onClick={() => decrementQuantity(unit.assignmentUnitId)}
                          className="flex h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-600 shadow-sm transition-all duration-200 hover:border-red-400 hover:bg-red-50 hover:text-red-600 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                          disabled={quantity === 0}
                        >
                          <Minus className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={quantities[unit.assignmentUnitId] || ""}
                          onChange={(e) => handleQuantityChange(unit.assignmentUnitId, e.target.value)}
                          placeholder="0"
                          className="h-10 sm:h-11 flex-1 min-w-0 rounded-xl border-2 border-blue-200 bg-white px-2 sm:px-4 text-center text-base sm:text-lg font-bold text-blue-900 shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-blue-50/30"
                        />
                        <button
                          type="button"
                          onClick={() => incrementQuantity(unit.assignmentUnitId)}
                          disabled={transactionType === "return" && stockBalance !== null && quantity >= stockBalance}
                          className="flex h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 items-center justify-center rounded-xl border-2 border-blue-600 bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-sky-600 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                        >
                          <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Empty state
              <div className="flex h-full min-h-[400px] items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-sky-100 shadow-lg">
                    <Package className="h-12 w-12 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-800">เลือกสินค้าเพื่อเริ่มกรอกจำนวน</p>
                    <p className="mt-2 text-sm text-slate-500">✓ เลือกได้หลายรายการพร้อมกัน</p>
                    <p className="text-sm text-slate-500">✓ กรอกจำนวนทีละสินค้า</p>
                    <p className="text-sm text-slate-500">✓ กด &ldquo;{actionLabel}&rdquo; เมื่อเสร็จ</p>
                  </div>
                  <div className="hidden md:block animate-pulse">
                    <svg className="mx-auto h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-gradient-to-r from-blue-50/90 via-white to-sky-50/90 px-4 sm:px-6 py-4 pb-safe shadow-[0_-10px_40px_-20px_rgba(37,99,235,0.3)]">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border-2 border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-400 hover:bg-slate-50 hover:scale-[1.02] active:scale-95"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedAssignmentIds.length === 0 || !hasQuantity()}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 px-6 py-3.5 font-bold text-white shadow-lg transition-all duration-200 hover:from-blue-700 hover:via-sky-600 hover:to-indigo-700 hover:scale-[1.02] hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              <Check className="h-5 w-5" />
              {actionLabel}
              {selectedAssignmentIds.length > 0 && (
                <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/30 text-xs">
                  {selectedAssignmentIds.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
