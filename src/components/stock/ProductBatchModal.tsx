/**
 * Product Batch Modal Component
 * Professional UI for managing batch data at product level (FDA/GMP compliant)
 * One batch per product, shared across all units
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Package,
  Calendar,
  Sparkles,
  CheckCircle,  // ✅ เปลี่ยนจาก CheckCircle2 → CheckCircle (solid, ดูทางการกว่า)
  Clock,
  AlertTriangle,
  Save,
} from 'lucide-react';
import { generateLotNumber } from '@/lib/lotNumberGenerator';
import { daysUntilExpiry } from '@/lib/ocrDateExtractor';
import { useModal } from '@/contexts/ModalContext';
import dayjs from 'dayjs';
import 'dayjs/locale/th';

dayjs.locale('th');

// ============================================================================
// Types
// ============================================================================

export interface ProductBatchData {
  lotNumber: string;
  mfgDate: string; // YYYY-MM-DD
  expDate: string; // YYYY-MM-DD
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ProductBatchData) => void;
  productCode: string;
  productName: string;
  initialData?: ProductBatchData | null;
}

// ============================================================================
// Main Component
// ============================================================================

export default function ProductBatchModal({
  isOpen,
  onClose,
  onSave,
  productCode,
  productName,
  initialData,
}: Props) {
  const { openModal, closeModal } = useModal();
  const MODAL_ID = 'product-batch-modal';

  // Local state
  const [batchData, setBatchData] = useState<ProductBatchData>(() => {
    if (initialData) return initialData;

    // Auto-generate lot number on mount
    // ✅ Pre-fill mfgDate with today (user should verify)
    const today = dayjs().format('YYYY-MM-DD');
    return {
      lotNumber: generateLotNumber(productCode),
      mfgDate: today,  // ✅ Default to today
      expDate: '',
    };
  });

  const [isMobile, setIsMobile] = useState(false);

  // Check mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Control SiteNav visibility
  useEffect(() => {
    if (isOpen && isMobile) {
      openModal(MODAL_ID);
    } else {
      closeModal(MODAL_ID);
    }

    return () => {
      closeModal(MODAL_ID);
    };
  }, [isOpen, isMobile, openModal, closeModal]);

  // Handle save
  const handleSave = useCallback(() => {
    // Validation: mfg_date is required (expiry_date is optional)
    if (!batchData.mfgDate) {
      alert('กรุณากรอกวันที่ผลิต (MFG)');
      return;
    }

    // ✅ Validate: mfg_date must not be in the future
    const today = dayjs();
    const mfgDate = dayjs(batchData.mfgDate);
    if (mfgDate.isAfter(today, 'day')) {
      alert('วันที่ผลิตต้องไม่เกินวันนี้');
      return;
    }

    // ✅ Validate: mfg_date should not be too old (> 2 years)
    const twoYearsAgo = today.subtract(2, 'year');
    if (mfgDate.isBefore(twoYearsAgo, 'day')) {
      const confirmed = confirm(
        `วันที่ผลิตเก่ากว่า 2 ปี (${mfgDate.format('DD/MM/YYYY')})\n` +
        'โปรดยืนยันว่าข้อมูลถูกต้อง'
      );
      if (!confirmed) return;
    }

    // ✅ Validate: if expiry_date exists, must be after mfg_date
    if (batchData.expDate) {
      const expDate = dayjs(batchData.expDate);
      if (expDate.isBefore(mfgDate, 'day')) {
        alert('วันหมดอายุต้องมาหลังวันที่ผลิต');
        return;
      }
    }

    // expiry_date is optional - no other validation needed
    onSave(batchData);
    onClose();
  }, [batchData, onSave, onClose]);

  // Calculate days until expiry
  const daysLeft = batchData.expDate ? daysUntilExpiry(batchData.expDate) : null;

  // Determine expiry status
  const getExpiryStatus = () => {
    if (!daysLeft) return null;
    if (daysLeft < 0) return { color: 'red', text: 'หมดอายุแล้ว!', icon: <AlertTriangle className="h-5 w-5" /> };
    if (daysLeft <= 7) return { color: 'red', text: `เหลือ ${daysLeft} วัน (วิกฤต)`, icon: <AlertTriangle className="h-5 w-5" /> };
    if (daysLeft <= 30) return { color: 'orange', text: `เหลือ ${daysLeft} วัน (แจ้งเตือน)`, icon: <Clock className="h-5 w-5" /> };
    return { color: 'green', text: `เหลือ ${daysLeft} วัน`, icon: <CheckCircle className="h-5 w-5" /> };
  };

  const expiryStatus = getExpiryStatus();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
        <div
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Gradient Blue */}
          <div className="sticky top-0 z-10 relative overflow-hidden rounded-t-3xl bg-gradient-to-br from-blue-500 via-sky-400 to-cyan-300 p-6 sm:p-8 shadow-lg">
            {/* Decorative circles */}
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border-2 border-white/40 text-white transition hover:bg-white/30 active:scale-95"
              aria-label="ปิด"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Title */}
            <div className="relative flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/40 shadow-xl">
                  <Package className="h-7 w-7 text-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 mb-1">
                  กรอก Batch สำหรับสินค้า
                  <Sparkles className="h-5 w-5 text-yellow-200" />
                </h3>
                <p className="text-sm sm:text-base text-white/90 leading-relaxed truncate">
                  {productName}
                </p>
                <p className="text-xs text-white/75 mt-1">
                  รหัส: <span className="font-mono font-bold">{productCode}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* ⚠️ Warning Banner - ให้ตรวจสอบวันที่ผลิต */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-5 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400 shadow-md">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-base font-bold text-amber-900 mb-1.5">
                    โปรดตรวจสอบวันที่ผลิต (MFG Date)
                  </h4>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    ระบบกำลังใช้วันที่วันนี้ ({dayjs().locale('th').format('DD MMM YY')}) เป็นค่าเริ่มต้น
                    <br />
                    <span className="font-semibold">กรุณาแก้ไขให้ตรงกับวันที่ผลิตจริงบนฉลากสินค้า</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Date Inputs */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* MFG Date */}
              <div className="group relative overflow-hidden rounded-2xl border-2 border-sky-200 bg-gradient-to-br from-white via-sky-50/50 to-cyan-50/30 p-5 shadow-md">
                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 text-sm font-bold text-sky-700">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-400 shadow-md">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-base">วันที่ผลิต (MFG)</p>
                      <p className="text-xs font-normal text-sky-600">จำเป็น *</p>
                    </div>
                  </label>

                  <input
                    type="date"
                    value={batchData.mfgDate}
                    onChange={(e) =>
                      setBatchData({ ...batchData, mfgDate: e.target.value })
                    }
                    required
                    className="w-full rounded-xl border-2 border-sky-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-sm
                      focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 focus:outline-none
                      hover:border-sky-300"
                  />
                </div>
              </div>

              {/* EXP Date */}
              <div className="group relative overflow-hidden rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-white via-amber-50/50 to-yellow-50/30 p-5 shadow-md">
                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 text-sm font-bold text-amber-700">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-400 shadow-md">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-base">วันหมดอายุ (EXP)</p>
                      <p className="text-xs font-normal text-amber-600">ไม่บังคับ (ถ้าไม่มีให้เว้นว่าง)</p>
                    </div>
                  </label>

                  <input
                    type="date"
                    value={batchData.expDate}
                    onChange={(e) =>
                      setBatchData({ ...batchData, expDate: e.target.value })
                    }
                    className="w-full rounded-xl border-2 border-amber-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-sm
                      focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 focus:outline-none
                      hover:border-amber-300"
                  />
                </div>
              </div>
            </div>

            {/* Expiry Status */}
            {expiryStatus && (
              <div
                className={`flex items-center gap-3 rounded-xl border-2 p-4 ${
                  expiryStatus.color === 'green'
                    ? 'bg-green-50 border-green-200 text-green-900'
                    : expiryStatus.color === 'orange'
                    ? 'bg-orange-50 border-orange-200 text-orange-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                {expiryStatus.icon}
                <span className="font-semibold">{expiryStatus.text}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold text-base
                  hover:bg-gray-50 hover:border-gray-400 active:scale-95 transition-all duration-200"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={!batchData.mfgDate}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold text-base shadow-lg
                  hover:from-blue-600 hover:to-cyan-600 hover:shadow-xl hover:scale-105
                  active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                  transition-all duration-200"
              >
                <Save className="h-5 w-5" />
                บันทึก Batch
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
