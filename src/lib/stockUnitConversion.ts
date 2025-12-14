/**
 * Stock Unit Conversion Utilities
 *
 * Handles conversion between different product units and base units.
 * All stock is stored in BASE UNIT (smallest unit) in the database.
 *
 * Example:
 * - Product: น้ำดื่ม
 * - Units: ซอง (base, ×1), แพ็ค (×3), ลัง (×24)
 * - Stock: 42 ซอง (base)
 * - Display: "1 ลัง 6 แพ็ค"
 */

export interface ProductUnit {
  id: string;
  name: string;
  product_id: string;
  multiplier_to_base: number;
  is_base: boolean;
  sku?: string | null;
}

export interface SmartDisplayUnit {
  unitId: string;
  unitName: string;
  count: number;
  multiplier: number;
}

/**
 * Convert quantity from any unit to base unit
 *
 * @param quantity - Quantity in the specified unit
 * @param multiplier - The unit's multiplier_to_base value
 * @returns Quantity in base unit
 *
 * @example
 * // 2 boxes × 24 = 48 base units
 * convertToBaseUnit(2, 24) // => 48
 *
 * // 5 packs × 3 = 15 base units
 * convertToBaseUnit(5, 3) // => 15
 */
export function convertToBaseUnit(quantity: number, multiplier: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(multiplier)) {
    throw new Error('Quantity and multiplier must be finite numbers');
  }
  if (quantity < 0 || multiplier <= 0) {
    throw new Error('Quantity must be non-negative and multiplier must be positive');
  }
  return Math.floor(quantity * multiplier);
}

/**
 * Convert quantity from base unit to any unit
 *
 * @param baseQuantity - Quantity in base unit
 * @param multiplier - The target unit's multiplier_to_base value
 * @returns Quantity in target unit (with decimal)
 *
 * @example
 * // 48 base units ÷ 24 = 2 boxes
 * convertFromBaseUnit(48, 24) // => 2
 *
 * // 42 base units ÷ 3 = 14 packs
 * convertFromBaseUnit(42, 3) // => 14
 */
export function convertFromBaseUnit(baseQuantity: number, multiplier: number): number {
  if (!Number.isFinite(baseQuantity) || !Number.isFinite(multiplier)) {
    throw new Error('Base quantity and multiplier must be finite numbers');
  }
  if (baseQuantity < 0 || multiplier <= 0) {
    throw new Error('Base quantity must be non-negative and multiplier must be positive');
  }
  return baseQuantity / multiplier;
}

/**
 * Smart display: Convert base unit quantity to human-readable format
 * Shows largest units first, then breaks down to smaller units
 *
 * @param baseQuantity - Quantity in base unit
 * @param units - Array of all units for this product (will be sorted by multiplier)
 * @returns Array of units with their counts
 *
 * @example
 * // 42 base units with units: [ลัง (×24), แพ็ค (×3), ซอง (×1)]
 * smartDisplayStock(42, units)
 * // => [
 * //   { unitName: "ลัง", count: 1, multiplier: 24 },
 * //   { unitName: "แพ็ค", count: 6, multiplier: 3 }
 * // ]
 */
export function smartDisplayStock(
  baseQuantity: number,
  units: ProductUnit[]
): SmartDisplayUnit[] {
  if (baseQuantity === 0) {
    return [];
  }

  if (!Array.isArray(units) || units.length === 0) {
    throw new Error('Units array is required and must not be empty');
  }

  // Sort units by multiplier (largest first)
  const sortedUnits = [...units].sort((a, b) => b.multiplier_to_base - a.multiplier_to_base);

  const result: SmartDisplayUnit[] = [];
  let remaining = baseQuantity;

  for (const unit of sortedUnits) {
    if (remaining >= unit.multiplier_to_base) {
      const count = Math.floor(remaining / unit.multiplier_to_base);
      result.push({
        unitId: unit.id,
        unitName: unit.name,
        count,
        multiplier: unit.multiplier_to_base,
      });
      remaining = remaining % unit.multiplier_to_base;
    }
  }

  return result;
}

