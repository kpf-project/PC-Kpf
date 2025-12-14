/**
 * Batch Detail Modal
 * แสดงรายละเอียด batch ทั้งหมดของสินค้า พร้อม FEFO suggestion
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Package,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,      // ✅ เปลี่ยนจาก CheckCircle2 → CheckCircle (solid, ดูทางการกว่า)
  TrendingUp,
  Archive,
  ChevronDown,
  ChevronUp,
  MinusCircle,      // ✅ เปลี่ยนจาก PackageX → MinusCircle (วงกลมลบ, ดูทางการ)
  Ban,              // ✅ เพิ่ม Ban (วงกลมห้าม) สำหรับหมดอายุ
  ShieldCheck       // ✅ เพิ่ม ShieldCheck (โล่ติ๊กถูก) ดูทางการมาก
} from 'lucide-react';
import { useModal } from '@/contexts/ModalContext';
import { getFEFOBadge } from '@/lib/batchGrouping';
import { smartDisplayStock, type ProductUnit } from '@/lib/stockUnitConversion';
import dayjs from 'dayjs';
import 'dayjs/locale/th';

dayjs.locale('th');

// ============================================================================
// Types
// ============================================================================

interface Batch {
  id: string;
  lotNumber: string;
  mfgDate: string | null;
  expiryDate: string | null;
  initialQuantity: number | null;
  remainingQuantity: number | null; // NEW: Level 2 tracking
  utilizationPercentage: number | null; // NEW: % used
  note: string | null;
  createdAt: string;
  daysUntilExpiry: number | null;
  expiryStatus: 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productCode: string;
  productName: string;
  employeeId: string;
  storeId: string;
  productUnits?: ProductUnit[];  // ✅ Optional: ส่งมาจาก parent
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusBadge(status: string, days: number | null) {
  const baseClass = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm";

  switch (status) {
    case 'expired':
      return {
        className: `${baseClass} bg-gradient-to-r from-red-500 to-red-600 text-white`,
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        label: '⚫ หมดอายุแล้ว',
      };
    case 'critical':
      return {
        className: `${baseClass} bg-gradient-to-r from-orange-500 to-red-500 text-white animate-pulse`,
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        label: `🔴 เหลือ ${days} วัน`,
      };
    case 'warning':
      return {
        className: `${baseClass} bg-gradient-to-r from-yellow-400 to-orange-400 text-white`,
        icon: <Clock className="w-3.5 h-3.5" />,
        label: `🟡 เหลือ ${days} วัน`,
      };
    case 'ok':
      return {
        className: `${baseClass} bg-gradient-to-r from-green-400 to-emerald-500 text-white`,
        icon: <CheckCircle className="w-3.5 h-3.5" />,
        label: `🟢 เหลือ ${days} วัน`,
      };
    default:
      return {
        className: `${baseClass} bg-gradient-to-r from-gray-300 to-gray-400 text-gray-700`,
        icon: <Package className="w-3.5 h-3.5" />,
        label: '⚪ ไม่มีข้อมูล',
      };
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = dayjs(dateStr);
  return `${date.format('D MMM')} ${date.year() + 543}`;
}

// Format quantity with smart unit display (e.g., "5 ลัง 8 แพ็ค 3 ซอง")
function formatSmartQuantity(
  baseQuantity: number | null,
  units: ProductUnit[]
): string {
  if (baseQuantity == null || baseQuantity === 0) return '0';
  if (units.length === 0) return baseQuantity.toLocaleString('th-TH');

  const displayUnits = smartDisplayStock(baseQuantity, units);

  if (displayUnits.length === 0) {
    return baseQuantity.toLocaleString('th-TH');
  }

  return displayUnits
    .map(u => `${u.count.toLocaleString('th-TH')} ${u.unitName}`)
    .join(' ');
}

// ============================================================================
// Main Component
// ============================================================================

export default function BatchDetailModal({
  isOpen,
  onClose,
  productId,
  productCode,
  productName,
  employeeId,
  storeId,
  productUnits = [],  // ✅ รับจาก props, default เป็น empty array
}: Props) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false); // ✅ State for toggling archived section
  const { openModal, closeModal } = useModal();

  // Control SiteNav visibility when modal opens/closes
  useEffect(() => {
    const MODAL_ID = 'batch-detail-modal';

    if (isOpen) {
      // Modal opened → hide SiteNav
      openModal(MODAL_ID);
    } else {
      // Modal closed → show SiteNav
      closeModal(MODAL_ID);
    }

    // Cleanup: close modal when component unmounts
    return () => {
      closeModal(MODAL_ID);
    };
  }, [isOpen, openModal, closeModal]);

  const fetchBatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        productId,
        employeeId,
        storeId,
      });

      const response = await fetch(`/api/stock/batches/by-product?${params}`);
      const data = await response.json();

      if (data.success) {
        setBatches(data.data.batches);
      } else {
        console.error('[BatchDetailModal] API error:', data.error);
      }
    } catch (error) {
      console.error('[BatchDetailModal] Error fetching batches:', error);
    } finally {
      setIsLoading(false);
    }
  }, [productId, employeeId, storeId]);

  useEffect(() => {
    if (isOpen && productId) {
      fetchBatches();
    }
  }, [isOpen, productId, fetchBatches]);

  // ============================================================================
  // Separate batches into Active and Archived
  // ============================================================================

  // Active Batches: ยังมีของเหลือ และยังไม่หมดอายุ
  const activeBatches = [...batches]
    .filter(b => (b.remainingQuantity ?? 0) > 0 && b.expiryStatus !== 'expired')
    .sort((a, b) => {
      // FEFO: Sort by expiry date (closest first)
      if (a.expiryDate && b.expiryDate) {
        const dateA = new Date(a.expiryDate).getTime();
        const dateB = new Date(b.expiryDate).getTime();
        if (dateA !== dateB) return dateA - dateB;
      }
      // No expiry goes last
      if (!a.expiryDate && b.expiryDate) return 1;
      if (a.expiryDate && !b.expiryDate) return -1;
      // Tie-breaker: oldest first
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  // Archived Batches: หมดแล้ว หรือ หมดอายุแล้ว
  const archivedBatches = [...batches]
    .filter(b => b.remainingQuantity === 0 || b.expiryStatus === 'expired')
    .sort((a, b) => {
      // Sort by updated_at/created_at (most recent first for audit trail)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // FEFO Logic: First Expired, First Out (from active batches only)
  const fefoSuggestion = activeBatches.find(b => b.expiryDate); // First one with expiry date

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal - Mobile optimized */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div
          className="bg-white w-full sm:max-w-2xl sm:rounded-3xl shadow-2xl
          max-h-[92vh] sm:max-h-[90vh]
          rounded-t-3xl sm:rounded-b-3xl
          overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Compact on mobile */}
          <div className="bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-300 p-3 sm:p-5 relative flex-shrink-0">
            <button
              onClick={onClose}
              className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2 rounded-full bg-white/20 hover:bg-white/30 transition backdrop-blur-sm"
              aria-label="ปิด"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>

            <div className="flex items-center gap-2 sm:gap-3 pr-8 sm:pr-10">
              <div className="p-1.5 sm:p-2 bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl flex-shrink-0">
                <Package className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-xl font-bold text-white break-words leading-tight">
                  {productName}
                </h2>
                <p className="text-sky-50 text-[10px] sm:text-xs break-words mt-0.5">
                  รหัส: {productCode}
                </p>
              </div>
            </div>
          </div>

          {/* Content - Optimized scrolling */}
          <div className="p-3 sm:p-5 overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-sky-400 border-t-transparent"></div>
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-gray-500">ยังไม่มีข้อมูล batch</p>
              </div>
            ) : (
              <div className="space-y-2.5 sm:space-y-3">
                {/* FEFO Suggestion - Mobile optimized */}
                {fefoSuggestion && (
                  <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border-2 border-orange-300 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-md">
                    {/* Decorative background - hidden on mobile */}
                    <div className="hidden sm:block absolute -right-6 -top-6 w-24 h-24 bg-orange-200/30 rounded-full blur-2xl" />
                    <div className="hidden sm:block absolute -left-6 -bottom-6 w-24 h-24 bg-yellow-200/30 rounded-full blur-2xl" />

                    <div className="relative">
                      {/* Header - Compact on mobile */}
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                        <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg sm:rounded-xl shadow-sm flex-shrink-0">
                          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-orange-900 text-sm sm:text-base leading-tight">
                            ⚡ FEFO: แนะนำใช้ก่อน
                          </h3>
                          <p className="hidden sm:inline text-[10px] text-orange-600">
                            First Expired, First Out
                          </p>
                        </div>
                      </div>

                      {/* Lot Info - Compact */}
                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="text-[10px] sm:text-xs text-orange-600 font-medium">Lot:</span>
                          <span className="font-mono font-bold text-orange-900 text-sm sm:text-lg">
                            {fefoSuggestion.lotNumber}
                          </span>
                        </div>

                        {/* Expiry Badge - Inline on mobile */}
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold shadow-sm ${getFEFOBadge(fefoSuggestion).className}`}>
                            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span>
                              {getFEFOBadge(fefoSuggestion).icon} {getFEFOBadge(fefoSuggestion).label}
                            </span>
                          </div>

                          <div className="text-[10px] sm:text-xs text-orange-700">
                            {formatDate(fefoSuggestion.expiryDate)}
                          </div>

                          {/* Stock Status - inline on mobile */}
                          {fefoSuggestion.remainingQuantity != null && (
                            <div className="text-[10px] sm:text-xs text-orange-700">
                              • คงเหลือ <span className="font-semibold">{formatSmartQuantity(fefoSuggestion.remainingQuantity, productUnits)}</span>
                              {fefoSuggestion.initialQuantity != null && (
                                <span className="text-orange-600">
                                  {' '}/ {formatSmartQuantity(fefoSuggestion.initialQuantity, productUnits)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Reason - only desktop */}
                        <div className="hidden sm:block pt-2 border-t border-orange-200">
                          <p className="text-xs text-orange-600 leading-relaxed">
                            💡 <strong>ทำไม:</strong> หมดอายุเร็วที่สุด หรือรับเข้ามาเก่าที่สุด
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================================ */}
                {/* Active Batches Section - Professional Sky Blue Theme */}
                {/* ============================================================================ */}
                <div className="space-y-2 sm:space-y-2.5">
                  {/* Active Section Header */}
                  <div className="flex items-center justify-between gap-2 sticky top-0 bg-gradient-to-r from-sky-50 to-cyan-50 backdrop-blur-sm py-2 px-3 sm:px-4 -mx-3 sm:-mx-5 rounded-xl border-2 border-sky-200 shadow-sm z-10">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-lg shadow-sm">
                        <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sky-900 text-xs sm:text-sm leading-tight">
                          ✅ Batch ที่ใช้งานได้
                        </h3>
                        <p className="text-[9px] sm:text-[10px] text-sky-600 leading-tight">
                          คงเหลือ และยังไม่หมดอายุ
                        </p>
                      </div>
                    </div>
                    <span className="flex items-center justify-center min-w-[32px] h-7 sm:h-8 px-2.5 bg-sky-500 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm">
                      {activeBatches.length}
                    </span>
                  </div>

                  {/* Active Batches List */}
                  {activeBatches.length === 0 ? (
                    <div className="text-center py-6 sm:py-8 px-4 rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/30">
                      <Package className="w-10 h-10 sm:w-12 sm:h-12 text-sky-300 mx-auto mb-2" />
                      <p className="text-xs sm:text-sm text-sky-600 font-medium">ไม่มี Batch ที่ใช้งานได้</p>
                    </div>
                  ) : (
                    activeBatches.map((batch) => {
                    const badge = getStatusBadge(batch.expiryStatus, batch.daysUntilExpiry);
                    const isFEFO = fefoSuggestion?.id === batch.id;

                    return (
                      <div
                        key={batch.id}
                        className={`border-2 rounded-lg sm:rounded-xl p-2.5 sm:p-3 transition ${
                          isFEFO
                            ? 'border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 shadow-sm'
                            : 'border-gray-200 bg-gradient-to-br from-white to-sky-50/20 hover:border-sky-300'
                        }`}
                      >
                        {/* Lot Number & Status - Compact */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-mono font-bold text-gray-900 text-sm sm:text-base break-words">
                                {batch.lotNumber}
                              </p>
                              {isFEFO && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gradient-to-r from-orange-400 to-amber-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full shadow-sm">
                                  ⚡
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`${badge.className} flex-shrink-0`}>
                            {badge.icon}
                            <span className="hidden sm:inline">{badge.label}</span>
                            <span className="sm:hidden text-[10px]">{batch.daysUntilExpiry ? `${batch.daysUntilExpiry}d` : badge.label}</span>
                          </span>
                        </div>

                        {/* Dates - Compact inline on mobile */}
                        <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-[10px] sm:text-xs text-gray-600 mb-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-600 flex-shrink-0" />
                            <span className="text-gray-500">MFG:</span>
                            <span className="font-semibold text-gray-900">
                              {formatDate(batch.mfgDate)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-600 flex-shrink-0" />
                            <span className="text-gray-500">EXP:</span>
                            <span className="font-semibold text-gray-900">
                              {formatDate(batch.expiryDate)}
                            </span>
                          </div>
                        </div>

                        {/* NEW: Stock Status - Remaining vs Initial with Progress Bar */}
                        {batch.initialQuantity != null && batch.remainingQuantity != null && (
                          <div className="space-y-1.5 mb-2">
                            {/* Stock Numbers */}
                            <div className="flex items-center justify-between text-[10px] sm:text-xs">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-gray-500">คงเหลือ:</span>
                                <span className={`font-bold ${
                                  batch.remainingQuantity === 0
                                    ? 'text-red-600'
                                    : batch.remainingQuantity < batch.initialQuantity * 0.2
                                    ? 'text-orange-600'
                                    : 'text-emerald-600'
                                }`}>
                                  {formatSmartQuantity(batch.remainingQuantity, productUnits)}
                                </span>
                                <span className="text-gray-400">/</span>
                                <span className="text-gray-700">{formatSmartQuantity(batch.initialQuantity, productUnits)}</span>
                              </div>

                              {/* Utilization Badge */}
                              {batch.utilizationPercentage != null && (
                                <span className={`px-2 py-0.5 rounded-full font-semibold ${
                                  batch.utilizationPercentage === 100
                                    ? 'bg-red-100 text-red-700'
                                    : batch.utilizationPercentage >= 80
                                    ? 'bg-orange-100 text-orange-700'
                                    : batch.utilizationPercentage >= 50
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {batch.utilizationPercentage}% ใช้แล้ว
                                </span>
                              )}
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  (batch.utilizationPercentage ?? 0) === 100
                                    ? 'bg-red-500'
                                    : (batch.utilizationPercentage ?? 0) >= 80
                                    ? 'bg-orange-500'
                                    : (batch.utilizationPercentage ?? 0) >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${batch.utilizationPercentage ?? 0}%` }}
                              />
                            </div>

                            {/* Sold Out Badge */}
                            {batch.remainingQuantity === 0 && (
                              <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 border border-red-200 rounded-md text-[9px] sm:text-[10px] font-bold text-red-700">
                                ⚫ ขายหมดแล้ว
                              </div>
                            )}
                          </div>
                        )}

                        {/* Note - Compact */}
                        {batch.note && (
                          <p className="text-[9px] sm:text-[10px] text-gray-500 pt-1.5 border-t border-gray-200 italic break-words leading-snug">
                            {batch.note}
                          </p>
                        )}
                      </div>
                    );
                  })
                  )}
                </div>

                {/* ============================================================================ */}
                {/* Archived Batches Section - Professional Slate Gray Theme */}
                {/* ============================================================================ */}
                {archivedBatches.length > 0 && (
                  <div className="space-y-2 sm:space-y-2.5 mt-3 sm:mt-4">
                    {/* Archived Section Toggle Button */}
                    <button
                      type="button"
                      onClick={() => setShowArchived(!showArchived)}
                      className="w-full flex items-center justify-between gap-2 bg-gradient-to-r from-slate-100 to-gray-100 hover:from-slate-200 hover:to-gray-200 py-2.5 px-3 sm:px-4 rounded-xl border-2 border-slate-300 shadow-sm transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-slate-400 to-gray-500 rounded-lg shadow-sm">
                          <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-slate-800 text-xs sm:text-sm leading-tight">
                            📦 Batch ที่หมดแล้ว/หมดอายุ
                          </h3>
                          <p className="text-[9px] sm:text-[10px] text-slate-600 leading-tight">
                            เก็บไว้ดู audit trail
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center min-w-[32px] h-7 sm:h-8 px-2.5 bg-slate-500 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm">
                          {archivedBatches.length}
                        </span>
                        {showArchived ? (
                          <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
                        )}
                      </div>
                    </button>

                    {/* Archived Batches List (Collapsible) */}
                    {showArchived && (
                      <div className="space-y-2 sm:space-y-2.5 pl-2 sm:pl-3 border-l-4 border-slate-300">
                        {archivedBatches.map((batch) => {
                          const badge = getStatusBadge(batch.expiryStatus, batch.daysUntilExpiry);
                          const isExpired = batch.expiryStatus === 'expired';
                          const isSoldOut = batch.remainingQuantity === 0;

                          return (
                            <div
                              key={batch.id}
                              className="border-2 border-slate-300 rounded-lg sm:rounded-xl p-2.5 sm:p-3 bg-gradient-to-br from-slate-50 to-gray-50 opacity-75"
                            >
                              {/* Lot Number & Status - Compact */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-mono font-bold text-slate-700 text-sm sm:text-base break-words">
                                      {batch.lotNumber}
                                    </p>
                                    {/* Status Icon Badge */}
                                    {isSoldOut && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-slate-400 to-gray-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full shadow-sm">
                                        <MinusCircle className="w-3 h-3" />
                                        หมด
                                      </span>
                                    )}
                                    {isExpired && !isSoldOut && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[9px] sm:text-[10px] font-bold rounded-full shadow-sm">
                                        <Ban className="w-3 h-3" />
                                        หมดอายุ
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className={`${badge.className} flex-shrink-0 opacity-60`}>
                                  {badge.icon}
                                  <span className="hidden sm:inline">{badge.label}</span>
                                  <span className="sm:hidden text-[10px]">{batch.daysUntilExpiry ? `${batch.daysUntilExpiry}d` : badge.label}</span>
                                </span>
                              </div>

                              {/* Dates - Compact inline on mobile */}
                              <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-[10px] sm:text-xs text-slate-600 mb-2">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 flex-shrink-0" />
                                  <span className="text-slate-500">MFG:</span>
                                  <span className="font-semibold text-slate-700">
                                    {formatDate(batch.mfgDate)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 flex-shrink-0" />
                                  <span className="text-slate-500">EXP:</span>
                                  <span className="font-semibold text-slate-700">
                                    {formatDate(batch.expiryDate)}
                                  </span>
                                </div>
                              </div>

                              {/* Stock Status - Remaining vs Initial */}
                              {batch.initialQuantity != null && batch.remainingQuantity != null && (
                                <div className="space-y-1.5 mb-2">
                                  <div className="flex items-center justify-between text-[10px] sm:text-xs">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-slate-500">คงเหลือ:</span>
                                      <span className="font-bold text-slate-600">
                                        {formatSmartQuantity(batch.remainingQuantity, productUnits)}
                                      </span>
                                      <span className="text-slate-400">/</span>
                                      <span className="text-slate-600">{formatSmartQuantity(batch.initialQuantity, productUnits)}</span>
                                    </div>

                                    {/* Utilization Badge */}
                                    {batch.utilizationPercentage != null && (
                                      <span className="px-2 py-0.5 rounded-full font-semibold bg-slate-200 text-slate-700 text-[10px]">
                                        {batch.utilizationPercentage}% ใช้แล้ว
                                      </span>
                                    )}
                                  </div>

                                  {/* Progress Bar - Grayscale */}
                                  <div className="w-full bg-slate-200 rounded-full h-1.5 sm:h-2 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-slate-400 transition-all"
                                      style={{ width: `${batch.utilizationPercentage ?? 0}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Note - Compact */}
                              {batch.note && (
                                <p className="text-[9px] sm:text-[10px] text-slate-500 pt-1.5 border-t border-slate-200 italic break-words leading-snug">
                                  {batch.note}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
