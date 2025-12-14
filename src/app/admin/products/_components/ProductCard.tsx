"use client";

import { Package, Edit, Trash2, Box, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";
import Image from "next/image";
import type { ProductCatalogItem } from "@/lib/supabaseProducts";

interface ProductCardProps {
  product: ProductCatalogItem;
  isSelected: boolean;
  onToggleSelect: (productId: string) => void;
  onEdit: (product: ProductCatalogItem) => void;
  onDelete: (productId: string) => void;
}

export default function ProductCard({
  product,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete
}: ProductCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={clsx(
        "group relative overflow-hidden rounded-2xl transition-all duration-300",
        isSelected
          ? "bg-gradient-to-br from-blue-50 via-sky-50 to-white border-2 border-blue-400 shadow-xl shadow-blue-500/25"
          : "bg-white border-2 border-slate-200/60 shadow-md hover:border-blue-300 hover:shadow-xl hover:shadow-sky-500/15"
      )}
    >
      {/* Selection Glow Effect */}
      {isSelected && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 via-sky-400/5 to-transparent pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-sky-500 to-blue-600" />
        </>
      )}

      <div className="relative p-3 space-y-3">
        {/* Top Row: Logo + Checkbox */}
        <div className="flex items-start justify-between gap-2">
          {/* Logo */}
          <div className="flex-shrink-0">
            {product.companyLogoUrl ? (
              <div className="relative h-14 w-14 sm:h-12 sm:w-12 overflow-hidden bg-transparent">
                <Image
                  src={product.companyLogoUrl}
                  alt={product.companyName || "Company Logo"}
                  fill
                  className="object-contain mix-blend-multiply"
                  sizes="(max-width: 640px) 56px, 48px"
                  loading="lazy"
                  placeholder="empty"
                />
              </div>
            ) : (
              <div className="flex h-14 w-14 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-sky-500 to-indigo-600 shadow-lg shadow-blue-500/30">
                <Package className="h-6 w-6 sm:h-5 sm:w-5 text-white" strokeWidth={2.5} />
              </div>
            )}
          </div>

          {/* Checkbox */}
          <div className="flex-shrink-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(product.id)}
              className="h-6 w-6 sm:h-5 sm:w-5 cursor-pointer rounded-lg border-2 border-blue-300 text-blue-600 focus:ring-2 focus:ring-blue-400/50 transition-all hover:border-blue-500 hover:scale-110 shadow-sm"
            />
          </div>
        </div>

        {/* Product Name - Full Width */}
        <div className="space-y-2">
          <h3 className="text-[17px] leading-snug sm:text-sm font-bold text-slate-900 line-clamp-3 sm:line-clamp-2">
            {product.name}
          </h3>

          {/* Info Pills Row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Product Code */}
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-100 to-sky-100 border border-blue-200/60">
              <Box className="h-3 w-3 text-blue-600" />
              <span className="text-[11px] font-bold text-blue-700">{product.code}</span>
            </div>

            {/* Status Badge */}
            {product.isActive ? (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-100 to-green-100 border border-emerald-200/60">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-700">ใช้งาน</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200/60">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span className="text-[11px] font-bold text-slate-600">ปิด</span>
              </div>
            )}
          </div>

          {/* Company Name */}
          {product.companyName && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/60 max-w-full">
              <span className="text-[11px] text-slate-500 flex-shrink-0">🏢</span>
              <span className="text-[11px] font-semibold text-slate-600 truncate">{product.companyName}</span>
            </div>
          )}
        </div>

        {/* Units Section - Glass Design */}
        {product.units.length > 0 && (
          <div className="relative rounded-xl bg-gradient-to-r from-slate-50 via-blue-50/40 to-sky-50/40 border border-slate-200/50 p-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Box className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              {product.units.slice(0, 4).map((unit) => (
                <span
                  key={unit.id}
                  className={clsx(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold transition-all",
                    unit.isBase
                      ? "bg-gradient-to-r from-blue-500 to-sky-500 text-white shadow-md shadow-blue-500/30"
                      : "bg-white/90 text-slate-600 border border-slate-200/60"
                  )}
                >
                  {unit.name}
                  {unit.isBase && <Sparkles className="h-2.5 w-2.5" />}
                </span>
              ))}
              {product.units.length > 4 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200/60 text-[11px] font-bold text-slate-500">
                  +{product.units.length - 4}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons - Full Width on Mobile */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onEdit(product)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-blue-300/70 bg-gradient-to-br from-blue-50 to-sky-50 px-3 py-2.5 sm:py-2 text-sm sm:text-xs font-bold text-blue-700 hover:from-blue-100 hover:to-sky-100 hover:border-blue-400 active:scale-95 transition-all shadow-sm hover:shadow-md hover:shadow-blue-500/20"
          >
            <Edit className="h-4 w-4" strokeWidth={2.5} />
            <span>แก้ไข</span>
          </button>
          <button
            onClick={() => onDelete(product.id)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-red-300/70 bg-gradient-to-br from-red-50 to-rose-50 px-3 py-2.5 sm:py-2 text-sm sm:text-xs font-bold text-red-600 hover:from-red-100 hover:to-rose-100 hover:border-red-400 active:scale-95 transition-all shadow-sm hover:shadow-md hover:shadow-red-500/20"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.5} />
            <span>ลบ</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
