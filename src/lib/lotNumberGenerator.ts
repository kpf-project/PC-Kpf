/**
 * Lot Number Generator Utility
 * Auto-generate lot numbers with various formats
 */

import dayjs from 'dayjs';

export type LotNumberFormat =
  | 'timestamp'        // LOT-20250121-143025
  | 'product-timestamp' // {ProductCode}-20250121-143025
  | 'simple'           // LOT-20250121-001
  | 'sequential';      // SEQ-{counter}

/**
 * Generate lot number with timestamp format
 * Format: LOT-YYYYMMDD-HHMMSS
 * Example: LOT-20250121-143025
 */
export function generateLotNumberTimestamp(): string {
  const now = dayjs();
  const date = now.format('YYYYMMDD');
  const time = now.format('HHmmss');
  return `LOT-${date}-${time}`;
}

/**
 * Generate lot number with product code prefix
 * Format: {ProductCode}-YYYYMMDD-HHMMSS
 * Example: BL0-1006-20250121-143025
 */
export function generateLotNumberWithProduct(productCode: string): string {
  const now = dayjs();
  const date = now.format('YYYYMMDD');
  const time = now.format('HHmmss');
  // Clean product code (remove spaces, special chars)
  const cleanCode = productCode.trim().replace(/\s+/g, '-');
  return `${cleanCode}-${date}-${time}`;
}

/**
 * Generate simple lot number (date only + random)
 * Format: LOT-YYYYMMDD-XXX
 * Example: LOT-20250121-A7F
 */
export function generateLotNumberSimple(): string {
  const now = dayjs();
  const date = now.format('YYYYMMDD');
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `LOT-${date}-${random}`;
}

/**
 * Generate lot number with custom prefix
 * Format: {prefix}-YYYYMMDD-HHMMSS
 * Example: BATCH-20250121-143025
 */
export function generateLotNumberCustom(prefix: string = 'LOT'): string {
  const now = dayjs();
  const date = now.format('YYYYMMDD');
  const time = now.format('HHmmss');
  return `${prefix}-${date}-${time}`;
}

/**
 * Main function - Auto-generate lot number (default format)
 * Can be configured to use different formats
 */
export function generateLotNumber(
  productCode?: string,
  format: LotNumberFormat = 'product-timestamp'
): string {
  switch (format) {
    case 'product-timestamp':
      return productCode
        ? generateLotNumberWithProduct(productCode)
        : generateLotNumberTimestamp();

    case 'timestamp':
      return generateLotNumberTimestamp();

    case 'simple':
      return generateLotNumberSimple();

    case 'sequential':
      // For sequential, would need database integration
      return generateLotNumberTimestamp();

    default:
      return generateLotNumberTimestamp();
  }
}

/**
 * Validate lot number format
 * Check if lot number follows standard format
 */
export function isValidLotNumber(lotNumber: string): boolean {
  if (!lotNumber || lotNumber.trim().length === 0) {
    return false;
  }

  // Allow any non-empty string, but warn if doesn't follow standard format
  const standardFormats = [
    /^LOT-\d{8}-\d{6}$/,           // LOT-20250121-143025
    /^[A-Z0-9-]+-\d{8}-\d{6}$/,    // BL0-1006-20250121-143025
    /^LOT-\d{8}-[A-Z0-9]{3}$/,     // LOT-20250121-A7F
  ];

  return standardFormats.some(regex => regex.test(lotNumber.trim()));
}

/**
 * Format lot number display (for UI)
 */
export function formatLotNumberDisplay(lotNumber: string): string {
  return lotNumber.trim().toUpperCase();
}
