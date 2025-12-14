"use client";

import { CheckSquare, Trash2, X, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BulkToolbarProps {
  selectedCount: number;
  onBulkDelete: () => void;
  onBulkAssignCompany?: () => void;
  onCancel: () => void;
}

export default function BulkToolbar({ selectedCount, onBulkDelete, onBulkAssignCompany, onCancel }: BulkToolbarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="rounded-full border-2 border-sky-200 bg-white/95 px-8 py-4 shadow-[0_16px_64px_rgba(56,189,248,0.25)] backdrop-blur-md">
            <div className="flex items-center gap-6">
              {/* Selection Count */}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/40">
                  <CheckSquare className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">เลือกแล้ว</p>
                  <p className="text-lg font-bold text-slate-900">{selectedCount} รายการ</p>
                </div>
              </div>

              {/* Divider */}
              <div className="h-12 w-px bg-slate-200" />

              {/* Actions */}
              <div className="flex gap-3">
                {onBulkAssignCompany && (
                  <button
                    onClick={onBulkAssignCompany}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/30 transition-all hover:from-sky-600 hover:to-blue-700 hover:shadow-xl hover:shadow-sky-500/40"
                  >
                    <Building2 className="h-4 w-4" />
                    กำหนดบริษัท
                  </button>
                )}
                <button
                  onClick={onBulkDelete}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/30 transition-all hover:from-red-600 hover:to-red-700 hover:shadow-xl hover:shadow-red-500/40"
                >
                  <Trash2 className="h-4 w-4" />
                  ลบทั้งหมด
                </button>
                <button
                  onClick={onCancel}
                  className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
