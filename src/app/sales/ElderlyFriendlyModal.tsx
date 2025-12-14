"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { X, Search, ShoppingCart, ChevronRight, Plus, Minus, Check, Save, ArrowLeft, Package, Layers, Zap, Smile } from "lucide-react";
import { useModal } from "@/contexts/ModalContext";

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
  id: string;
  product: ProductOption;
  unit: ProductUnitOption;
  quantity: number;
  subtotal: number;
};

type SlideView = "products" | "units";

interface ElderlyFriendlyModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductOption[];
  stockInventory: StockInventoryItem[];
  onSaveCart: (items: Array<{ assignmentId: string; unitQuantities: Record<string, string> }>) => void;
  editingData?: {
    assignmentId: string;
    unitQuantities: Record<string, string>;
  } | null;
  recordingMode?: "quick" | "elderly";
  onModeChange?: (mode: "quick" | "elderly") => void;
}

export default function ElderlyFriendlyModal({
  isOpen,
  onClose,
  products,
  stockInventory,
  onSaveCart,
  editingData = null,
  recordingMode = "elderly",
  onModeChange,
}: ElderlyFriendlyModalProps) {
  const { openModal, closeModal } = useModal();
  const [currentView, setCurrentView] = useState<SlideView>("products");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [unitSelections, setUnitSelections] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  // Sync modal state with ModalContext
  useEffect(() => {
    const MODAL_ID = 'elderly-sales-modal';
    if (isOpen) {
      openModal(MODAL_ID);
    } else {
      closeModal(MODAL_ID);
    }

    return () => {
      // Cleanup: always close modal on unmount
      closeModal(MODAL_ID);
    };
  }, [isOpen, openModal, closeModal, products]);

  // Load editing data when modal opens in edit mode
  useEffect(() => {
    if (isOpen && editingData) {
      // Find the product being edited
      const product = products.find((p) => p.assignmentId === editingData.assignmentId);

      if (product) {
        // Set selected product
        setSelectedProduct(product);

        // Pre-fill unit selections from editingData
        const selections: Record<string, number> = {};
        for (const [assignmentUnitId, quantityStr] of Object.entries(editingData.unitQuantities)) {
          const quantity = Number.parseFloat(quantityStr);
          if (quantity > 0) {
            const unit = product.units.find((u) => u.assignmentUnitId === assignmentUnitId);
            if (unit) {
              selections[unit.unitId] = quantity;
            }
          }
        }
        setUnitSelections(selections);

        // Go to units view directly
        setCurrentView("units");
      }

      setSearchQuery("");
      setCart([]);
    } else if (isOpen && !editingData) {
      // Normal mode - reset everything
      setCurrentView("products");
      setSearchQuery("");
      setSelectedProduct(null);
      setUnitSelections({});
      setCart([]);
    }
  }, [isOpen, editingData, products]);

  // Helper function to get stock balance for a product unit
  const getStockBalance = useCallback(
    (productId: string, unitId: string): number | null => {
      const inventoryItem = stockInventory.find((item) => item.productId === productId);
      if (!inventoryItem) return null;

      // Find the unit's multiplier from product data
      const product = products.find((p) => p.productId === productId);
      if (!product) return null;

      const unit = product.units.find((u) => u.unitId === unitId);
      if (!unit) return null;

      // Convert base quantity to this unit
      const balanceInUnit = Math.floor(inventoryItem.quantityInBase / unit.multiplierToBase);
      return balanceInUnit;
    },
    [stockInventory, products]
  );

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    return !searchQuery.trim()
      ? products
      : products.filter((product) => {
          const query = searchQuery.toLowerCase();
          const nameMatch = product.productName.toLowerCase().includes(query);
          const codeMatch = product.productCode.toLowerCase().includes(query);
          const companyMatch = product.companyName?.toLowerCase().includes(query);
          return nameMatch || codeMatch || companyMatch;
        });
  }, [products, searchQuery]);

  // Handle product selection
  const handleSelectProduct = useCallback((product: ProductOption) => {
    setSelectedProduct(product);
    setUnitSelections({});
    setCurrentView("units");
  }, []);

  // Handle quantity change for a specific unit
  const handleQuantityChange = useCallback((unitId: string, delta: number) => {
    setUnitSelections((prev) => {
      const currentQty = prev[unitId] || 0;
      const newQty = currentQty + delta;

      if (newQty < 0) return prev;

      // Check stock availability
      if (selectedProduct) {
        const stockBalance = getStockBalance(selectedProduct.productId, unitId);
        if (stockBalance !== null && newQty > stockBalance) {
          return prev;
        }
      }

      if (newQty === 0) {
        const { [unitId]: _removed, ...rest } = prev;
        return rest;
      }

      return { ...prev, [unitId]: newQty };
    });
  }, [selectedProduct, getStockBalance]);

  // Add to cart (or save in edit mode)
  const handleAddToCart = useCallback(() => {
    if (!selectedProduct) return;

    const selections = Object.entries(unitSelections);
    if (selections.length === 0) {
      alert("กรุณาเลือกหน่วยและระบุจำนวนอย่างน้อย 1 หน่วย");
      return;
    }

    // Edit mode: Save directly
    if (editingData) {
      // Convert unitSelections to unitQuantities format
      const unitQuantities: Record<string, string> = {};
      for (const [unitId, quantity] of selections) {
        const unit = selectedProduct.units.find((u) => u.unitId === unitId);
        if (unit) {
          unitQuantities[unit.assignmentUnitId] = String(quantity);
        }
      }

      // Call save with single item
      onSaveCart([{
        assignmentId: selectedProduct.assignmentId,
        unitQuantities,
      }]);
      onClose();
      return;
    }

    // Normal mode: Add to cart
    const newItems: CartItem[] = selections.map(([unitId, quantity]) => {
      const unit = selectedProduct.units.find((u) => u.unitId === unitId)!;
      return {
        id: `${selectedProduct.assignmentId}-${unit.assignmentUnitId}-${Date.now()}-${Math.random()}`,
        product: selectedProduct,
        unit,
        quantity,
        subtotal: quantity * unit.pricePc,
      };
    });

    setCart((prev) => [...prev, ...newItems]);

    // Reset and go back to product selection
    setCurrentView("products");
    setSelectedProduct(null);
    setUnitSelections({});
  }, [selectedProduct, unitSelections, editingData, onSaveCart, onClose]);

  // Remove from cart
  const handleRemoveFromCart = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  // Calculate cart total
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  const cartItemCount = cart.length;

  // Calculate current selection total
  const currentSelectionTotal = useMemo(() => {
    if (!selectedProduct) return 0;
    return Object.entries(unitSelections).reduce((sum, [unitId, quantity]) => {
      const unit = selectedProduct.units.find((u) => u.unitId === unitId);
      return sum + (unit ? quantity * unit.pricePc : 0);
    }, 0);
  }, [selectedProduct, unitSelections]);

  // Check if current selection has any units selected
  const hasUnitSelections = Object.keys(unitSelections).length > 0;

  // Handle save cart
  const handleSaveCart = useCallback(() => {
    if (cart.length === 0) {
      alert("กรุณาเพิ่มสินค้าลงตะกร้าก่อนบันทึก");
      return;
    }

    // Group cart items by assignment
    const grouped = new Map<string, Record<string, string>>();

    for (const item of cart) {
      const existing = grouped.get(item.product.assignmentId) || {};
      const currentQty = Number.parseFloat(existing[item.unit.assignmentUnitId] || "0");
      existing[item.unit.assignmentUnitId] = String(currentQty + item.quantity);
      grouped.set(item.product.assignmentId, existing);
    }

    const items = Array.from(grouped.entries()).map(([assignmentId, unitQuantities]) => ({
      assignmentId,
      unitQuantities,
    }));

    onSaveCart(items);

    // Reset cart
    setCart([]);
    setCurrentView("products");
    onClose();
  }, [cart, onSaveCart, onClose]);

  // Back to products from units
  const handleBackToProducts = useCallback(() => {
    setCurrentView("products");
    setSelectedProduct(null);
    setUnitSelections({});
  }, []);

  if (!isOpen) return null;

  // Debug logging
  console.log('[ElderlyFriendlyModal] Debug:', {
    currentView,
    productsCount: products.length,
    filteredProductsCount: filteredProducts.length,
    searchQuery,
    editingData: !!editingData,
    cartLength: cart.length,
    showCart
  });

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-gradient-to-br from-black/70 via-black/60 to-black/50 backdrop-blur-sm">
      <div className="relative w-full h-full sm:h-[90vh] sm:mx-4 sm:max-w-4xl overflow-hidden rounded-t-3xl sm:rounded-3xl bg-gradient-to-br from-white via-blue-50/30 to-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b-2 border-blue-100 bg-gradient-to-r from-blue-500 via-sky-400 to-blue-500 px-4 sm:px-6 py-4 sm:py-5 shadow-lg">
          <div className="flex items-center gap-2 sm:gap-3">
            <Package className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
            <h2 className="text-xl sm:text-2xl font-bold text-white drop-shadow-sm">
              {editingData ? "กำลังแก้ไขสินค้า" : (
                <>
                  {currentView === "products" && "เลือกสินค้า"}
                  {currentView === "units" && "เลือกหน่วยและจำนวน"}
                </>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Mode Toggle */}
            {onModeChange && (
              <div className="flex items-center gap-1 bg-white/20 backdrop-blur-md rounded-full p-1 border-2 border-white/40 shadow-lg">
                <button
                  type="button"
                  onClick={() => onModeChange("quick")}
                  title="โหมดเร็ว"
                  className={`relative flex items-center justify-center h-9 w-9 rounded-full transition-all duration-300 ${
                    recordingMode === "quick"
                      ? "bg-white text-blue-600 shadow-lg scale-110"
                      : "text-white/60 hover:text-white hover:bg-white/10"
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
                      ? "bg-white text-blue-600 shadow-lg scale-110"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Smile className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            )}
            {/* Cart Badge - Hidden in edit mode */}
            {!editingData && cartItemCount > 0 && (
              <button
                type="button"
                onClick={() => setShowCart(!showCart)}
                className="relative flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-3 sm:px-4 py-2 border-2 border-white/40 transition-all hover:bg-white/30 hover:scale-105 active:scale-95"
              >
                <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                <span className="text-base sm:text-lg font-bold text-white">{cartItemCount}</span>
                <div className="absolute -top-1 -right-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-lg animate-pulse">
                  {cartItemCount}
                </div>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-2 text-white/90 backdrop-blur-sm bg-white/10 transition-all hover:bg-white/20 hover:scale-110 active:scale-95"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </div>

        {/* Content with slide animation */}
        <div className="relative flex-1 overflow-hidden">
          {/* Products View */}
          <div
            className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
              currentView === "products" ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex h-full flex-col">
              {/* Search Bar - Hide in edit mode */}
              {!editingData && (
              <div className="border-b-2 border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 px-4 sm:px-6 py-3 sm:py-4">
                <div className="relative">
                  <Search className="absolute left-3 sm:left-4 top-1/2 h-5 w-5 sm:h-6 sm:w-6 -translate-y-1/2 text-blue-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อสินค้า หรือ ชื่อบริษัท..."
                    className="w-full rounded-2xl border-2 border-blue-200 bg-white py-3 sm:py-4 pl-11 sm:pl-14 pr-4 sm:pr-6 text-base sm:text-lg font-medium focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>
              )}

              {/* Cart Review Section - Show when cart button clicked */}
              {showCart && cart.length > 0 && (
                <div className="border-b-2 border-blue-100 px-3 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-blue-50 to-sky-50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      รถเข็นสินค้า ({cart.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowCart(false)}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      ซ่อน
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {cart.map((item) => {
                      return (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 rounded-xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/30 p-3"
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
                            <p className="mt-1 text-xs text-slate-500">
                              {item.quantity} {item.unit.unitName} × {item.unit.pricePc.toLocaleString("th-TH")} = {item.subtotal.toLocaleString("th-TH")} บาท
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600 transition hover:bg-red-200"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-blue-200 mt-3 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">รวมทั้งหมด</span>
                      <span className="text-lg font-bold text-blue-600">
                        {cartTotal.toLocaleString("th-TH")} บาท
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Product List */}
              <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 bg-gradient-to-br from-white via-blue-50/20 to-white">

                {filteredProducts.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-sky-100">
                        <Search className="h-10 w-10 sm:h-12 sm:w-12 text-blue-300" />
                      </div>
                      <p className="mt-4 text-base sm:text-lg font-semibold text-slate-400">ไม่พบสินค้า</p>
                      <p className="mt-2 text-sm text-slate-500">
                        {products.length === 0 ? 'กรุณาเลือกพนักงานและร้านค้าก่อน' : 'ลองค้นหาด้วยคำอื่น'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.assignmentId}
                        onClick={() => handleSelectProduct(product)}
                        className="group flex items-center gap-3 sm:gap-4 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50/30 p-4 sm:p-6 text-left transition-all hover:border-blue-400 hover:shadow-xl hover:scale-[1.02] active:scale-95"
                      >
                        {product.companyLogoUrl && (
                          <div className="relative h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden bg-transparent">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={product.companyLogoUrl}
                              alt={product.companyName || "Company"}
                              className="h-full w-full object-contain mix-blend-multiply"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-base sm:text-lg font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                            {product.productCode}
                          </p>
                          <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 mt-1">
                            {product.productName}
                          </p>
                          {product.companyName && (
                            <p className="mt-1 sm:mt-2 text-xs text-blue-600 font-medium">
                              {product.companyName}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Units View */}
          <div
            className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
              currentView === "units" ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {selectedProduct && (
              <div className="flex h-full flex-col">
                {/* Product Info */}
                <div className="border-b-2 border-blue-100 bg-gradient-to-r from-blue-50 via-sky-50 to-blue-50 px-4 sm:px-6 py-3 sm:py-4">
                  {!editingData && (
                    <button
                      onClick={handleBackToProducts}
                      className="mb-2 sm:mb-3 flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>กลับไปเลือกสินค้าอื่น</span>
                    </button>
                  )}
                  <div className="flex items-center gap-3 sm:gap-4">
                    {selectedProduct.companyLogoUrl && (
                      <div className="relative h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 overflow-hidden bg-transparent">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedProduct.companyLogoUrl}
                          alt={selectedProduct.companyName || "Company"}
                          className="h-full w-full object-contain mix-blend-multiply"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                        {selectedProduct.productCode}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-600 line-clamp-2">
                        {selectedProduct.productName}
                      </p>
                      {selectedProduct.companyName && (
                        <p className="mt-1 text-xs text-blue-600 font-medium">
                          {selectedProduct.companyName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Unit Selection */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 pb-6 sm:pb-6 bg-gradient-to-br from-white via-blue-50/20 to-white">
                  <p className="mb-3 sm:mb-4 text-base sm:text-lg font-bold text-slate-700">
                    เลือกหน่วยและจำนวน (เลือกได้หลายหน่วย):
                  </p>
                  <div className="space-y-3 sm:space-y-4 pb-4">
                    {selectedProduct.units.map((unit) => {
                      const stockBalance = getStockBalance(selectedProduct.productId, unit.unitId);
                      const currentQuantity = unitSelections[unit.unitId] || 0;
                      const exceedsStock = stockBalance !== null && currentQuantity > stockBalance;
                      const unitSubtotal = currentQuantity * unit.pricePc;

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
                              onClick={() => handleQuantityChange(unit.unitId, -1)}
                              disabled={currentQuantity === 0}
                              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border-2 border-slate-300 bg-white text-slate-600 shadow-sm transition-all duration-200 hover:border-red-400 hover:bg-red-50 hover:text-red-600 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                            >
                              <Minus className="h-5 w-5" />
                            </button>
                            <div className="text-center flex-1">
                              <p className="text-4xl sm:text-5xl font-bold text-blue-600">
                                {currentQuantity}
                              </p>
                              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                                {unit.unitName}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(unit.unitId, 1)}
                              disabled={stockBalance !== null && currentQuantity >= stockBalance}
                              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border-2 border-blue-600 bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-md transition-all duration-200 hover:from-blue-700 hover:to-sky-600 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Different for each view */}
        <div className="flex-shrink-0 border-t-2 border-blue-100 bg-gradient-to-r from-blue-50 via-sky-50 to-blue-50 px-4 sm:px-6 py-3 sm:py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          {currentView === "products" && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex-1 rounded-xl bg-gradient-to-r from-blue-100 to-sky-100 px-4 py-3 text-center sm:text-left">
                <p className="text-xs sm:text-sm text-slate-600 font-medium">ยอดรวมในตะกร้า</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-1">
                  {cartTotal.toLocaleString("th-TH")} <span className="text-base sm:text-lg">บาท</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">{cartItemCount} รายการ</p>
              </div>
              <button
                onClick={handleSaveCart}
                disabled={cart.length === 0}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 px-6 sm:px-8 py-4 sm:py-5 text-base sm:text-xl font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                <Save className="h-5 w-5 sm:h-6 sm:w-6" />
                <span>{editingData ? "บันทึกการแก้ไข" : "บันทึกยอดขาย"}</span>
              </button>
            </div>
          )}

          {currentView === "units" && hasUnitSelections && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex-1 rounded-xl bg-gradient-to-r from-blue-100 to-sky-100 px-4 py-3 text-center sm:text-left">
                <p className="text-xs sm:text-sm text-slate-600 font-medium">ยอดรวมสินค้านี้</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-1">
                  {currentSelectionTotal.toLocaleString("th-TH")} <span className="text-base sm:text-lg">บาท</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {Object.keys(unitSelections).length} หน่วย
                </p>
              </div>
              <button
                onClick={handleAddToCart}
                className="flex items-center justify-center gap-2 sm:gap-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 px-8 sm:px-10 py-5 sm:py-5 text-lg sm:text-xl font-bold text-white shadow-xl transition-all hover:shadow-2xl hover:scale-105 active:scale-95 min-h-[60px] sm:min-h-[64px]"
              >
                {editingData ? (
                  <>
                    <Check className="h-6 w-6 sm:h-6 sm:w-6" />
                    <span>บันทึก</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-6 w-6 sm:h-6 sm:w-6" />
                    <span>ใส่ตะกร้า</span>
                  </>
                )}
              </button>
            </div>
          )}

          {currentView === "units" && !hasUnitSelections && (
            <div className="text-center py-2">
              <p className="text-sm text-slate-500">กรุณาเลือกหน่วยและระบุจำนวนก่อนใส่ตะกร้า</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
