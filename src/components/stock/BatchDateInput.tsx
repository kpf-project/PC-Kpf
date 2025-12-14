/**
 * Batch Date Input Component - Beautiful Manual Entry
 * Modern UI with blue gradient theme
 */

'use client';

import { useState, useEffect } from 'react';
import { Calendar, Package, Clock, Info, CheckCircle2, Sparkles, X } from 'lucide-react';
import { daysUntilExpiry } from '@/lib/ocrDateExtractor';
import { useModal } from '@/contexts/ModalContext';
import { generateLotNumber } from '@/lib/lotNumberGenerator';
import dayjs from 'dayjs';
import 'dayjs/locale/th';

dayjs.locale('th');

// ============================================================================
// Types
// ============================================================================

export interface BatchDateData {
  lotNumber?: string;  // Lot/Batch number (auto-generated, optional for backward compatibility)
  mfgDate: string;    // YYYY-MM-DD
  expDate: string;    // YYYY-MM-DD
}

interface Props {
  value: BatchDateData;
  onChange: (data: BatchDateData) => void;
  onClose?: () => void; // Optional: for closing modal on mobile
  productCode: string; // Required: for auto-generating lot number with product prefix
  productName?: string; // Optional: for display in generated lot
}

// ============================================================================
// Main Component - Beautiful Blue Theme
// ============================================================================

