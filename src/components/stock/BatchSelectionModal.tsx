/**
 * Batch Selection Modal
 * Professional UI for selecting batch/lot when returning stock
 * FDA/GMP compliant design with FEFO visual indicators
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  XCircle,
  Package,
  Calendar,
  Clock,
  Layers,
  CheckCircle,     // ✅ เปลี่ยนจาก CheckCircle2 → CheckCircle (solid, ดูทางการกว่า)
  RefreshCw,
  TrendingDown,
  Info,
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import { useModal } from '@/contexts/ModalContext';

dayjs.extend(buddhistEra);
dayjs.locale('th');

// ============================================================================
// Types
// ============================================================================

interface BatchOption {
  id: string;
  lotNumber: string;
  mfgDate: string | null;
  expiryDate: string | null;
  initialQuantity: number | null;
  remainingQuantity: number | null;
  utilizationPercentage: number | null;
  note: string | null;
  createdAt: string;
  daysUntilExpiry: number | null;
  expiryStatus: 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (batch: BatchOption) => void;
  batches: BatchOption[];
  isLoading: boolean;
  productName: string;
  productCode: string;
  // Display units for smart quantity display
  displayUnits: Array<{
    unitId: string;
    unitName: string;
    count: number;
    multiplier: number;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getExpiryBadge(batch: BatchOption) {
  const { expiryStatus, daysUntilExpiry } = batch;

  if (expiryStatus === 'no_expiry' || !batch.expiryDate) {
    return {
      className: 'bg-gradient-to-r from-slate-400 to-slate-500 text-white',
      icon: '∞',
      label: 'ไม่หมดอายุ',
      priority: 4,
    };
  }

  if (expiryStatus === 'expired') {
    return {
      className: 'bg-gradient-to-r from-red-500 to-rose-600 text-white animate-pulse',
      icon: '❌',
      label: 'หมดอายุแล้ว',
      priority: 0,
    };
  }

  if (expiryStatus === 'critical') {
    return {
      className: 'bg-gradient-to-r from-orange-500 to-red-500 text-white',
      icon: '🔥',
      label: `เหลือ ${daysUntilExpiry} วัน`,
      priority: 1,
    };
  }

  if (expiryStatus === 'warning') {
    return {
      className: 'bg-gradient-to-r from-amber-400 to-orange-400 text-white',
      icon: '⚠️',
      label: `เหลือ ${daysUntilExpiry} วัน`,
      priority: 2,
    };
  }

  return {
    className: 'bg-gradient-to-r from-emerald-400 to-green-500 text-white',
    icon: '✓',
    label: `เหลือ ${daysUntilExpiry} วัน`,
    priority: 3,
  };
}

function formatSmartQuantity(
  quantityInBase: number,
  displayUnits: Array<{ unitName: string; multiplier: number }>
): string {
  if (!displayUnits || displayUnits.length === 0) {
    return quantityInBase.toLocaleString('th-TH');
  }

  const sortedUnits = [...displayUnits].sort((a, b) => b.multiplier - a.multiplier);
  let remaining = quantityInBase;
  const parts: string[] = [];

  for (const unit of sortedUnits) {
    if (remaining >= unit.multiplier) {
      const count = Math.floor(remaining / unit.multiplier);
      parts.push(`${count.toLocaleString('th-TH')} ${unit.unitName}`);
      remaining = remaining % unit.multiplier;
    }
  }

  return parts.length > 0 ? parts.join(' ') : `${quantityInBase.toLocaleString('th-TH')} (base)`;
}

// ============================================================================
// Main Component
// ============================================================================

export default function BatchSelectionModal({
  isOpen,
  onClose,
  onSelect,
  batches,
  isLoading,
  productName,
  productCode,
  displayUnits,
}: Props) {
  const { openModal, closeModal } = useModal();
  const MODAL_ID = 'batch-selection-modal';

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
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

  // Filter and sort batches: FEFO order (closest expiry first)
  // ✅ Separate available and expired/depleted batches
  const { availableBatches, expiredOrDepletedBatches } = useMemo(() => {
    const available = [...batches]
      .filter((batch) => {
        // ✅ Available: has remaining quantity AND not expired
        if (batch.remainingQuantity === 0) return false;
        if (batch.expiryStatus === 'expired') return false;
        return true;
      })
      .sort((a, b) => {
        // FEFO: Sort by expiry date (closest first)
        if (a.expiryDate && b.expiryDate) {
          return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        }

        // No expiry goes last
        if (!a.expiryDate && b.expiryDate) return 1;
        if (a.expiryDate && !b.expiryDate) return -1;

        // Tie-breaker: oldest batch first
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    const expiredOrDepleted = [...batches]
      .filter((batch) => {
        // ✅ Expired or depleted: no remaining quantity OR expired
        return batch.remainingQuantity === 0 || batch.expiryStatus === 'expired';
      })
      .sort((a, b) => {
        // Sort by creation date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return { availableBatches: available, expiredOrDepletedBatches: expiredOrDepleted };
  }, [batches]);

  const handleSelect = (batch: BatchOption) => {
    setSelectedBatchId(batch.id);
    onSelect(batch);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9998] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal - Optimized Size */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
        <div
          className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden bg-gradient-to-br from-white via-blue-50/30 to-sky-50/40 rounded-2xl shadow-2xl border border-blue-100/50 transform transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Sky Blue Gradient */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500 px-5 py-4 sm:px-6 sm:py-5">
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/25 backdrop-blur-sm text-white transition hover:bg-white/35 active:scale-95"
              aria-label="ปิด"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Title */}
            <div className="pr-12">
              <div className="flex items-center gap-2 mb-1.5">
                <Package className="h-5 w-5 text-white" />
                <h3 className="text-lg sm:text-xl font-bold text-white">
                  เลือก Batch/Lot คืนคลัง
                </h3>
              </div>
              <p className="text-sm text-white/90 font-medium truncate">
                {productName}
              </p>
              <p className="text-xs text-white/75 mt-0.5">
                รหัส: <span className="font-mono">{productCode}</span>
              </p>
            </div>

            {/* Info banner */}
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/15 backdrop-blur-sm border border-white/25 px-3 py-2">
              <Info className="h-4 w-4 text-white flex-shrink-0 mt-0.5" />
              <p className="text-xs text-white/95 leading-relaxed">
                <strong>FEFO:</strong> แสดง Batch ที่ใกล้หมดอายุก่อน
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(85vh-180px)] p-4 sm:p-5">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <RefreshCw className="h-12 w-12 text-indigo-500 animate-spin mb-4" />
                <p className="text-slate-600 font-medium">กำลังโหลด Batch...</p>
              </div>
            ) : availableBatches.length === 0 && expiredOrDepletedBatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-3">
                  <Package className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">ไม่พบข้อมูล Batch</p>
                <p className="text-xs text-slate-500">ยังไม่มี Batch ในระบบ</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* ============================================================ */}
                {/* Available Batches Section */}
                {/* ============================================================ */}
                {availableBatches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <h4 className="text-sm font-bold text-slate-900">
                        Batch ที่พร้อมใช้งาน
                      </h4>
                      <span className="ml-auto text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {availableBatches.length} รายการ
                      </span>
                    </div>
                    <div className="space-y-3">
                      {availableBatches.map((batch, index) => {
                  const isFEFO = index === 0 && batch.expiryDate;
                  const badge = getExpiryBadge(batch);
                  const isSelected = selectedBatchId === batch.id;
                  const hasQuantity = batch.remainingQuantity != null && batch.initialQuantity != null;

                  return (
                    <button
                      key={batch.id}
                      type="button"
                      onClick={() => handleSelect(batch)}
                      className="group w-full text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <div
                        className={`relative overflow-hidden rounded-xl border-2 p-4 ${
                          isFEFO
                            ? 'border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 shadow-md shadow-orange-200/50'
                            : isSelected
                            ? 'border-sky-400 bg-gradient-to-br from-sky-50 to-blue-50 shadow-md shadow-sky-200/50'
                            : 'border-blue-200 bg-white hover:border-sky-400 hover:shadow-md'
                        }`}
                      >
                        {/* FEFO Badge */}
                        {isFEFO && (
                          <div className="absolute -top-1 -right-1">
                            <div className="relative">
                              <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-50" />
                              <div className="relative inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-bold rounded-bl-xl rounded-tr-xl shadow-md">
                                ⚡ FEFO
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-sm">
                              <Package className="h-4.5 w-4.5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
                                Lot Number
                              </p>
                              <p className="font-mono font-bold text-base text-slate-900 truncate">
                                {batch.lotNumber}
                              </p>
                            </div>
                          </div>

                          {/* Expiry Badge */}
                          <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg ${badge.className} shadow-sm`}>
                            <div className="flex items-center gap-1">
                              <span className="text-xs">{badge.icon}</span>
                              <span className="text-[10px] font-bold whitespace-nowrap">{badge.label}</span>
                            </div>
                          </div>
                        </div>

                        {/* Dates - Compact */}
                        <div className="flex items-center gap-3 mb-3 text-xs text-slate-600">
                          {batch.mfgDate && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-sky-500" />
                              <span className="text-slate-500">MFG:</span>
                              <span className="font-semibold text-slate-900">
                                {dayjs(batch.mfgDate).format('D MMM')} {dayjs(batch.mfgDate).year() + 543}
                              </span>
                            </div>
                          )}
                          {batch.expiryDate && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-orange-500" />
                              <span className="text-slate-500">EXP:</span>
                              <span className="font-semibold text-slate-900">
                                {dayjs(batch.expiryDate).format('D MMM')} {dayjs(batch.expiryDate).year() + 543}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Quantity - Compact */}
                        {hasQuantity && (
                          <div className="rounded-lg bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 p-3">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="flex items-center gap-1.5">
                                <Layers className="h-4 w-4 text-sky-600" />
                                <span className="text-xs font-bold text-sky-900">คงเหลือ</span>
                              </div>
                              {batch.utilizationPercentage != null && (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/70">
                                  <TrendingDown className="h-3 w-3 text-slate-600" />
                                  <span className="text-[10px] font-bold text-slate-700">
                                    {batch.utilizationPercentage.toFixed(0)}%
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span
                                className={`text-lg font-bold ${
                                  (batch.remainingQuantity ?? 0) === 0
                                    ? 'text-red-600'
                                    : (batch.remainingQuantity ?? 0) < (batch.initialQuantity ?? 1) * 0.2
                                    ? 'text-orange-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {formatSmartQuantity(batch.remainingQuantity ?? 0, displayUnits)}
                              </span>
                              <span className="text-sm text-slate-400">/</span>
                              <span className="text-sm text-slate-600 font-semibold">
                                {formatSmartQuantity(batch.initialQuantity ?? 0, displayUnits)}
                              </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-2 h-1.5 bg-white/70 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  (batch.remainingQuantity ?? 0) === 0
                                    ? 'bg-gradient-to-r from-red-500 to-rose-600'
                                    : (batch.remainingQuantity ?? 0) < (batch.initialQuantity ?? 1) * 0.2
                                    ? 'bg-gradient-to-r from-orange-400 to-amber-500'
                                    : 'bg-gradient-to-r from-emerald-400 to-green-500'
                                }`}
                                style={{
                                  width: `${
                                    (batch.initialQuantity ?? 0) > 0
                                      ? ((batch.remainingQuantity ?? 0) / (batch.initialQuantity ?? 1)) * 100
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Note */}
                        {batch.note && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <p className="text-[10px] text-slate-600 italic leading-relaxed">{batch.note}</p>
                          </div>
                        )}

                        {/* Selected Indicator */}
                        {isSelected && (
                          <div className="absolute top-2.5 left-2.5">
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-sky-500 text-white text-[10px] font-bold rounded-md shadow">
                              <CheckCircle className="h-3 w-3" />
                              เลือกแล้ว
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                    </div>
                  </div>
                )}

                {/* ============================================================ */}
                {/* Expired/Depleted Batches Section */}
                {/* ============================================================ */}
                {expiredOrDepletedBatches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <h4 className="text-sm font-bold text-slate-900">
                        Batch ที่หมดแล้ว/หมดอายุ
                      </h4>
                      <span className="ml-auto text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        {expiredOrDepletedBatches.length} รายการ
                      </span>
                    </div>
                    <div className="space-y-3">
                      {expiredOrDepletedBatches.map((batch) => {
                        const badge = getExpiryBadge(batch);
                        const hasQuantity = batch.remainingQuantity != null && batch.initialQuantity != null;
                        const isDepleted = batch.remainingQuantity === 0;

                        return (
                          <div
                            key={batch.id}
                            className="relative overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-50/50 p-4 opacity-75"
                          >
                            {/* Status Badge */}
                            <div className="absolute -top-1 -right-1">
                              <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-slate-500 to-slate-600 text-white text-[10px] font-bold rounded-bl-xl rounded-tr-xl shadow-md">
                                {isDepleted ? '🚫 หมดแล้ว' : '❌ หมดอายุ'}
                              </div>
                            </div>

                            {/* Header */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-slate-400 to-slate-500 shadow-sm">
                                  <Package className="h-4.5 w-4.5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
                                    Lot Number
                                  </p>
                                  <p className="font-mono font-bold text-base text-slate-700 truncate">
                                    {batch.lotNumber}
                                  </p>
                                </div>
                              </div>

                              {/* Expiry Badge */}
                              <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg ${badge.className} shadow-sm`}>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs">{badge.icon}</span>
                                  <span className="text-[10px] font-bold whitespace-nowrap">{badge.label}</span>
                                </div>
                              </div>
                            </div>

                            {/* Dates */}
                            <div className="flex items-center gap-3 mb-3 text-xs text-slate-600">
                              {batch.mfgDate && (
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                  <span className="text-slate-500">MFG:</span>
                                  <span className="font-semibold text-slate-700">
                                    {dayjs(batch.mfgDate).format('D MMM')} {dayjs(batch.mfgDate).year() + 543}
                                  </span>
                                </div>
                              )}
                              {batch.expiryDate && (
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5 text-red-400" />
                                  <span className="text-slate-500">EXP:</span>
                                  <span className="font-semibold text-slate-700">
                                    {dayjs(batch.expiryDate).format('D MMM')} {dayjs(batch.expiryDate).year() + 543}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Quantity */}
                            {hasQuantity && (
                              <div className="rounded-lg bg-slate-100 border border-slate-200 p-3">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <Layers className="h-4 w-4 text-slate-600" />
                                    <span className="text-xs font-bold text-slate-700">คงเหลือ</span>
                                  </div>
                                  {batch.utilizationPercentage != null && (
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/70">
                                      <TrendingDown className="h-3 w-3 text-slate-600" />
                                      <span className="text-[10px] font-bold text-slate-700">
                                        {batch.utilizationPercentage.toFixed(0)}%
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                  <span className="text-lg font-bold text-slate-600">
                                    {formatSmartQuantity(batch.remainingQuantity ?? 0, displayUnits)}
                                  </span>
                                  <span className="text-sm text-slate-400">/</span>
                                  <span className="text-sm text-slate-600 font-semibold">
                                    {formatSmartQuantity(batch.initialQuantity ?? 0, displayUnits)}
                                  </span>
                                </div>

                                {/* Progress Bar */}
                                <div className="mt-2 h-1.5 bg-white/70 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-slate-400 to-slate-500 transition-all duration-300"
                                    style={{
                                      width: `${
                                        (batch.initialQuantity ?? 0) > 0
                                          ? ((batch.remainingQuantity ?? 0) / (batch.initialQuantity ?? 1)) * 100
                                          : 0
                                      }%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Note */}
                            {batch.note && (
                              <div className="mt-3 pt-3 border-t border-slate-200">
                                <p className="text-[10px] text-slate-600 italic leading-relaxed">{batch.note}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
