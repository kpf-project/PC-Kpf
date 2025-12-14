/**
 * Sales Comparison Report Types
 * โครงสร้างข้อมูลสำหรับรายงานเปรียบเทียบยอดขายทั้งปี
 */

export type UnitType = 'Box' | 'Pack' | 'Piece';

/**
 * ยอดขายแยกตาม unit type สำหรับสินค้าหนึ่งรายการ
 */
export interface UnitTypeSales {
  /** จำนวนรวม (Box, Pack, หรือ Piece) */
  quantity: number;
  /** ราคาเฉลี่ย (average unit price) */
  avgPrice: number;
  /** ยอดขายรวม (total sales amount) */
  totalSales: number;
}

/**
 * ยอดขายรายเดือน (1 เดือน)
 */
export interface MonthlySales {
  /** เดือน (1-12) */
  month: number;
  /** ชื่อเดือนภาษาไทย */
  monthNameTH: string;
  /** ยอดขายรวมของเดือนนี้ */
  totalSales: number;
  /** ผลต่างจากเดือนก่อนหน้า (บาท) */
  diffAmount: number;
  /** ผลต่างจากเดือนก่อนหน้า (%) */
  diffPercent: number;
}

/**
 * ข้อมูลสินค้าแต่ละรายการในรายงาน
 */
export interface ProductSalesComparison {
  /** รหัสสินค้า */
  productCode: string;
  /** ชื่อสินค้า */
  productName: string;

  /** ยอดขายแยกตาม unit type */
  unitTypeSales: {
    box: UnitTypeSales;
    pack: UnitTypeSales;
    piece: UnitTypeSales;
  };

  /** ยอดขายรวมทั้งหมด (PC) */
  totalSalesAllUnits: number;

  /** ยอดขายรายเดือน (12 เดือน) */
  monthlySales: MonthlySales[];
}

/**
 * Request parameters สำหรับ API
 */
export interface SalesComparisonRequest {
  /** รหัสพนักงาน (required) */
  employeeId: string;
  /** รหัสร้านค้า (optional) */
  storeId?: string;
  /** ปี (พ.ศ. หรือ ค.ศ.) */
  year: number;
  /** รูปแบบ export */
  format?: 'json' | 'xlsx' | 'csv';
}

/**
 * Response structure
 */
export interface SalesComparisonResponse {
  /** สถานะความสำเร็จ */
  success: boolean;
  /** ข้อมูลรายงาน */
  data: {
    /** รายการสินค้าทั้งหมด */
    products: ProductSalesComparison[];
    /** ข้อมูล metadata */
    metadata: {
      /** รหัสพนักงาน */
      employeeId: string;
      /** ชื่อพนักงาน */
      employeeName: string;
      /** รหัสร้านค้า */
      storeId?: string;
      /** ชื่อร้านค้า */
      storeName?: string;
      /** ปีที่รายงาน */
      year: number;
      /** เดือนเริ่มต้น (1-12) */
      startMonth: number;
      /** เดือนสิ้นสุด (1-12) */
      endMonth: number;
      /** ชื่อเดือนเริ่มต้นภาษาไทย */
      startMonthName: string;
      /** ชื่อเดือนสิ้นสุดภาษาไทย */
      endMonthName: string;
      /** วันที่สร้างรายงาน */
      generatedAt: string;
      /** จำนวนสินค้าทั้งหมด */
      totalProducts: number;
      /** ยอดขายรวมทั้งปี */
      yearTotalSales: number;
    };
  };
  /** ข้อความ error (ถ้ามี) */
  error?: string;
}

/**
 * Raw data จาก Supabase query
 */
export interface SalesRecordRaw {
  product_code: string;
  product_name: string;
  unit_name: string; // Column name in database is unit_name, not unit_type
  quantity: number;
  unit_price: number;
  total: number;
  recorded_date: string; // YYYY-MM-DD
  employee_name: string;
  store_name: string;
}

/**
 * Aggregated data structure for processing
 */
export interface ProductAggregation {
  productCode: string;
  productName: string;
  // Group by unit_type
  byUnitType: {
    [key in UnitType]?: {
      totalQuantity: number;
      totalAmount: number;
      count: number;
    };
  };
  // Group by month (1-12)
  byMonth: {
    [month: number]: {
      totalAmount: number;
    };
  };
}