export default function BatchDateInput({ value, onChange, onClose, productCode }: Props) {
  const daysLeft = value.expDate ? daysUntilExpiry(value.expDate) : null;
  const [isMobile, setIsMobile] = useState(false);
  const { openModal, closeModal } = useModal();

  // ✅ Auto-generate lot number when component mounts or productCode changes
  useEffect(() => {
    if (productCode && !value.lotNumber) {
      const autoLotNumber = generateLotNumber(productCode);
      onChange({ ...value, lotNumber: autoLotNumber });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productCode]); // Only run when productCode changes, not when value/onChange change (intentional)

  // Check if mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Control SiteNav visibility when modal opens/closes on mobile
  useEffect(() => {
    const MODAL_ID = 'batch-date-input';

    if (isMobile) {
      // Mobile: Open modal → hide SiteNav
      openModal(MODAL_ID);
    } else {
      // Desktop: Close modal → show SiteNav
      closeModal(MODAL_ID);
    }

    // Cleanup: Close modal when component unmounts
    return () => {
      closeModal(MODAL_ID);
    };
  }, [isMobile, openModal, closeModal]);

  // Handle close: Close modal first, then call onClose callback
  const handleClose = () => {
    closeModal('batch-date-input');
    onClose?.();
  };

  // Content component (same UI, different wrapper)
  const content = (
    <div className="space-y-5">
      {/* Header Section - Gradient Blue */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-sky-400 to-cyan-300 p-6 shadow-lg">
        {/* Decorative circles */}
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

        {/* Close button (mobile only) */}
        {isMobile && onClose && (
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border-2 border-white/40 text-white transition hover:bg-white/30 active:scale-95"
            aria-label="ปิด"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="relative flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/40 shadow-xl">
              <Calendar className="h-7 w-7 text-white" />
            </div>
          </div>

          {/* Title and Description */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
              วันที่ผลิตและหมดอายุ
              <Sparkles className="h-5 w-5 text-yellow-200" />
            </h3>
            <p className="text-sm text-white/90 leading-relaxed">
              กรอกวันหมดอายุเพื่อติดตาม FEFO (First Expired, First Out)
            </p>
          </div>
        </div>
      </div>

      {/* Lot Number Display Card (Auto-Generated - Read Only) */}
      {value.lotNumber && (
        <div className="group relative overflow-hidden rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-white via-emerald-50/50 to-green-50/30 p-5 shadow-md transition-all duration-200">
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/0 via-transparent to-green-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

          <div className="relative space-y-3">
            {/* Header with Icon */}
            <div className="flex items-center gap-2.5 text-sm font-bold text-emerald-700">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 shadow-md">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-base flex items-center gap-2">
                  Lot Number (สร้างอัตโนมัติ)
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </p>
                <p className="text-xs font-normal text-emerald-600">ระบบสร้างให้อัตโนมัติจาก Product + Timestamp</p>
              </div>
            </div>

            {/* Display Badge */}
            <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="font-mono text-base font-bold text-emerald-900">{value.lotNumber}</span>
            </div>

            {/* Info Text */}
            <div className="flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50/50 rounded-lg px-3 py-2">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Format:</strong> ProductCode-YYYYMMDD-HHmmss<br />
                <strong>ตัวอย่าง:</strong> BL01006-20250121-143530
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Date Input Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* MFG Date Card */}
        <div className="group relative overflow-hidden rounded-2xl border-2 border-sky-200 bg-gradient-to-br from-white via-sky-50/50 to-cyan-50/30 p-5 shadow-md transition-all duration-200 hover:shadow-lg hover:border-sky-300">
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-sky-400/0 via-transparent to-cyan-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

          <div className="relative space-y-3">
            {/* Label with Icon */}
            <label className="flex items-center gap-2.5 text-sm font-bold text-sky-700">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-400 shadow-md">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-base">วันที่ผลิต (MFG)</p>
                <p className="text-xs font-normal text-sky-600">ไม่บังคับ</p>
              </div>
            </label>

            {/* Date Input */}
            <input
              type="date"
              value={value.mfgDate}
              onChange={(e) => onChange({ ...value, mfgDate: e.target.value })}
              max={dayjs().format('YYYY-MM-DD')}
              className="w-full rounded-xl border-2 border-sky-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition-all duration-200
                focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 focus:outline-none
                hover:border-sky-300 hover:shadow-md"
            />

            {/* Status Badge */}
            {value.mfgDate && (
              <div className="flex items-center gap-2 rounded-lg bg-sky-100 px-3 py-2 text-xs font-semibold text-sky-700">
                <CheckCircle2 className="h-4 w-4" />
                กรอกแล้ว: {dayjs(value.mfgDate).locale('th').format('D MMM')} {dayjs(value.mfgDate).year() + 543}
              </div>
            )}
          </div>
        </div>

        {/* EXP Date Card */}
        <div className="group relative overflow-hidden rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-white via-indigo-50/50 to-purple-50/30 p-5 shadow-md transition-all duration-200 hover:shadow-lg hover:border-indigo-300">
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/0 via-transparent to-purple-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

          <div className="relative space-y-3">
            {/* Label with Icon */}
            <label className="flex items-center gap-2.5 text-sm font-bold text-indigo-700">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-md">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-base">วันหมดอายุ (EXP)</p>
                <p className="text-xs font-normal text-indigo-600">จำเป็น *</p>
              </div>
            </label>

            {/* Date Input */}
            <input
              type="date"
              value={value.expDate}
              onChange={(e) => onChange({ ...value, expDate: e.target.value })}
              min={value.mfgDate || dayjs().format('YYYY-MM-DD')}
              required
              className="w-full rounded-xl border-2 border-indigo-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition-all duration-200
                focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 focus:outline-none
                hover:border-indigo-300 hover:shadow-md"
            />

            {/* Status Badge with Days Left */}
            {value.expDate && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg bg-indigo-100 px-3 py-2 text-xs font-semibold text-indigo-700">
                  <CheckCircle2 className="h-4 w-4" />
                  กรอกแล้ว: {dayjs(value.expDate).locale('th').format('D MMM')} {dayjs(value.expDate).year() + 543}
                </div>

                {/* Days Until Expiry Badge */}
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold shadow-sm ${
                  daysLeft && daysLeft <= 7
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                    : daysLeft && daysLeft <= 30
                    ? 'bg-gradient-to-r from-orange-400 to-amber-500 text-white'
                    : 'bg-gradient-to-r from-emerald-400 to-green-500 text-white'
                }`}>
                  <Clock className="h-4 w-4" />
                  <span>
                    {daysLeft && daysLeft > 0
                      ? `เหลืออีก ${daysLeft} วัน`
                      : daysLeft && daysLeft === 0
                      ? 'หมดอายุวันนี้!'
                      : 'หมดอายุแล้ว!'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Helper Text */}
      <div className="rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-xs text-slate-600 space-y-1">
            <p><strong>Lot Number:</strong> ระบุเลขที่ Batch/Lot ของสินค้า (สินค้าที่มี Lot และวันหมดอายุเหมือนกันจะถูกรวมเป็น Batch เดียวกัน)</p>
            <p><strong>วันที่:</strong> คลิกที่ช่องวันที่เพื่อเปิดปฏิทินเลือกวัน หรือพิมพ์ตรงๆ ในรูปแบบ วว/ดด/ปปปป (เช่น 01/01/2026)</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Mobile: Show as fullscreen modal
  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm"
        onClick={handleClose} // Click backdrop to close
      >
        <div className="absolute inset-0 overflow-y-auto">
          <div className="min-h-full p-4 flex items-start justify-center">
            <div
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl my-8"
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
            >
              {content}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Show inline
  return content;
}
