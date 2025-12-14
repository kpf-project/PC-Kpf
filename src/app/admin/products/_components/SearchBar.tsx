"use client";

import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ProductCatalogItem } from "@/lib/supabaseProducts";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  products: ProductCatalogItem[];
  onProductSelect?: (productId: string) => void;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  products,
  onProductSelect,
  placeholder = "ค้นหาชื่อ หรือรหัสสินค้า..."
}: SearchBarProps) {
  const suggestions = value.trim()
    ? products
        .filter(
          (product) =>
            product.name.toLowerCase().includes(value.toLowerCase()) ||
            product.code.toLowerCase().includes(value.toLowerCase())
        )
        .slice(0, 5)
    : [];

  const handleClear = () => {
    onChange("");
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-sky-500" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl sm:rounded-2xl border-2 border-sky-200 bg-white/80 py-2 sm:py-3 pl-10 sm:pl-12 pr-10 sm:pr-12 text-sm sm:text-base text-slate-900 placeholder-slate-400 backdrop-blur-sm transition-all duration-300 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/20"
        />
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleClear}
            className="absolute right-3 sm:right-4 top-1/2 flex h-5 w-5 sm:h-6 sm:w-6 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200 text-slate-600 transition-colors hover:bg-slate-300"
          >
            <X className="h-3 w-3 sm:h-4 sm:w-4" />
          </motion.button>
        )}
      </div>

      {/* Live Suggestions Dropdown */}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 right-0 top-full z-10 mt-2 max-h-64 overflow-y-auto rounded-2xl border-2 border-sky-200 bg-white/95 shadow-[0_8px_32px_rgba(56,189,248,0.15)] backdrop-blur-md"
          >
            {suggestions.map((product) => (
              <button
                key={product.id}
                onClick={() => {
                  if (onProductSelect) {
                    onProductSelect(product.id);
                  }
                  onChange("");
                }}
                className="w-full border-b border-sky-100 px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-sky-50"
              >
                <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-slate-500">รหัส: {product.code}</span>
                  {!product.isActive && (
                    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                      ปิดใช้งาน
                    </span>
                  )}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