/**
 * Format smart display result as a readable string
 *
 * @param displayUnits - Result from smartDisplayStock()
 * @returns Formatted string (e.g., "1 ลัง 6 แพ็ค")
 */
export function formatSmartDisplay(displayUnits: SmartDisplayUnit[]): string {
  if (displayUnits.length === 0) {
    return '0';
  }
  return displayUnits.map(u => `${u.count} ${u.unitName}`).join(' ');
}

/**
 * Get the base unit from a list of units
 *
 * @param units - Array of product units
 * @returns The base unit (is_base = true)
 * @throws Error if no base unit found
 */
export function getBaseUnit(units: ProductUnit[]): ProductUnit {
  const baseUnit = units.find(u => u.is_base);
  if (!baseUnit) {
    throw new Error('No base unit found in units array');
  }
  return baseUnit;
}

/**
 * Check if there's enough stock for a sale
 *
 * @param currentBaseStock - Current stock in base units
 * @param requestedQuantity - Requested quantity in any unit
 * @param requestedUnitMultiplier - Multiplier of the requested unit
 * @returns Object with { hasEnough, available, requested, shortage }
 *
 * @example
 * // Current stock: 48 base units (2 boxes)
 * // Request: 3 boxes
 * checkStockAvailability(48, 3, 24)
 * // => { hasEnough: false, available: 48, requested: 72, shortage: 24 }
 */
export function checkStockAvailability(
  currentBaseStock: number,
  requestedQuantity: number,
  requestedUnitMultiplier: number
): {
  hasEnough: boolean;
  availableInBase: number;
  requestedInBase: number;
  shortageInBase: number;
} {
  const requestedInBase = convertToBaseUnit(requestedQuantity, requestedUnitMultiplier);
  const shortage = Math.max(0, requestedInBase - currentBaseStock);

  return {
    hasEnough: currentBaseStock >= requestedInBase,
    availableInBase: currentBaseStock,
    requestedInBase,
    shortageInBase: shortage,
  };
}

/**
 * Format stock availability message for user display
 *
 * @param availability - Result from checkStockAvailability
 * @param units - Array of product units for smart formatting
 * @returns Thai language message
 */
export function formatStockAvailabilityMessage(
  availability: ReturnType<typeof checkStockAvailability>,
  units: ProductUnit[]
): string {
  const availableDisplay = smartDisplayStock(availability.availableInBase, units);
  const requestedDisplay = smartDisplayStock(availability.requestedInBase, units);

  if (availability.hasEnough) {
    return `มีสต็อคเพียงพอ (มี: ${formatSmartDisplay(availableDisplay)})`;
  }

  const shortageDisplay = smartDisplayStock(availability.shortageInBase, units);
  return `สต็อคไม่พอ: ต้องการ ${formatSmartDisplay(requestedDisplay)} แต่มีเพียง ${formatSmartDisplay(availableDisplay)} (ขาด ${formatSmartDisplay(shortageDisplay)})`;
}

/**
 * Aggregate stock from multiple units into base unit
 * Useful when migrating old data that stored stock per unit
 *
 * @param stockByUnit - Array of { unitId, quantity }
 * @param units - Array of product units
 * @returns Total quantity in base unit
 */
export function aggregateStockToBase(
  stockByUnit: Array<{ unitId: string; quantity: number }>,
  units: ProductUnit[]
): number {
  let totalBase = 0;

  for (const stock of stockByUnit) {
    const unit = units.find(u => u.id === stock.unitId);
    if (!unit) {
      console.warn(`[aggregateStockToBase] Unit ${stock.unitId} not found, skipping`);
      continue;
    }
    totalBase += convertToBaseUnit(stock.quantity, unit.multiplier_to_base);
  }

  return totalBase;
}
