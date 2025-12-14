/**
 * Stock Usage Section Component
 *
 * Allows users to select products and enter quantities for multiple units
 */

"use client";

import { useState } from "react";

export type ProductUnit = {
  id: string;
  name: string;
  multiplierToBase: number;
};

export type Product = {
  id: string;
  code: string;
  name: string;
  units: ProductUnit[];
};

export type StockUsageItem = {
  id?: string; // ถ้าโหลดจาก database
  productId: string;
  productCode: string;
  productName: string;
  quantities: Record<string, number>; // { "ลัง": 10, "แพ็ค": 5 }
  totalBaseUnits?: number;
};

type StockUsageSectionProps = {
  stockItems: StockUsageItem[];
  products: Product[];
  onChange: (items: StockUsageItem[]) => void;
  disabled?: boolean;
};

export default function StockUsageSection({
  stockItems,
  products,
  onChange,
  disabled = false,
}: StockUsageSectionProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Get products that are not yet added
  const availableProducts = products.filter(
    (p) => !stockItems.some((item) => item.productId === p.id)
  );

  const handleOpenAddModal = () => {
    setSelectedProductId("");
    setQuantities({});
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setSelectedProductId("");
    setQuantities({});
  };

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    const product = products.find((p) => p.id === productId);
    if (product) {
      // Initialize quantities for all units
      const initialQuantities: Record<string, string> = {};
      product.units.forEach((unit) => {
        initialQuantities[unit.name] = "";
      });
      setQuantities(initialQuantities);
    }
  };

  const handleQuantityChange = (unitName: string, value: string) => {
    setQuantities({
      ...quantities,
      [unitName]: value,
    });
  };

  const handleAddStockItem = () => {
    if (!selectedProduct) return;

    // Convert quantities to numbers and filter out empty values
    const numericQuantities: Record<string, number> = {};
    let hasAnyQuantity = false;

    for (const [unitName, value] of Object.entries(quantities)) {
      const num = parseInt(value);
      if (!isNaN(num) && num > 0) {
        numericQuantities[unitName] = num;
        hasAnyQuantity = true;
      }
    }

    if (!hasAnyQuantity) {
      alert("กรุณากรอกจำนวนอย่างน้อย 1 หน่วย");
      return;
    }

    // Calculate total base units
    let totalBaseUnits = 0;
    for (const [unitName, qty] of Object.entries(numericQuantities)) {
      const unit = selectedProduct.units.find((u) => u.name === unitName);
      if (unit) {
        totalBaseUnits += qty * unit.multiplierToBase;
      }
    }

    const newItem: StockUsageItem = {
      productId: selectedProduct.id,
      productCode: selectedProduct.code,
      productName: selectedProduct.name,
      quantities: numericQuantities,
      totalBaseUnits,
    };

    onChange([...stockItems, newItem]);
    handleCloseAddModal();
  };

  const handleDeleteItem = (productId: string) => {
    onChange(stockItems.filter((item) => item.productId !== productId));
  };

  const formatQuantities = (quantities: Record<string, number>): string => {
    return Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([unit, qty]) => `${qty} ${unit}`)
      .join(" ");
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">📦 สินค้าที่แกะ</h2>

      {stockItems.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-600">ยังไม่มีรายการสินค้าที่แกะ</p>
          <p className="text-sm text-gray-500 mt-1">
            คลิกปุ่มด้านล่างเพื่อเพิ่มสินค้า
          </p>
        </div>
      )}

      <div className="space-y-3">
        {stockItems.map((item) => (
          <div
            key={item.productId}
            className="bg-white p-4 rounded-lg border border-gray-200"
          >
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">
                    {item.productCode}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {item.productName}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-1">
                  {formatQuantities(item.quantities)}
                </p>
                {item.totalBaseUnits !== undefined && (
                  <p className="text-xs text-gray-500 mt-1">
                    รวม: {item.totalBaseUnits} หน่วยฐาน
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDeleteItem(item.productId)}
                className="text-red-600 hover:text-red-700 p-2"
                disabled={disabled}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleOpenAddModal}
        disabled={disabled || availableProducts.length === 0}
        className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {availableProducts.length === 0
          ? "ไม่มีสินค้าที่สามารถเพิ่มได้"
          : "+ เพิ่มสินค้าอีก"}
      </button>

      {/* Add Stock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-semibold text-gray-900">
                เพิ่มสินค้าที่แกะ
              </h3>
            </div>

            <div className="p-4 space-y-4">
              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เลือกสินค้า
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option key="empty" value="">-- เลือกสินค้า --</option>
                  {availableProducts.map((product, index) => (
                    <option key={product.id || `product-${index}`} value={product.id}>
                      {product.code} - {product.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Units Quantity Inputs */}
              {selectedProduct && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">
                    กรอกจำนวน (อย่างน้อย 1 หน่วย)
                  </p>
                  {selectedProduct.units.map((unit) => (
                    <div key={unit.id} className="flex items-center gap-3">
                      <label className="flex-1 text-sm text-gray-700">
                        {unit.name}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={quantities[unit.name] || ""}
                        onChange={(e) =>
                          handleQuantityChange(unit.name, e.target.value)
                        }
                        placeholder="0"
                        className="w-24 px-3 py-2 border border-gray-300 rounded-md text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-2">
              <button
                onClick={handleCloseAddModal}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleAddStockItem}
                disabled={!selectedProductId}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
              >
                เพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
