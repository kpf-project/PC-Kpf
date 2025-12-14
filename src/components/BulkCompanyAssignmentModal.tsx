"use client";

import { useState } from "react";
import { X, Building2, Save, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CompanySelector from "./company/CompanySelector";

interface BulkCompanyAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Array<{ id: string; code: string; name: string }>;
  onSave: (companyId: string | null) => Promise<void>;
}

export default function BulkCompanyAssignmentModal({
  isOpen,
  onClose,
  selectedProducts,
  onSave,
}: BulkCompanyAssignmentModalProps) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    try {
      setIsSaving(true);
      setError(null);
      await onSave(companyId);
      onClose();
      // Reset after successful save
      setCompanyId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSaving(false);
    }
  }

  function handleClose() {
    if (!isSaving) {
      setCompanyId(null);
      setError(null);
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border-2 border-sky-200 bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-sky-100 bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">กำหนดบริษัทแบบกลุ่ม</h2>
                    <p className="text-sm text-white/80">
                      เลือก {selectedProducts.length} สินค้า
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={isSaving}
                  className="rounded-xl p-2 text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Error Message */}
                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {/* Company Selector */}
                <div>
                  <CompanySelector
                    value={companyId}
                    onChange={setCompanyId}
                    label="เลือกบริษัท"
                    placeholder="เลือกบริษัท (หรือเว้นว่างเพื่อลบบริษัท)"
                    required={false}
                    includeAllOption={false}
                    size="lg"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    💡 หากไม่เลือกบริษัท ระบบจะลบข้อมูลบริษัทออกจากสินค้าที่เลือก
                  </p>
                </div>

                {/* Selected Products List */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">
                    สินค้าที่จะอัปเดต ({selectedProducts.length} รายการ)
                  </h3>
                  <div className="max-h-60 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    {selectedProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-sm"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">รหัส: {product.code}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  onClick={handleClose}
                  disabled={isSaving}
                  className="rounded-2xl border-2 border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-sky-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      บันทึกทั้งหมด
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
