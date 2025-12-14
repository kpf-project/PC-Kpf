/**
 * Sales Comparison Query Logic
 * ฟังก์ชันสำหรับดึงและคำนวณข้อมูลรายงานเปรียบเทียบยอดขาย
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SalesRecordRaw,
  ProductAggregation,
  ProductSalesComparison,
  MonthlySales,
  UnitTypeSales,
  
  SalesComparisonResponse,
} from '@/types/sales-comparison';

/**
 * ชื่อเดือนภาษาไทย
 */
const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * แปลงปี พ.ศ. เป็น ค.ศ. (ถ้าจำเป็น)
 */
function normalizeYear(year: number): number {
  // ถ้าปีมากกว่า 2500 ถือว่าเป็น พ.ศ. ให้แปลงเป็น ค.ศ.
  return year > 2500 ? year - 543 : year;
}

/**
 * Query ข้อมูลจาก Supabase
 *
 * @param supabase - Supabase client
 * @param employeeId - รหัสพนักงาน
 * @param year - ปี (พ.ศ. หรือ ค.ศ.)
 * @param storeId - รหัสร้านค้า (optional)
 * @param startMonth - เดือนเริ่มต้น (1-12, default: 1)
 * @param endMonth - เดือนสิ้นสุด (1-12, default: 12)
 * @returns Array of sales records
 */
