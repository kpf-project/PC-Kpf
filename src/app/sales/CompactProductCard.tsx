"use client";

import { useState } from "react";
import { Eye, Edit2, Trash2, Package2, X } from "lucide-react";
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

type CompactProductCardProps = {
  product: ProductOption;
  unitQuantities: Record<string, string>;
  onEdit: () => void;
  onRemove: () => void;
};

export default function CompactProductCard({
  product,
  unitQuantities,
  onEdit,
  onRemove,
}: CompactProductCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  // Calculate subtotal and unit breakdown
  const unitDetails = product.units
    .map((unit) => {
      const quantity = parseInt(unitQuantities[unit.assignmentUnitId] || "0", 10);
      const subtotal = quantity * unit.pricePc;
      return {
        unit,
        quantity,
        subtotal,
      };
    })
    .filter((detail) => detail.quantity > 0);

  const totalAmount = unitDetails.reduce((sum, detail) => sum + detail.subtotal, 0);

  // Format short summary (e.g., "2 ลัง, 5 แพ็ค")
  const shortSummary = unitDetails
    .map((detail) => `${detail.quantity.toLocaleString("th-TH")} ${detail.unit.unitName}`)
    .join(", ");

  return (
    <>
      {/* Compact Card - Responsive Layout */}
      <div className="group relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-white via-blue-50/30 to-white p-3 sm:p-4 shadow-sm transition-all duration-200 hover:shadow-md">
        {/* Gradient accent */}
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500" />

        {/* Mobile Layout (Stack vertically) */}
        <div className="flex flex-col gap-3 sm:hidden">
          {/* Top Row: Logo + Info */}
          <div className="flex items-start gap-2">
            {/* Company Logo */}
            <div className="flex-shrink-0">
              {product.companyLogoUrl ? (
                <div className="relative h-10 w-10 overflow-hidden rounded-lg border-2 border-blue-200 bg-white shadow-md">
                  <Image
                    src={product.companyLogoUrl}
                    alt={product.companyName || 'Company logo'}
                    fill
                    className="object-contain p-0.5"
                    sizes="40px"
                    loading="lazy"
                    placeholder="empty"
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-sky-400 shadow-md">
                  <Package2 className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-blue-900 truncate">
                {product.productCode}
              </p>
              <p className="text-xs text-slate-600 truncate">{product.productName}</p>
              {product.companyName && (
                <p className="text-[9px] font-medium text-blue-600 truncate mt-0.5">
                  {product.companyName}
                </p>
              )}
            </div>
          </div>

          {/* Summary & Price */}
          <div>
            <p className="text-xs text-slate-500 truncate">{shortSummary}</p>
            <p className="mt-1 text-base font-bold text-blue-600">
              {totalAmount.toLocaleString("th-TH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              <span className="text-xs font-normal">บาท</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 text-slate-600 px-3 py-2 text-xs font-medium transition-all duration-200 hover:bg-blue-100 hover:text-blue-600"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>ดู</span>
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-100 text-amber-600 px-3 py-2 text-xs font-medium transition-all duration-200 hover:bg-amber-200"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>แก้ไข</span>
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-100 text-red-600 px-3 py-2 text-xs font-medium transition-all duration-200 hover:bg-red-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>ลบ</span>
            </button>
          </div>
        </div>

        {/* Desktop Layout (Horizontal) */}
        <div className="hidden sm:flex items-start justify-between gap-3">
          {/* Left: Company Logo + Info */}
          <div className="flex flex-1 items-start gap-3 min-w-0">
            {/* Company Logo */}
            <div className="flex-shrink-0">
              {product.companyLogoUrl ? (
                <div className="relative h-12 w-12 overflow-hidden bg-transparent">
                  <Image
                    src={product.companyLogoUrl}
                    alt={product.companyName || 'Company logo'}
                    fill
                    className="object-contain mix-blend-multiply"
                    sizes="48px"
                    loading="lazy"
                    placeholder="empty"
                  />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-400 shadow-md">
                  <Package2 className="h-6 w-6 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-blue-900 truncate">
                {product.productCode}
              </p>
              <p className="text-sm text-slate-600 truncate">{product.productName}</p>
              {product.companyName && (
                <p className="text-[10px] font-medium text-blue-600 truncate">
                  {product.companyName}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500 truncate">{shortSummary}</p>
              <p className="mt-1 text-lg font-bold text-blue-600">
                {totalAmount.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                <span className="text-sm font-normal">บาท</span>
              </p>
            </div>
          </div>

          {/* Right: Action buttons */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-all duration-200 hover:bg-blue-100 hover:text-blue-600 hover:scale-110 active:scale-95"
              title="ดูรายละเอียด"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 transition-all duration-200 hover:bg-amber-200 hover:scale-110 active:scale-95"
              title="แก้ไข"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600 transition-all duration-200 hover:bg-red-200 hover:scale-110 active:scale-95"
              title="ลบ"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetail && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative border-b border-blue-100 bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowDetail(false)}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3">
                {/* Company Logo in Modal */}
                <div className="flex-shrink-0">
                  {product.companyLogoUrl ? (
                    <div className="relative h-12 w-12 overflow-hidden rounded-xl border-2 border-white/40 bg-white/20">
                      <Image
                        src={product.companyLogoUrl}
                        alt={product.companyName || 'Company logo'}
                        fill
                        className="object-contain p-1"
                        sizes="48px"
                        loading="lazy"
                        placeholder="empty"
                      />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 border border-white/40">
                      <Package2 className="h-6 w-6 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-100">รายละเอียดสินค้า</p>
                  <p className="text-lg font-bold text-white">{product.productCode}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="mb-1 text-base font-semibold text-slate-900">
                {product.productName}
              </p>
              {product.companyName && (
                <p className="mb-4 text-sm font-medium text-blue-600">
                  {product.companyName}
                </p>
              )}

              {/* Unit breakdown */}
              <div className="space-y-3">
                {unitDetails.map((detail) => (
                  <div
                    key={detail.unit.assignmentUnitId}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        {detail.unit.unitName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {detail.quantity.toLocaleString("th-TH")} × {detail.unit.pricePc.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
                      </p>
                    </div>
                    <p className="text-base font-bold text-blue-600">
                      {detail.subtotal.toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      <span className="text-xs">บาท</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-sky-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">ยอดรวม</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {totalAmount.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    <span className="text-base">บาท</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-blue-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowDetail(false)}
                className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
