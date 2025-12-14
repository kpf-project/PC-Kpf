/**
 * StockInventoryCard - Professional stock display component
 * Displays inventory with smart unit breakdown + expiry tracking
 * Performance: React.memo to prevent unnecessary re-renders
 */

import React from "react";
import Image from "next/image";
import { Package, Clock, ChevronRight, Calendar, AlertTriangle } from "lucide-react";
import dayjs from 'dayjs';
import 'dayjs/locale/th';

dayjs.locale('th');

interface StockInventoryCardProps {
  productCode: string;
  productName: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  displayText: string; // Smart display (e.g., "2 ลัง 2 แพ็ค")
  displayUnits: Array<{
    unitName: string;
    count: number;
  }>;
  quantityInBase: number;
  updatedAt: string;
  // Batch/Expiry tracking
  nearestExpiry?: {
    expiryDate: string | null;  // ✅ Allow NULL
    daysUntilExpiry: number | null;
    expiryStatus: 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry';
  } | null;
  totalBatches?: number;
  onViewDetails?: () => void;
  onViewBatch?: () => void;
}

export const StockInventoryCard = React.memo(function StockInventoryCard({
  productCode,
  productName,
  companyName,
  companyLogoUrl,
  displayText,
  displayUnits,
  quantityInBase,
  updatedAt,
  nearestExpiry,
  totalBatches,
  onViewDetails,
  onViewBatch,
}: StockInventoryCardProps) {

  // Determine stock status color
  const getStockStatus = () => {
    if (quantityInBase === 0) return { color: "red", label: "หมดสต็อค" };
    if (quantityInBase <= 10) return { color: "amber", label: "สต็อคต่ำ" };
    return { color: "emerald", label: "พร้อมขาย" };
  };

  const status = getStockStatus();

  // Sort units by size (largest first)
  const sortedDisplayUnits = [...displayUnits].sort((a, b) => {
    const unitOrder = ["ลัง", "แพ็ค", "ซอง", "ปี๊บ", "กล่อง", "ชิ้น", "ขวด", "ถุง", "แกลลอน", "ถัง"];
    const indexA = unitOrder.indexOf(a.unitName);
    const indexB = unitOrder.indexOf(b.unitName);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.unitName.localeCompare(b.unitName, 'th');
  });

  // Get expiry badge (gradient blue theme)
  const getExpiryBadge = () => {
    if (!nearestExpiry) return null;

    const { expiryStatus, daysUntilExpiry } = nearestExpiry;

    switch (expiryStatus) {
      case 'expired':
        return {
          className: "bg-gradient-to-r from-red-500 to-red-600 text-white",
          icon: <AlertTriangle className="w-3 h-3" />,
          label: "หมดอายุแล้ว",
        };
      case 'critical':
        return {
          className: "bg-gradient-to-r from-orange-500 to-red-500 text-white animate-pulse",
          icon: <AlertTriangle className="w-3 h-3" />,
          label: `🔴 ${daysUntilExpiry} วัน`,
        };
      case 'warning':
        return {
          className: "bg-gradient-to-r from-yellow-400 to-orange-400 text-white",
          icon: <Clock className="w-3 h-3" />,
          label: `🟡 ${daysUntilExpiry} วัน`,
        };
      case 'ok':
        return {
          className: "bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-300 text-white",
          icon: <Calendar className="w-3 h-3" />,
          label: `${daysUntilExpiry} วัน`,
        };
      case 'no_expiry':
        return {
          className: "bg-gradient-to-r from-gray-400 to-slate-500 text-white",
          icon: <Package className="w-3 h-3" />,
          label: "ไม่มีวันหมดอายุ (FIFO)",
        };
      default:
        return null;
    }
  };

  const expiryBadge = getExpiryBadge();

  return (
    <div className="group relative rounded-2xl border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/30 p-3 sm:p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-lg w-full max-w-full box-border overflow-hidden">
      {/* Company Logo / Product Icon */}
      <div className="mb-2.5 sm:mb-3 flex items-start gap-2.5 sm:gap-3 min-w-0">
        <div className="flex-shrink-0">
          {companyLogoUrl ? (
            <div className="relative h-10 w-10 sm:h-12 sm:w-12 overflow-hidden bg-transparent">
              <Image
                src={companyLogoUrl}
                alt={companyName || "Company"}
                fill
                className="object-contain mix-blend-multiply"
                sizes="(max-width: 640px) 40px, 48px"
                loading="lazy"
                placeholder="empty"
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Product Code + Status Badge in same row */}
          <div className="flex items-center gap-1.5 mb-1 min-w-0 flex-wrap">
            <h3 className="text-sm font-bold text-slate-900 flex-shrink-0">
              {productCode}
            </h3>
            <div
              className={`rounded-lg px-1.5 py-0.5 text-[10px] font-bold border whitespace-nowrap flex-shrink-0 ${
                status.color === "emerald"
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : status.color === "amber"
                    ? "bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-red-100 text-red-700 border-red-200"
              }`}
            >
              {status.label}
            </div>
          </div>

          <p className="text-sm sm:text-base text-slate-700 break-words leading-snug min-w-0">
            {productName}
          </p>
          {companyName && (
            <p className="text-[10px] sm:text-xs font-medium text-blue-600 mt-0.5 break-words min-w-0">
              {companyName}
            </p>
          )}
        </div>
      </div>

      {/* Stock Display - Smart Format */}
      <div className="rounded-xl bg-white/70 p-2.5 sm:p-3 backdrop-blur-sm max-w-full overflow-hidden">
        <p className="text-xs font-medium text-slate-600 mb-2">คงเหลือ</p>

        {/* Unit Breakdown - Primary Display */}
        {sortedDisplayUnits.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 max-w-full">
            {sortedDisplayUnits.map((unit, idx) => (
              <div
                key={idx}
                className="inline-flex items-baseline gap-1 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 px-2 py-0.5 sm:px-2.5 sm:py-1 shadow-sm flex-shrink-0"
              >
                <span className="text-base sm:text-lg font-bold text-white">{unit.count}</span>
                <span className="text-xs sm:text-sm font-medium text-white">{unit.unitName}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xl sm:text-2xl font-bold text-blue-900">
            {displayText || "0"}
          </p>
        )}

        {/* Base Unit Reference */}
        <p className="mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
          ({quantityInBase.toLocaleString("th-TH")} หน่วยฐาน)
        </p>
      </div>

      {/* Expiry Badge - Enhanced with FEFO/FIFO info */}
      {(expiryBadge || (totalBatches && totalBatches > 0)) && (
        <div className="mt-2.5 sm:mt-3">
          <button
            onClick={onViewBatch}
            className={`${expiryBadge?.className || 'bg-gradient-to-r from-slate-400 to-gray-500 text-white'} rounded-xl px-3 py-2 w-full flex items-center justify-between shadow-md hover:shadow-lg transition-all group/expiry`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {expiryBadge?.icon || <Package className="w-3 h-3" />}
              <div className="text-left min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-[10px] font-medium opacity-90">
                    {nearestExpiry?.expiryStatus === 'no_expiry' ? 'Batch Info' : 'วันหมดอายุใกล้สุด'}
                  </p>
                  {totalBatches && totalBatches > 1 && (
                    <span className="text-[9px] font-semibold bg-white/20 px-1.5 py-0.5 rounded-full">
                      {totalBatches} lots
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold truncate">
                  {expiryBadge?.label || `${totalBatches} batch(es)`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {nearestExpiry && (
                <span className="text-[10px] font-semibold bg-white/25 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/20">
                  {nearestExpiry.expiryStatus === 'no_expiry' ? 'FIFO' : totalBatches && totalBatches > 1 ? 'FEFO' : 'FEFO'}
                </span>
              )}
              <ChevronRight className="w-4 h-4 group-hover/expiry:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      )}

      {/* Footer: Updated Time */}
      <div className="mt-2.5 sm:mt-3 flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
        <div className="flex items-center gap-1 truncate">
          <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
          <span className="truncate">
            {new Date(updatedAt).toLocaleDateString("th-TH", {
              day: "numeric",
              month: "short",
              year: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="flex items-center gap-1 font-medium text-blue-600 transition hover:text-blue-700 flex-shrink-0"
          >
            <span className="hidden sm:inline">ดูรายละเอียด</span>
            <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </button>
        )}
      </div>

      {/* Hover Effect Indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-300 opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-render control
  // Only re-render if these key props change
  return (
    prevProps.productCode === nextProps.productCode &&
    prevProps.quantityInBase === nextProps.quantityInBase &&
    prevProps.updatedAt === nextProps.updatedAt &&
    prevProps.nearestExpiry?.expiryDate === nextProps.nearestExpiry?.expiryDate &&
    prevProps.nearestExpiry?.expiryStatus === nextProps.nearestExpiry?.expiryStatus
  );
});

/**
 * StockInventoryTable - Desktop table view with expiry tracking
 */
interface StockInventoryTableProps {
  items: Array<{
    productId: string;
    productCode: string;
    productName: string;
    companyName?: string | null;
    companyLogoUrl?: string | null;
    displayText: string;
    displayUnits: Array<{ unitName: string; count: number }>;
    quantityInBase: number;
    updatedAt: string;
    nearestExpiry?: {
      expiryDate: string | null;  // ✅ Allow NULL
      daysUntilExpiry: number | null;
      expiryStatus: 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry';
    } | null;
    totalBatches?: number;
  }>;
  onViewDetails?: (productId: string) => void;
  onViewBatch?: (productId: string) => void;
}

export const StockInventoryTable = React.memo(function StockInventoryTable({ items, onViewDetails, onViewBatch }: StockInventoryTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-blue-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400 text-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                สินค้า
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                คงเหลือ
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                สถานะ
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                วันหมดอายุ
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                อัพเดท
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide w-20">
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100">
            {items.map((item) => {
              const status =
                item.quantityInBase === 0
                  ? { color: "red", label: "หมดสต็อค" }
                  : item.quantityInBase <= 10
                    ? { color: "amber", label: "สต็อคต่ำ" }
                    : { color: "emerald", label: "พร้อมขาย" };

              const getExpiryBadge = () => {
                if (!item.nearestExpiry) return null;

                const { expiryStatus, daysUntilExpiry } = item.nearestExpiry;

                switch (expiryStatus) {
                  case 'expired':
                    return { className: "bg-gradient-to-r from-red-500 to-red-600 text-white", label: "หมดอายุ" };
                  case 'critical':
                    return { className: "bg-gradient-to-r from-orange-500 to-red-500 text-white animate-pulse", label: `🔴 ${daysUntilExpiry} วัน` };
                  case 'warning':
                    return { className: "bg-gradient-to-r from-yellow-400 to-orange-400 text-white", label: `🟡 ${daysUntilExpiry} วัน` };
                  case 'ok':
                    return { className: "bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-300 text-white", label: `${daysUntilExpiry} วัน` };
                  case 'no_expiry':
                    return { className: "bg-gradient-to-r from-gray-400 to-slate-500 text-white", label: "ไม่มีหมดอายุ (FIFO)" };
                  default:
                    return null;
                }
              };

              const expiryBadge = getExpiryBadge();

              return (
                <tr
                  key={item.productId}
                  className="transition-colors hover:bg-blue-50/50"
                >
                  {/* Product Info */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {item.companyLogoUrl ? (
                        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden bg-transparent">
                          <Image
                            src={item.companyLogoUrl}
                            alt={item.companyName || "Company"}
                            fill
                            className="object-contain mix-blend-multiply"
                            sizes="40px"
                            loading="lazy"
                            placeholder="empty"
                          />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-100 to-blue-100">
                          <Package className="h-5 w-5 text-blue-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-900">
                          {item.productCode}
                        </p>
                        <p className="text-sm text-slate-700">{item.productName}</p>
                        {item.companyName && (
                          <p className="text-xs text-blue-600">{item.companyName}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Stock Display */}
                  <td className="px-4 py-4 text-right">
                    <div className="inline-block text-left">
                      <p className="text-xl font-bold text-blue-900">
                        {item.displayText}
                      </p>
                      <p className="text-xs text-slate-500">
                        ({item.quantityInBase.toLocaleString("th-TH")} หน่วยฐาน)
                      </p>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4 text-center">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        status.color === "emerald"
                          ? "bg-emerald-100 text-emerald-700"
                          : status.color === "amber"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {status.label}
                    </span>
                  </td>

                  {/* Expiry Badge */}
                  <td className="px-4 py-4 text-center">
                    {(expiryBadge || (item.totalBatches && item.totalBatches > 0)) ? (
                      <button
                        onClick={() => onViewBatch?.(item.productId)}
                        className={`${expiryBadge?.className || 'bg-gradient-to-r from-slate-400 to-gray-500 text-white'} inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm hover:shadow-md transition`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        {expiryBadge?.label || `${item.totalBatches} batch`}
                        {item.totalBatches && item.totalBatches > 1 && (
                          <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
                            {item.totalBatches}
                          </span>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>

                  {/* Updated */}
                  <td className="px-4 py-4 text-right text-sm text-slate-600">
                    {new Date(item.updatedAt).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-4 text-center">
                    {onViewDetails && (
                      <button
                        onClick={() => onViewDetails(item.productId)}
                        className="text-blue-600 transition hover:text-blue-700"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if items array reference changes or length changes
  // React Query already handles deep equality for data
  return (
    prevProps.items === nextProps.items ||
    (prevProps.items.length === nextProps.items.length &&
     prevProps.items.every((item, index) =>
       item.productId === nextProps.items[index]?.productId &&
       item.quantityInBase === nextProps.items[index]?.quantityInBase &&
       item.updatedAt === nextProps.items[index]?.updatedAt
     ))
  );
});