export async function fetchSalesRecordsForYear(
  supabase: SupabaseClient,
  employeeName: string,
  year: number,
  storeName?: string,
  startMonth: number = 1,
  endMonth: number = 12
): Promise<SalesRecordRaw[]> {
  // Debug logging

  // แปลงปีเป็น ค.ศ.
  const normalizedYear = normalizeYear(year);

  // สร้าง date range สำหรับช่วงเดือนที่เลือก
  const startDate = `${normalizedYear}-${String(startMonth).padStart(2, '0')}-01`;
  // หาวันสุดท้ายของเดือนสิ้นสุด
  const lastDay = new Date(normalizedYear, endMonth, 0).getDate();
  const endDate = `${normalizedYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Build query
  let query = supabase
    .from('sales_records')
    .select('product_code, product_name, unit_name, quantity, unit_price, total, recorded_date, employee_name, store_name')
    .eq('employee_name', employeeName)
    .gte('recorded_date', startDate)
    .lte('recorded_date', endDate)
    .order('recorded_date', { ascending: true });

  // เพิ่ม filter store_name ถ้ามี
  if (storeName) {
    query = query.eq('store_name', storeName);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[fetchSalesRecordsForYear] Query error:', error);
    throw new Error(`Failed to fetch sales records: ${error.message}`);
  }


  // Debug: Log first 3 records to see unit_name values
  if (data && data.length > 0) {
  }

  return data || [];
}

/**
 * Aggregate sales data by product and calculate metrics
 *
 * @param records - Raw sales records from Supabase
 * @returns Map of product aggregations
 */
export function aggregateSalesByProduct(
  records: SalesRecordRaw[]
): Map<string, ProductAggregation> {
  const aggregationMap = new Map<string, ProductAggregation>();
  const unitTypeMappings = new Map<string, string[]>(); // Track original -> standardized mappings

  for (const record of records) {
    const key = record.product_code;

    // สร้าง aggregation object ถ้ายังไม่มี
    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, {
        productCode: record.product_code,
        productName: record.product_name,
        byUnitType: {},
        byMonth: {},
      });
    }

    const agg = aggregationMap.get(key)!;

    // Standardize unit type before aggregation
    const standardizedUnitType = standardizeUnitType(record.unit_name);

    // Track mapping for debugging
    if (standardizedUnitType) {
      const mapKey = `${record.unit_name} -> ${standardizedUnitType}`;
      if (!unitTypeMappings.has(mapKey)) {
        unitTypeMappings.set(mapKey, []);
      }
      unitTypeMappings.get(mapKey)!.push(record.product_name);
    }

    // Only aggregate if we can map to a standard unit type
    if (standardizedUnitType) {
      if (!agg.byUnitType[standardizedUnitType]) {
        agg.byUnitType[standardizedUnitType] = {
          totalQuantity: 0,
          totalAmount: 0,
          count: 0,
        };
      }
      agg.byUnitType[standardizedUnitType]!.totalQuantity += record.quantity;
      agg.byUnitType[standardizedUnitType]!.totalAmount += record.total;
      agg.byUnitType[standardizedUnitType]!.count += 1;
    } else {
      console.warn(`[aggregateSalesByProduct] Unknown unit name: "${record.unit_name}" for product ${record.product_code}`);
    }

    // Aggregate by month
    const month = parseInt(record.recorded_date.split('-')[1], 10);
    if (!agg.byMonth[month]) {
      agg.byMonth[month] = { totalAmount: 0 };
    }
    agg.byMonth[month].totalAmount += record.total;
  }

  // Log unit type mappings for debugging

  // Log aggregation results for first product

  return aggregationMap;
}

/**
 * แปลงชื่อหน่วยเป็นประเภทมาตรฐาน (Box, Pack, Piece)
 * ใช้ logic เดียวกับ standardizeUnits ในหน้า sales report
 */
function standardizeUnitType(unitType: string): 'Box' | 'Pack' | 'Piece' | null {
  const unitTypeLower = unitType.toLowerCase().trim();

  // Box: กล่อง, box, ลัง
  if (unitTypeLower.includes('กล่อง') || unitTypeLower.includes('box') || unitTypeLower.includes('ลัง')) {
    return 'Box';
  }

  // Pack: แพ็ค, pack, แพค
  if (unitTypeLower.includes('แพ็ค') || unitTypeLower.includes('pack') || unitTypeLower.includes('แพค')) {
    return 'Pack';
  }

  // Piece: ซอง, ชิ้น, ปี๊บ, piece
  if (unitTypeLower.includes('ซอง') || unitTypeLower.includes('ชิ้น') || unitTypeLower.includes('ปี๊บ') || unitTypeLower.includes('piece')) {
    return 'Piece';
  }

  return null;
}

/**
 * คำนวณยอดขายแยกตาม unit type
 */
function calculateUnitTypeSales(
  unitTypeData: { totalQuantity: number; totalAmount: number; count: number } | undefined
): UnitTypeSales {
  if (!unitTypeData) {
    return {
      quantity: 0,
      avgPrice: 0,
      totalSales: 0,
    };
  }

  return {
    quantity: unitTypeData.totalQuantity,
    avgPrice: unitTypeData.count > 0
      ? Math.round(unitTypeData.totalAmount / unitTypeData.totalQuantity)
      : 0,
    totalSales: Math.round(unitTypeData.totalAmount),
  };
}

/**
 * คำนวณยอดขายรายเดือนพร้อมผลต่าง
 */
function calculateMonthlySales(
  byMonth: { [month: number]: { totalAmount: number } }
): MonthlySales[] {
  const monthlySales: MonthlySales[] = [];
  let previousMonthSales = 0;

  for (let month = 1; month <= 12; month++) {
    const currentMonthSales = byMonth[month]?.totalAmount || 0;

    // เดือนมกราคม (เดือนแรก) ไม่มีข้อมูลเปรียบเทียบ
    let diffAmount = 0;
    let diffPercent = 0;

    if (month > 1) {
      diffAmount = currentMonthSales - previousMonthSales;

      // สูตรมาตรฐาน: ((ยอดใหม่ - ยอดเก่า) / ยอดเก่า) × 100
      // ป้องกันการหารด้วย 0
      if (previousMonthSales !== 0) {
        diffPercent = Math.round(((currentMonthSales - previousMonthSales) / previousMonthSales) * 10000) / 100;
      }
    }

    monthlySales.push({
      month,
      monthNameTH: THAI_MONTH_NAMES[month - 1],
      totalSales: Math.round(currentMonthSales),
      diffAmount: Math.round(diffAmount),
      diffPercent: diffPercent,
    });

    previousMonthSales = currentMonthSales;
  }

  return monthlySales;
}

/**
 * แปลง aggregation เป็น report structure
 */
export function transformToReportStructure(
  aggregationMap: Map<string, ProductAggregation>
): ProductSalesComparison[] {
  const products: ProductSalesComparison[] = [];

  for (const [, agg] of aggregationMap) {
    // คำนวณยอดขายแยกตาม unit type
    const boxSales = calculateUnitTypeSales(agg.byUnitType['Box']);
    const packSales = calculateUnitTypeSales(agg.byUnitType['Pack']);
    const pieceSales = calculateUnitTypeSales(agg.byUnitType['Piece']);

    // คำนวณยอดขายรวมทั้งหมด
    const totalSalesAllUnits = Math.round(
      boxSales.totalSales + packSales.totalSales + pieceSales.totalSales
    );

    // คำนวณยอดขายรายเดือน
    const monthlySales = calculateMonthlySales(agg.byMonth);

    products.push({
      productCode: agg.productCode,
      productName: agg.productName,
      unitTypeSales: {
        box: boxSales,
        pack: packSales,
        piece: pieceSales,
      },
      totalSalesAllUnits,
      monthlySales,
    });
  }

  // เรียงตาม product_code
  products.sort((a, b) => a.productCode.localeCompare(b.productCode));

  return products;
}

/**
 * คำนวณ metadata สำหรับรายงาน
 */
export function calculateReportMetadata(
  products: ProductSalesComparison[],
  employeeId: string,
  employeeName: string,
  year: number,
  storeId?: string,
  storeName?: string,
  startMonth: number = 1,
  endMonth: number = 12,
  employeeCode?: string | null,
  phone?: string | null,
  region?: string | null,
  regularDayOff?: string | null
) {
  const yearTotalSales = products.reduce(
    (sum, p) => sum + p.totalSalesAllUnits,
    0
  );

  return {
    employeeId,
    employeeName,
    employeeCode,
    phone,
    region,
    regularDayOff,
    storeId,
    storeName,
    year,
    startMonth,
    endMonth,
    startMonthName: THAI_MONTH_NAMES[startMonth - 1],
    endMonthName: THAI_MONTH_NAMES[endMonth - 1],
    generatedAt: new Date().toISOString(),
    totalProducts: products.length,
    yearTotalSales: Math.round(yearTotalSales),
  };
}

/**
 * Main function: Generate full sales comparison report
 *
 * @param supabase - Supabase client
 * @param employeeId - รหัสพนักงาน
 * @param employeeName - ชื่อพนักงาน
 * @param year - ปี (พ.ศ. หรือ ค.ศ.)
 * @param storeId - รหัสร้านค้า (optional)
 * @param storeName - ชื่อร้านค้า (optional)
 * @returns Complete report data
 */
export async function generateSalesComparisonReport(
  supabase: SupabaseClient,
  employeeId: string,
  employeeName: string,
  year: number,
  storeId?: string,
  storeName?: string,
  startMonth: number = 1,
  endMonth: number = 12,
  employeeCode?: string | null,
  phone?: string | null,
  region?: string | null,
  regularDayOff?: string | null
): Promise<{ products: ProductSalesComparison[]; metadata: SalesComparisonResponse['data']['metadata'] }> {
  // 1. Fetch raw data from Supabase
  const records = await fetchSalesRecordsForYear(supabase, employeeName, year, storeName, startMonth, endMonth);

  // 2. Aggregate data by product
  const aggregationMap = aggregateSalesByProduct(records);

  // 3. Transform to report structure
  const products = transformToReportStructure(aggregationMap);

  // 4. Calculate metadata
  const metadata = calculateReportMetadata(
    products,
    employeeId,
    employeeName,
    year,
    storeId,
    storeName,
    startMonth,
    endMonth,
    employeeCode,
    phone,
    region,
    regularDayOff
  );

  return { products, metadata };
}
