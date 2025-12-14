/**
 * Batch Grouping Utilities
 * จัดกลุ่ม batches ตาม product + expiry date เพื่อแสดงผลใน UI
 * Database ยังแยก lots อยู่ตามมาตรฐาน (1 receipt = 1 lot)
 */

import dayjs from 'dayjs';
import 'dayjs/locale/th';

dayjs.locale('th');

// ============================================================================
// Types
// ============================================================================

export interface Batch {
  id: string;
  lotNumber: string;
  mfgDate: string | null;
  expiryDate: string | null;
  initialQuantity: number | null;
  note: string | null;
  createdAt: string;
  daysUntilExpiry: number | null;
  expiryStatus: 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry';
}

export interface BatchGroup {
  // Grouping key
  productId: string;
  expiryDate: string | null;

  // Aggregated data
  totalQuantity: number;
  batchCount: number;

  // FEFO info
  oldestBatch: Batch;  // แนะนำใช้ก่อน (FEFO)
  newestBatch: Batch;  // ล่าสุด

  // Expiry status (worst case)
  worstExpiryStatus: 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry';
  daysUntilExpiry: number | null;

  // All batches in this group
  batches: Batch[];
}

// ============================================================================
// Main Function: Group Batches
// ============================================================================

export function groupBatches(batches: Batch[]): BatchGroup[] {
  if (!batches || batches.length === 0) return [];

  // Group by expiry_date (null = ไม่มีวันหมดอายุ)
  const groups = new Map<string, Batch[]>();

  for (const batch of batches) {
    const key = batch.expiryDate || 'no_expiry';

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(batch);
  }

  // Convert to BatchGroup array
  const result: BatchGroup[] = [];

  for (const [expiryDate, batchList] of groups.entries()) {
    // Sort by created_at (oldest first = FEFO)
    const sortedBatches = [...batchList].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const oldestBatch = sortedBatches[0];
    const newestBatch = sortedBatches[sortedBatches.length - 1];

    // Calculate total quantity
    const totalQuantity = sortedBatches.reduce(
      (sum, b) => sum + (b.initialQuantity || 0),
      0
    );

    // Determine worst expiry status
    const worstStatus = getWorstExpiryStatus(sortedBatches);

    result.push({
      productId: oldestBatch.id, // ใช้ batch แรกเป็น key
      expiryDate: expiryDate === 'no_expiry' ? null : expiryDate,
      totalQuantity,
      batchCount: sortedBatches.length,
      oldestBatch,
      newestBatch,
      worstExpiryStatus: worstStatus,
      daysUntilExpiry: oldestBatch.daysUntilExpiry,
      batches: sortedBatches,
    });
  }

  // Sort groups by expiry date (earliest first = FEFO)
  result.sort((a, b) => {
    // No expiry → last
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;

    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });

  return result;
}

// ============================================================================
// Helper: Get Worst Expiry Status
// ============================================================================

function getWorstExpiryStatus(
  batches: Batch[]
): 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry' {
  const statusPriority = {
    'expired': 4,
    'critical': 3,
    'warning': 2,
    'ok': 1,
    'no_expiry': 0,
  };

  let worstStatus: 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry' = 'no_expiry';
  let worstPriority = -1;

  for (const batch of batches) {
    const priority = statusPriority[batch.expiryStatus];
    if (priority > worstPriority) {
      worstPriority = priority;
      worstStatus = batch.expiryStatus;
    }
  }

  return worstStatus;
}

// ============================================================================
// Helper: Format Expiry Date Display
// ============================================================================

export function formatExpiryDate(dateStr: string | null): string {
  if (!dateStr) return 'ไม่มีวันหมดอายุ';
  const date = dayjs(dateStr);
  return `${date.format('D MMM')} ${date.year() + 543}`;
}

// ============================================================================
// Helper: Get FEFO Badge
// ============================================================================

export function getFEFOBadge(batch: Batch): {
  className: string;
  icon: string;
  label: string;
} {
  const { expiryStatus, daysUntilExpiry } = batch;

  switch (expiryStatus) {
    case 'expired':
      return {
        className: 'bg-gradient-to-r from-red-500 to-red-600 text-white',
        icon: '⚫',
        label: 'หมดอายุแล้ว',
      };
    case 'critical':
      return {
        className: 'bg-gradient-to-r from-orange-500 to-red-500 text-white animate-pulse',
        icon: '🔴',
        label: `เหลือ ${daysUntilExpiry} วัน`,
      };
    case 'warning':
      return {
        className: 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white',
        icon: '🟡',
        label: `เหลือ ${daysUntilExpiry} วัน`,
      };
    case 'ok':
      return {
        className: 'bg-gradient-to-r from-green-400 to-emerald-500 text-white',
        icon: '🟢',
        label: `เหลือ ${daysUntilExpiry} วัน`,
      };
    default:
      return {
        className: 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-700',
        icon: '⚪',
        label: 'ไม่มีข้อมูล',
      };
  }
}
