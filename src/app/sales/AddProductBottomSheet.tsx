"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { X, Plus, Minus, ShoppingCart, Trash2, Check, Search, Package, Layers, Zap, Smile } from "lucide-react";
import Image from "next/image";

type ProductUnitOption = {
  assignmentUnitId: string;
  unitId: string;
  unitName: string;
  pricePc: number;
  multiplierToBase: number;
};

type ProductOption = {
  assignmentId: string;
  productId: string;
  productCode: string;
  productName: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  units: ProductUnitOption[];
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

type CartItem = {
  assignmentId: string;
  unitQuantities: Record<string, string>;
  product: ProductOption;
};

type AddProductBottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  products: ProductOption[];
  stockInventory: StockInventoryItem[];
  onAdd: (assignmentId: string, unitQuantities: Record<string, string>) => void;
  editingData?: {
    assignmentId: string;
    unitQuantities: Record<string, string>;
  } | null;
  recordingMode?: "quick" | "elderly";
  onModeChange?: (mode: "quick" | "elderly") => void;
};

export default function AddProductBottomSheet({
  isOpen,
  onClose,
  products,
  stockInventory,
  onAdd,
  editingData = null,
  recordingMode = "quick",
  onModeChange,
}: AddProductBottomSheetProps) {
  // Multi-select state
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string>(""); // For tab navigation
  const [multiUnitQuantities, setMultiUnitQuantities] = useState<Record<string, Record<string, string>>>({});

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const selectedProduct = products.find((p) => p.assignmentId === activeAssignmentId);
  const selectedProducts = products.filter((p) => selectedAssignmentIds.includes(p.assignmentId));

  // Debug: Log products with company info
  useEffect(() => {
    if (products.length > 0) {
      console.log('[AddProductBottomSheet] Products loaded:', products.length);
      const withLogo = products.filter(p => p.companyLogoUrl);
      console.log('[AddProductBottomSheet] Products with logo:', withLogo.length);
      if (withLogo.length > 0) {
        console.log('[AddProductBottomSheet] First product with logo:', {
          code: withLogo[0].productCode,
          companyName: withLogo[0].companyName,
          logoUrl: withLogo[0].companyLogoUrl
        });
      }
    }
  }, [products]);

  // Preset data when editing
  useEffect(() => {
    if (isOpen && editingData) {
      setSelectedAssignmentIds([editingData.assignmentId]);
      setActiveAssignmentId(editingData.assignmentId);
      setMultiUnitQuantities({
        [editingData.assignmentId]: editingData.unitQuantities
      });
      setShowCart(false);
    }
  }, [isOpen, editingData]);

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedAssignmentIds([]);
      setActiveAssignmentId("");
      setMultiUnitQuantities({});
      setCartItems([]);
      setShowCart(false);
      setProductSearch("");
    }
  }, [isOpen]);

  // Handle product checkbox toggle
  const handleToggleProduct = useCallback((assignmentId: string) => {
    if (editingData) return; // Don't allow changing selection in edit mode

    setSelectedAssignmentIds((prev) => {
      if (prev.includes(assignmentId)) {
        // Unselect: remove from list
        const newList = prev.filter(id => id !== assignmentId);
        // If this was the active tab, switch to another or clear
        if (activeAssignmentId === assignmentId) {
          setActiveAssignmentId(newList[0] || "");
        }
        // Remove quantities for this product
        setMultiUnitQuantities((prevQty) => {
          const newQty = { ...prevQty };
          delete newQty[assignmentId];
          return newQty;
        });
        return newList;
      } else {
        // Select: add to list
        const newList = [...prev, assignmentId];
        // Auto-switch to this product's tab
        setActiveAssignmentId(assignmentId);
        return newList;
      }
    });
  }, [editingData, activeAssignmentId]);

  const handleQuantityChange = useCallback((assignmentUnitId: string, value: string) => {
    if (!activeAssignmentId) return;
    setMultiUnitQuantities((prev) => ({
      ...prev,
      [activeAssignmentId]: {
        ...(prev[activeAssignmentId] || {}),
        [assignmentUnitId]: value,
      },
    }));
  }, [activeAssignmentId]);

  const incrementQuantity = useCallback((assignmentUnitId: string) => {
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
  }, [activeAssignmentId, multiUnitQuantities]);

  const decrementQuantity = useCallback((assignmentUnitId: string) => {
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
  }, [activeAssignmentId, multiUnitQuantities]);

  const calculateSubtotal = useCallback(() => {
    if (!selectedProduct || !activeAssignmentId) return 0;
    let total = 0;
    const quantities = multiUnitQuantities[activeAssignmentId] || {};
    selectedProduct.units.forEach((unit) => {
      const qty = parseInt(quantities[unit.assignmentUnitId] || "0", 10);
      total += qty * unit.pricePc;
    });
    return total;
  }, [selectedProduct, activeAssignmentId, multiUnitQuantities]);

  const hasQuantity = useCallback(() => {
    if (!activeAssignmentId) return false;
    const quantities = multiUnitQuantities[activeAssignmentId] || {};
    return Object.values(quantities).some((qty) => parseInt(qty || "0", 10) > 0);
  }, [activeAssignmentId, multiUnitQuantities]);

  const handleAddToCart = useCallback(() => {
    // Add all selected products with quantities to cart
    const itemsToAdd: CartItem[] = [];

    for (const assignmentId of selectedAssignmentIds) {
      const product = products.find(p => p.assignmentId === assignmentId);
      const quantities = multiUnitQuantities[assignmentId] || {};
      const hasQty = Object.values(quantities).some(qty => parseInt(qty || "0", 10) > 0);

      if (product && hasQty) {
        itemsToAdd.push({
          assignmentId,
          unitQuantities: { ...quantities },
          product,
        });
      }
    }

    if (itemsToAdd.length === 0) return;

    setCartItems((prev) => [...prev, ...itemsToAdd]);

    // Reset selection and quantities
    setSelectedAssignmentIds([]);
    setActiveAssignmentId("");
    setMultiUnitQuantities({});
  }, [selectedAssignmentIds, products, multiUnitQuantities]);

  const handleRemoveFromCart = useCallback((index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmitAll = useCallback(() => {
    if (cartItems.length === 0) return;

    // Add all cart items to main page
    cartItems.forEach((item) => {
      onAdd(item.assignmentId, item.unitQuantities);
    });

    onClose();
  }, [cartItems, onAdd, onClose]);

  const getStockBalance = useCallback((productId: string, unitId: string, multiplierToBase: number): number | null => {
    const inventoryItem = stockInventory.find((s) => s.productId === productId);
    if (!inventoryItem) return null;

    // Convert base quantity to this unit
    const balanceInUnit = Math.floor(inventoryItem.quantityInBase / multiplierToBase);
    return balanceInUnit;
  }, [stockInventory]);

  const checkExceedsStock = useCallback((productId: string, unitId: string, multiplierToBase: number, quantity: number): boolean => {
    const balance = getStockBalance(productId, unitId, multiplierToBase);
    return balance !== null && quantity > balance;
  }, [getStockBalance]);

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

  const subtotal = calculateSubtotal();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom Sheet (Mobile - Fullscreen) / Modal (Desktop) - Professional 2-Column Layout */}
      <div className="fixed inset-0 z-[120] flex flex-col overflow-hidden bg-white md:inset-x-auto md:inset-y-0 md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[calc(100%-2rem)] md:max-w-6xl md:h-[90vh] md:max-h-[90vh] md:rounded-[32px] md:border md:border-white/70 md:shadow-[0_20px_100px_-40px_rgba(37,99,235,0.7)]">

        {/* Header - Unified across mobile and desktop */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 pb-4 pt-safe pt-4 bg-gradient-to-r from-blue-50/50 via-white to-sky-50/50">
          <div>
            <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent">
              {editingData ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
            </h2>
            <p className="text-xs text-slate-500">{editingData ? "แก้ไขจำนวนสินค้า" : "เลือกสินค้าและกรอกจำนวน"}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Mode Toggle */}
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

            {/* Cart Badge - Hidden in edit mode */}
            {!editingData && cartItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCart(!showCart)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-sky-100 text-blue-600 transition hover:from-blue-200 hover:to-sky-200 hover:scale-105 active:scale-95 shadow-sm"
              >
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-sky-500 text-[10px] font-bold text-white shadow-lg">
                  {cartItems.length}
                </span>
              </button>
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

        {/* Content - 2 Column Layout for Desktop/Tablet, Single Column for Mobile */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

          {/* LEFT COLUMN: Product List (Desktop/Tablet - full height, Mobile - scrollable section) */}
          <div className="flex-1 md:w-1/2 md:border-r md:border-slate-200 overflow-y-auto px-4 sm:px-6 py-4 bg-gradient-to-br from-slate-50/30 via-white to-blue-50/20">

            {/* Cart Review Section (Mobile - inline, Desktop - sticky top) */}
            {showCart && cartItems.length > 0 && (
              <div className="mb-6 space-y-3 md:sticky md:top-0 md:bg-white/95 md:backdrop-blur-sm md:p-4 md:rounded-2xl md:shadow-lg md:border md:border-blue-100 md:mb-4 md:z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-blue-600" />
                    รถเข็นสินค้า ({cartItems.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowCart(false)}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    ซ่อน
                  </button>
                </div>
              {cartItems.map((item, index) => {
                const itemTotal = item.product.units.reduce((sum, unit) => {
                  const qty = parseInt(item.unitQuantities[unit.assignmentUnitId] || "0", 10);
                  return sum + qty * unit.pricePc;
                }, 0);

                const itemSummary = item.product.units
                  .map((unit) => {
                    const qty = parseInt(item.unitQuantities[unit.assignmentUnitId] || "0", 10);
                    return qty > 0 ? `${qty} ${unit.unitName}` : null;
                  })
                  .filter(Boolean)
                  .join(", ");

                return (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/50 to-white p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {item.product.productCode}
                      </p>
                      <p className="text-xs text-slate-600 truncate">{item.product.productName}</p>
                      {item.product.companyName && (
                        <p className="text-[10px] font-medium text-blue-600 truncate">
                          {item.product.companyName}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">{itemSummary}</p>
                      <p className="mt-1 text-sm font-bold text-blue-600">
                        {itemTotal.toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        บาท
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart(index)}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600 transition hover:bg-red-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">รวมทั้งหมด</span>
                  <span className="text-lg font-bold text-blue-600">
                    {cartItems
                      .reduce((total, item) => {
                        return (
                          total +
                          item.product.units.reduce((sum, unit) => {
                            const qty = parseInt(item.unitQuantities[unit.assignmentUnitId] || "0", 10);
                            return sum + qty * unit.pricePc;
                          }, 0)
                        );
                      }, 0)
                      .toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                    บาท
                  </span>
                </div>
              </div>
            </div>
          )}

            {/* Product Selection with Search */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                เลือกสินค้า
              </label>

              {/* Search + Checkbox Cards - ใช้ได้ทั้งมือถือและ desktop */}
              <div className="space-y-3">
                {/* Search Input */}
                {!editingData && (
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
                )}

                {/* Results Counter */}
                {productSearch && (
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                      {filteredProducts.length}
                    </span>
                    แสดง {filteredProducts.length.toLocaleString('th-TH')} จาก {products.length.toLocaleString('th-TH')} รายการ
                  </p>
                )}

                {/* Product Checkbox Cards - Responsive */}
                <div className="max-h-[500px] md:max-h-[calc(90vh-300px)] space-y-2 overflow-y-auto rounded-xl border-2 border-blue-100/60 bg-gradient-to-br from-white to-slate-50/50 p-2 sm:p-3 shadow-inner">
                {filteredProducts.length === 0 ? (
                  // Empty State
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
                      } ${editingData ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {/* Checkbox (Multi-select) */}
                      <input
                        type="checkbox"
                        checked={selectedAssignmentIds.includes(product.assignmentId)}
                        onChange={() => handleToggleProduct(product.assignmentId)}
                        disabled={!!editingData}
                        className="mt-1 h-5 w-5 flex-shrink-0 cursor-pointer text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
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
                          <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
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

          {/* RIGHT COLUMN: Quantity Form (Desktop/Tablet - hidden on mobile when no product selected) */}
          <div className="flex-1 md:w-1/2 overflow-y-auto px-4 sm:px-6 py-4 bg-gradient-to-br from-white via-blue-50/10 to-sky-50/20">

            {/* Product Tabs - Show when multiple products selected */}
            {selectedProducts.length > 1 && !editingData && (
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
                      <div className="relative h-5 w-5 flex-shrink-0 overflow-hidden rounded">
                        <Image
                          src={prod.companyLogoUrl}
                          alt={prod.companyName || 'Logo'}
                          fill
                          className="object-contain"
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

            {/* Units */}
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
                const exceedsStock = checkExceedsStock(selectedProduct.productId, unit.unitId, unit.multiplierToBase, quantity);
                const unitSubtotal = quantity * unit.pricePc;

                return (
                  <div
                    key={unit.assignmentUnitId}
                    className={`rounded-2xl border-2 p-4 shadow-sm transition-all duration-200 hover:shadow-lg ${
                      exceedsStock
                        ? "border-rose-400 bg-gradient-to-br from-rose-50 via-white to-red-50/50"
                        : stockBalance === 0
                        ? "border-rose-300 bg-gradient-to-br from-rose-50 via-white to-red-50/50"
                        : stockBalance !== null && stockBalance <= 10
                        ? "border-amber-400 bg-gradient-to-br from-amber-50 via-white to-orange-50/50"
                        : stockBalance !== null
                        ? "border-emerald-400 bg-gradient-to-br from-emerald-50 via-white to-teal-50/50"
                        : "border-blue-200 bg-gradient-to-br from-blue-50/30 via-white to-slate-50"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{unit.unitName}</p>
                        <p className="text-xs text-slate-600">
                          {unit.pricePc.toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          บาท/{unit.unitName}
                        </p>
                        {stockBalance !== null && (
                          <div className="mt-2 space-y-2">
                            {/* Max Selection Badge */}
                            <div className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-white shadow-md bg-gradient-to-r from-blue-500 to-sky-500">
                              <Package className="h-3.5 w-3.5" />
                              <span className="text-sm font-bold">
                                เลือกได้สูงสุด: {stockBalance.toLocaleString("th-TH")} {unit.unitName}
                              </span>
                            </div>

                            {/* Current Stock Status Badge */}
                            <div
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-white shadow-md ${
                                exceedsStock || stockBalance === 0
                                  ? "bg-gradient-to-r from-rose-500 to-red-500"
                                  : stockBalance <= 10
                                  ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                  : "bg-gradient-to-r from-emerald-500 to-teal-500"
                              }`}
                            >
                              <Layers className="h-3.5 w-3.5" />
                              <span className="text-sm font-bold">
                                {stockBalance === 0
                                  ? "สต็อกหมด"
                                  : exceedsStock
                                  ? `เกินสต็อก (คงเหลือ ${stockBalance.toLocaleString("th-TH")})`
                                  : `คงเหลือ ${stockBalance.toLocaleString("th-TH")} ${unit.unitName}`}
                              </span>
                            </div>
                            {/* Show Smart Display if available */}
                            {stockBalance > 0 && !exceedsStock && (() => {
                              const inventoryItem = stockInventory.find((s) => s.productId === selectedProduct.productId);
                              if (inventoryItem && inventoryItem.displayText && inventoryItem.displayText !== "0") {
                                return (
                                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    <span className="text-xs text-slate-600">รวม:</span>
                                    <span className="text-xs font-semibold text-blue-600">
                                      {inventoryItem.displayText}
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                      {unitSubtotal > 0 && (
                        <div className="text-right">
                          <p className="text-sm font-bold text-blue-600">
                            {unitSubtotal.toLocaleString("th-TH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-xs text-slate-500">บาท</p>
                        </div>
                      )}
                    </div>

                    {/* Quantity Input */}
                    <div className="flex items-center gap-3 px-0.5">
                      <button
                        type="button"
                        onClick={() => decrementQuantity(unit.assignmentUnitId)}
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-600 shadow-sm transition-all duration-200 hover:border-red-400 hover:bg-red-50 hover:text-red-600 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                        disabled={quantity === 0}
                      >
                        <Minus className="h-5 w-5" />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={quantities[unit.assignmentUnitId] || ""}
                        onChange={(e) => handleQuantityChange(unit.assignmentUnitId, e.target.value)}
                        placeholder="0"
                        className="h-11 flex-1 min-w-0 rounded-xl border-2 border-blue-200 bg-white px-3 text-center text-lg font-bold text-blue-900 shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-blue-50/30"
                      />
                      <button
                        type="button"
                        onClick={() => incrementQuantity(unit.assignmentUnitId)}
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border-2 border-blue-600 bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-sky-600 hover:scale-105 active:scale-95"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            ) : (
              // Empty state when no product selected
              <div className="flex h-full min-h-[400px] items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-sky-100 shadow-lg">
                    <Package className="h-12 w-12 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-800">เลือกสินค้าเพื่อเริ่มกรอกจำนวน</p>
                    <p className="mt-2 text-sm text-slate-500">✓ เลือกได้หลายรายการพร้อมกัน</p>
                    <p className="text-sm text-slate-500">✓ กรอกจำนวนทีละสินค้า</p>
                    <p className="text-sm text-slate-500">✓ กด &ldquo;ใส่รถเข็น&rdquo; เมื่อเสร็จ</p>
                  </div>
                  {/* Decorative Arrow (Desktop only) */}
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

        {/* Footer - ปรับเพิ่ม pb สำหรับมือถือ และให้ติด bottom */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-gradient-to-r from-blue-50/90 via-white to-sky-50/90 px-4 sm:px-6 py-4 pb-safe shadow-[0_-10px_40px_-20px_rgba(37,99,235,0.3)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">ยอดรวมสินค้าปัจจุบัน</span>
            <span className="text-2xl font-bold text-blue-600">
              {subtotal.toLocaleString("th-TH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              <span className="text-base">บาท</span>
            </span>
          </div>
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
              onClick={editingData ? () => {
                // Edit mode: Save directly without cart
                if (activeAssignmentId && hasQuantity()) {
                  const quantities = multiUnitQuantities[activeAssignmentId] || {};
                  onAdd(activeAssignmentId, quantities);
                  onClose();
                }
              } : handleAddToCart}
              disabled={editingData ? (!activeAssignmentId || !hasQuantity()) : (selectedAssignmentIds.length === 0)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-3.5 font-bold text-white shadow-lg transition-all duration-200 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 hover:scale-[1.02] hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {editingData ? (
                <>
                  <Check className="h-5 w-5" />
                  บันทึก
                </>
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5" />
                  ใส่รถเข็น
                  {selectedAssignmentIds.length > 0 && (
                    <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/30 text-xs">
                      {selectedAssignmentIds.length}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
          {!editingData && cartItems.length > 0 && (
            <button
              type="button"
              onClick={handleSubmitAll}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 px-6 py-3.5 font-bold text-white shadow-lg transition-all duration-200 hover:from-blue-700 hover:via-sky-600 hover:to-indigo-700 hover:scale-[1.02] hover:shadow-xl active:scale-95"
            >
              <Check className="h-5 w-5" />
              บันทึกทั้งหมด ({cartItems.length} รายการ)
            </button>
          )}
        </div>
      </div>
    </>
  );
}
