import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import type { ProductCatalogItem } from "@/lib/supabaseProducts";

// Debug mode - only log in development
const DEBUG_IMPORT = process.env.NODE_ENV === 'development';

// CSV/Excel column headers
const PRODUCT_HEADERS = {
  code: "รหัสสินค้า",
  name: "ชื่อสินค้า",
  description: "คำอธิบาย",
  companyName: "บริษัท",
  isActive: "สถานะใช้งาน",
  unitName: "หน่วย",
  unitSku: "SKU",
  unitIsBase: "หน่วยฐาน",
  unitMultiplier: "ตัวคูณ",
};

export type ProductImportRow = {
  code: string;
  name: string;
  description?: string;
  companyName?: string;
  isActive: boolean;
  units: Array<{
    name: string;
    sku?: string;
    isBase: boolean;
    multiplierToBase: number;
  }>;
};

/**
 * Parse CSV content into product import data
 */
export function parseProductsCsv(csvContent: string): ProductImportRow[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true, // Handle UTF-8 BOM
  }) as Array<Record<string, string>>;

  // Debug: Show available columns
  if (DEBUG_IMPORT && records.length > 0) {
    const firstRecord = records[0]!;
    const availableColumns = Object.keys(firstRecord);
    console.log("[CSV Parser] Available columns:", availableColumns);
    console.log("[CSV Parser] Expected headers:", Object.values(PRODUCT_HEADERS));

    // Check if all expected headers exist
    const missingHeaders = Object.values(PRODUCT_HEADERS).filter(h => !availableColumns.includes(h));
    if (missingHeaders.length > 0) {
      console.error("[CSV Parser] ❌ Missing headers:", missingHeaders);
    }
  }

  const productsMap = new Map<string, ProductImportRow>();

  for (let i = 0; i < records.length; i++) {
    const record = records[i]!;
    const rowNumber = i + 2; // +2 because: 0-indexed + 1 for header row
    const code = record[PRODUCT_HEADERS.code]?.trim();
    const name = record[PRODUCT_HEADERS.name]?.trim();
    const description = record[PRODUCT_HEADERS.description]?.trim() || undefined;
    const companyName = record[PRODUCT_HEADERS.companyName]?.trim() || undefined;
    const isActive = record[PRODUCT_HEADERS.isActive]?.trim().toLowerCase() !== "ไม่ใช้งาน";
    const unitName = record[PRODUCT_HEADERS.unitName]?.trim();
    const unitSku = record[PRODUCT_HEADERS.unitSku]?.trim() || undefined;

    // Support multiple formats for base unit: "ใช่", "yes", "y", "true", "1"
    const unitIsBaseValue = record[PRODUCT_HEADERS.unitIsBase]?.trim().toLowerCase();
    const unitIsBase = ["ใช่", "yes", "y", "true", "1"].includes(unitIsBaseValue);

    const unitMultiplier = parseFloat(record[PRODUCT_HEADERS.unitMultiplier] || "1");

    // Debug: log if base unit value is not recognized
    if (DEBUG_IMPORT && unitIsBaseValue && !unitIsBase && unitIsBaseValue !== "ไม่ใช่" && unitIsBaseValue !== "no" && unitIsBaseValue !== "false" && unitIsBaseValue !== "0") {
      console.warn(`[CSV Row ${rowNumber}] Unrecognized base unit value: "${unitIsBaseValue}" (raw: "${record[PRODUCT_HEADERS.unitIsBase]}") for product: ${name}`);
    }

    // Debug: Check if row will be skipped
    if (!code || !name || !unitName) {
      if (DEBUG_IMPORT) {
        console.warn(`[CSV Row ${rowNumber}] ⚠️ SKIPPED - Missing required fields:`, {
          code: code || "(empty)",
          name: name || "(empty)",
          unitName: unitName || "(empty)",
          rawRecord: record
        });
      }
      continue; // Skip invalid rows
    }

    // Debug: Log successful parse
    if (DEBUG_IMPORT) {
      console.log(`[CSV Row ${rowNumber}] ✅ Parsed: ${code} | ${name} | ${unitName} | isBase: ${unitIsBase}`);
    }


    let product = productsMap.get(code);
    if (!product) {
      product = {
        code,
        name,
        description,
        companyName,
        isActive,
        units: [],
      };
      productsMap.set(code, product);
    }

    // Add unit
    product.units.push({
      name: unitName,
      sku: unitSku,
      isBase: unitIsBase,
      multiplierToBase: unitMultiplier,
    });
  }

  return Array.from(productsMap.values());
}

/**
 * Parse Excel workbook into product import data
 */
export async function parseProductsExcel(buffer: ArrayBuffer): Promise<ProductImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // Try to find the data worksheet (look for "ข้อมูลสินค้า" first, then fallback to first sheet)
  let worksheet = workbook.getWorksheet("ข้อมูลสินค้า");
  if (!worksheet) {
    // Fallback to first worksheet
    worksheet = workbook.getWorksheet(1);
  }

  if (!worksheet) {
    throw new Error("ไม่พบ worksheet ในไฟล์ Excel");
  }

  if (DEBUG_IMPORT) {
    console.log(`[Excel Parser] Using worksheet: "${worksheet.name}", Row count: ${worksheet.rowCount}`);
  }

  const productsMap = new Map<string, ProductImportRow>();
  let processedRows = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row

    const code = row.getCell(1).text.trim();
    const name = row.getCell(2).text.trim();
    const description = row.getCell(3).text.trim() || undefined;
    const companyName = row.getCell(4).text.trim() || undefined;
    const isActiveText = row.getCell(5).text.trim().toLowerCase();
    const isActive = isActiveText !== "ไม่ใช้งาน";
    const unitName = row.getCell(6).text.trim();
    const unitSku = row.getCell(7).text.trim() || undefined;

    // Support multiple formats for base unit: "ใช่", "yes", "y", "true", "1"
    const unitIsBaseText = row.getCell(8).text.trim().toLowerCase();
    const unitIsBase = ["ใช่", "yes", "y", "true", "1"].includes(unitIsBaseText);

    const unitMultiplier = parseFloat(row.getCell(9).text) || 1;

    // Debug: log if row is skipped
    if (!code || !name || !unitName) {
      if (DEBUG_IMPORT) {
        console.warn(`[Excel Row ${rowNumber}] ⚠️ SKIPPED - Missing required fields:`, {
          code: code || "(empty)",
          name: name || "(empty)",
          unitName: unitName || "(empty)",
          allCells: [
            row.getCell(1).text,
            row.getCell(2).text,
            row.getCell(3).text,
            row.getCell(4).text,
            row.getCell(5).text,
            row.getCell(6).text,
            row.getCell(7).text,
            row.getCell(8).text,
            row.getCell(9).text,
          ]
        });
      }
      return; // Skip invalid rows
    }

    // Debug: Log successful parse
    if (DEBUG_IMPORT) {
      console.log(`[Excel Row ${rowNumber}] ✅ Parsed: ${code} | ${name} | ${unitName} | isBase: ${unitIsBase}`);
    }

    processedRows++;
    let product = productsMap.get(code);
    if (!product) {
      product = {
        code,
        name,
        description,
        companyName,
        isActive,
        units: [],
      };
      productsMap.set(code, product);
    }

    // Add unit
    product.units.push({
      name: unitName,
      sku: unitSku,
      isBase: unitIsBase,
      multiplierToBase: unitMultiplier,
    });
  });

  const products = Array.from(productsMap.values());

  if (DEBUG_IMPORT) {
    console.log(`[Excel Parser] Processed ${processedRows} rows, created ${products.length} products`);
  }

  return products;
}

/**
 * Export products to CSV format with UTF-8 BOM
 */
export function exportProductsCsv(products: ProductCatalogItem[]): string {
  const rows: Record<string, string | number | boolean>[] = [];

  for (const product of products) {
    for (const unit of product.units) {
      rows.push({
        [PRODUCT_HEADERS.code]: product.code,
        [PRODUCT_HEADERS.name]: product.name,
        [PRODUCT_HEADERS.description]: product.description || "",
        [PRODUCT_HEADERS.companyName]: product.companyName || "",
        [PRODUCT_HEADERS.isActive]: product.isActive ? "ใช้งาน" : "ไม่ใช้งาน",
        [PRODUCT_HEADERS.unitName]: unit.name,
        [PRODUCT_HEADERS.unitSku]: unit.sku || "",
        [PRODUCT_HEADERS.unitIsBase]: unit.isBase ? "ใช่" : "ไม่ใช่",
        [PRODUCT_HEADERS.unitMultiplier]: unit.multiplierToBase,
      });
    }
  }

  // Add UTF-8 BOM prefix
  const csv = stringify(rows, {
    header: true,
    columns: Object.values(PRODUCT_HEADERS),
    bom: true,
  });

  return "\uFEFF" + csv; // UTF-8 BOM
}

/**
 * Export products to Excel format with enhanced template
 * Features:
 * - Instructions sheet with usage guide
 * - Example sheet with sample data
 * - Data validation (dropdowns) for consistent input
 * - Color-coded required fields
 * - Frozen header row and auto-filter
 * - Cell comments for guidance
 */
export async function exportProductsExcel(products: ProductCatalogItem[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();

  // ========================================
  // Sheet 1: คำแนะนำ (Instructions)
  // ========================================
  const instructionsSheet = workbook.addWorksheet("คำแนะนำ", {
    views: [{ state: "frozen", ySplit: 0 }],
  });

  instructionsSheet.columns = [
    { width: 60 },
  ];

  // Title
  const titleRow = instructionsSheet.addRow(["📋 คำแนะนำการใช้งาน Template นำเข้าสินค้า"]);
  titleRow.font = { size: 16, bold: true, color: { argb: "FF1E40AF" } };
  titleRow.height = 30;
  instructionsSheet.mergeCells("A1:A1");

  instructionsSheet.addRow([""]);

  // Instructions content
  const instructions = [
    "🔹 วิธีการใช้งาน:",
    "  1. เปิดแผ่นงาน 'ข้อมูลสินค้า' เพื่อดูข้อมูลปัจจุบัน",
    "  2. เปิดแผ่นงาน 'ตัวอย่าง' เพื่อดูรูปแบบการกรอกข้อมูล",
    "  3. แก้ไขหรือเพิ่มข้อมูลในแผ่นงาน 'ข้อมูลสินค้า'",
    "  4. บันทึกไฟล์และอัปโหลดกลับเข้าระบบ",
    "",
    "🔹 คำอธิบายคอลัมน์:",
    "  • รหัสสินค้า (*): รหัสเฉพาะของสินค้า ห้ามซ้ำกัน (เช่น P001, COFFEE-01)",
    "  • ชื่อสินค้า (*): ชื่อเต็มของสินค้า (เช่น น้ำดื่ม, กาแฟสำเร็จรูป)",
    "  • คำอธิบาย: รายละเอียดเพิ่มเติมของสินค้า (ไม่บังคับ)",
    "  • บริษัท: ชื่อบริษัท (ไม่บังคับ)",
    "  • สถานะใช้งาน (*): เลือกจาก dropdown → ใช้งาน หรือ ไม่ใช้งาน",
    "  • หน่วย (*): ชื่อหน่วยขาย (เช่น กล่อง, แพ็ค, ขวด)",
    "  • SKU: รหัส SKU ของหน่วยนั้นๆ (ไม่บังคับ)",
    "  • หน่วยฐาน (*): เลือกจาก dropdown → ใช่ (หน่วยที่เล็กที่สุด) หรือ ไม่ใช่",
    "  • ตัวคูณ (*): จำนวนหน่วยฐานใน 1 หน่วยนี้ (เช่น 1 กล่อง = 12 ขวด → ตัวคูณ = 12)",
    "",
    "🔹 หมายเหตุสำคัญ:",
    "  ⚠️ คอลัมน์ที่มีเครื่องหมาย (*) จำเป็นต้องกรอก",
    "  ⚠️ สินค้าแต่ละชนิดต้องมีหน่วยฐานเพียง 1 หน่วยเท่านั้น",
    "  ⚠️ ถ้าสินค้ามีหลายหน่วย ให้เพิ่มหลายแถวโดยใช้รหัสสินค้าเดียวกัน",
    "  ⚠️ กรุณาใช้ dropdown แทนการพิมพ์ตัวอักษรด้วยตนเอง เพื่อป้องกันข้อผิดพลาด",
    "",
    "🔹 ตัวอย่างการกรอก (สินค้าที่มี 3 หน่วย):",
    "  C001 | น้ำดื่ม | น้ำดื่มบรรจุขวด | บริษัท ก | ใช้งาน | กล่อง | BOX-001 | ไม่ใช่ | 24",
    "  C001 | น้ำดื่ม | น้ำดื่มบรรจุขวด | บริษัท ก | ใช้งาน | แพ็ค | PACK-001 | ไม่ใช่ | 6",
    "  C001 | น้ำดื่ม | น้ำดื่มบรรจุขวด | บริษัท ก | ใช้งาน | ขวด | BOTTLE-001 | ใช่ | 1",
    "",
    "💡 หากมีปัญหาหรือข้อสงสัย กรุณาติดต่อฝ่าย IT Support",
  ];

  for (const line of instructions) {
    const row = instructionsSheet.addRow([line]);
    if (line.startsWith("🔹")) {
      row.font = { bold: true, size: 12, color: { argb: "FF1E293B" } };
    } else if (line.startsWith("  •") || line.startsWith("  ⚠️")) {
      row.font = { size: 11, color: { argb: "FF475569" } };
    } else {
      row.font = { size: 10, color: { argb: "FF64748B" } };
    }
    row.alignment = { wrapText: true, vertical: "top" };
  }

  // ========================================
  // Sheet 2: ตัวอย่าง (Example)
  // ========================================
  const exampleSheet = workbook.addWorksheet("ตัวอย่าง");

  exampleSheet.columns = [
    { header: PRODUCT_HEADERS.code, key: "code", width: 15 },
    { header: PRODUCT_HEADERS.name, key: "name", width: 30 },
    { header: PRODUCT_HEADERS.description, key: "description", width: 40 },
    { header: PRODUCT_HEADERS.companyName, key: "companyName", width: 28 },
    { header: PRODUCT_HEADERS.isActive, key: "isActive", width: 15 },
    { header: PRODUCT_HEADERS.unitName, key: "unitName", width: 15 },
    { header: PRODUCT_HEADERS.unitSku, key: "unitSku", width: 15 },
    { header: PRODUCT_HEADERS.unitIsBase, key: "unitIsBase", width: 12 },
    { header: PRODUCT_HEADERS.unitMultiplier, key: "unitMultiplier", width: 12 },
  ];

  // Style header
  exampleSheet.getRow(1).font = { bold: true, size: 11 };
  exampleSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3B82F6" },
  };
  exampleSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  exampleSheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

  // Example data
  const exampleData = [
    {
      code: "C001",
      name: "น้ำดื่ม",
      description: "น้ำดื่มบรรจุขวด 600ml",
      companyName: "บริษัท ก",
      isActive: "ใช้งาน",
      unitName: "กล่อง",
      unitSku: "BOX-001",
      unitIsBase: "ไม่ใช่",
      unitMultiplier: 24,
    },
    {
      code: "C001",
      name: "น้ำดื่ม",
      description: "น้ำดื่มบรรจุขวด 600ml",
      companyName: "บริษัท ก",
      isActive: "ใช้งาน",
      unitName: "แพ็ค",
      unitSku: "PACK-001",
      unitIsBase: "ไม่ใช่",
      unitMultiplier: 6,
    },
    {
      code: "C001",
      name: "น้ำดื่ม",
      description: "น้ำดื่มบรรจุขวด 600ml",
      companyName: "บริษัท ก",
      isActive: "ใช้งาน",
      unitName: "ขวด",
      unitSku: "BOTTLE-001",
      unitIsBase: "ใช่",
      unitMultiplier: 1,
    },
    {
      code: "C002",
      name: "กาแฟสำเร็จรูป",
      description: "กาแฟสำเร็จรูป 3in1",
      companyName: "บริษัท ข",
      isActive: "ใช้งาน",
      unitName: "ลัง",
      unitSku: "CRATE-002",
      unitIsBase: "ไม่ใช่",
      unitMultiplier: 240,
    },
    {
      code: "C002",
      name: "กาแฟสำเร็จรูป",
      description: "กาแฟสำเร็จรูป 3in1",
      companyName: "บริษัท ข",
      isActive: "ใช้งาน",
      unitName: "กล่อง",
      unitSku: "BOX-002",
      unitIsBase: "ไม่ใช่",
      unitMultiplier: 20,
    },
    {
      code: "C002",
      name: "กาแฟสำเร็จรูป",
      description: "กาแฟสำเร็จรูป 3in1",
      companyName: "บริษัท ข",
      isActive: "ใช้งาน",
      unitName: "ซอง",
      unitSku: "SACHET-002",
      unitIsBase: "ใช่",
      unitMultiplier: 1,
    },
  ];

  for (const data of exampleData) {
    exampleSheet.addRow(data);
  }

  // Freeze header
  exampleSheet.views = [{ state: "frozen", ySplit: 1 }];

  // ========================================
  // Sheet 3: ข้อมูลสินค้า (Data)
  // ========================================
  const worksheet = workbook.addWorksheet("ข้อมูลสินค้า");

  worksheet.columns = [
    { header: PRODUCT_HEADERS.code, key: "code", width: 18 },
    { header: PRODUCT_HEADERS.name, key: "name", width: 32 },
    { header: PRODUCT_HEADERS.description, key: "description", width: 42 },
    { header: PRODUCT_HEADERS.companyName, key: "companyName", width: 28 },
    { header: PRODUCT_HEADERS.isActive, key: "isActive", width: 15 },
    { header: PRODUCT_HEADERS.unitName, key: "unitName", width: 18 },
    { header: PRODUCT_HEADERS.unitSku, key: "unitSku", width: 18 },
    { header: PRODUCT_HEADERS.unitIsBase, key: "unitIsBase", width: 14 },
    { header: PRODUCT_HEADERS.unitMultiplier, key: "unitMultiplier", width: 14 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E40AF" }, // Blue
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 25;

  // Add cell comments to headers
  worksheet.getCell("A1").note = {
    texts: [{ text: "รหัสเฉพาะของสินค้า\nห้ามซ้ำกัน\n✅ บังคับกรอก" }],
  };
  worksheet.getCell("B1").note = {
    texts: [{ text: "ชื่อเต็มของสินค้า\n✅ บังคับกรอก" }],
  };
  worksheet.getCell("C1").note = {
    texts: [{ text: "รายละเอียดเพิ่มเติม\n⚪ ไม่บังคับ" }],
  };
  worksheet.getCell("D1").note = {
    texts: [{ text: "ชื่อบริษัท\n⚪ ไม่บังคับ" }],
  };
  worksheet.getCell("E1").note = {
    texts: [{ text: "เลือกจาก dropdown\n✅ บังคับกรอก" }],
  };
  worksheet.getCell("F1").note = {
    texts: [{ text: "ชื่อหน่วยขาย (เช่น กล่อง, แพ็ค)\n✅ บังคับกรอก" }],
  };
  worksheet.getCell("G1").note = {
    texts: [{ text: "รหัส SKU ของหน่วย\n⚪ ไม่บังคับ" }],
  };
  worksheet.getCell("H1").note = {
    texts: [{ text: "เลือกจาก dropdown\nหน่วยฐาน = หน่วยเล็กที่สุด\n✅ บังคับกรอก" }],
  };
  worksheet.getCell("I1").note = {
    texts: [{ text: "จำนวนหน่วยฐานใน 1 หน่วยนี้\nตัวอย่าง: 1 กล่อง = 12 ขวด\n✅ บังคับกรอก" }],
  };

  // Color-code required fields (yellow background)
  const requiredColumns = [1, 2, 5, 6, 8, 9]; // A, B, E, F, H, I
  for (const colNum of requiredColumns) {
    worksheet.getColumn(colNum).eachCell((cell, rowNumber) => {
      if (rowNumber > 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFE082" }, // Light yellow
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE0E0E0" } },
          left: { style: "thin", color: { argb: "FFE0E0E0" } },
          bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
          right: { style: "thin", color: { argb: "FFE0E0E0" } },
        };
      }
    });
  }

  // Add existing data rows
  for (const product of products) {
    for (const unit of product.units) {
      worksheet.addRow({
        code: product.code,
        name: product.name,
        description: product.description || "",
        companyName: product.companyName || "",
        isActive: product.isActive ? "ใช้งาน" : "ไม่ใช้งาน",
        unitName: unit.name,
        unitSku: unit.sku || "",
        unitIsBase: unit.isBase ? "ใช่" : "ไม่ใช่",
        unitMultiplier: unit.multiplierToBase,
      });
    }
  }

  // Add data validation (Dropdown) for column E (สถานะใช้งาน)
  worksheet.getColumn(5).eachCell((cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: ['"ใช้งาน,ไม่ใช้งาน"'],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "ค่าไม่ถูกต้อง",
        error: "กรุณาเลือกจาก dropdown: ใช้งาน หรือ ไม่ใช้งาน",
      };
    }
  });

  // Add data validation (Dropdown) for column H (หน่วยฐาน)
  worksheet.getColumn(8).eachCell((cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: ['"ใช่,ไม่ใช่"'],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "ค่าไม่ถูกต้อง",
        error: "กรุณาเลือกจาก dropdown: ใช่ หรือ ไม่ใช่",
      };
    }
  });

  // Add data validation for column I (ตัวคูณ - must be number > 0)
  worksheet.getColumn(9).eachCell((cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "decimal",
        operator: "greaterThan",
        formulae: [0],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "ค่าไม่ถูกต้อง",
        error: "ตัวคูณต้องเป็นตัวเลขที่มากกว่า 0",
      };
      cell.numFmt = "0.##"; // Number format with up to 2 decimals
    }
  });

  // Freeze header row (แถวแรก)
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  // Enable auto-filter
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 9 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Validate imported products
 */
export function validateImportedProducts(products: ProductImportRow[]): string[] {
  const errors: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i]!;
    const productIndex = i + 1; // 1-indexed for user-friendly display

    // Check required fields
    if (!product.code) {
      errors.push(`[สินค้าที่ ${productIndex}] "${product.name}": ไม่มีรหัสสินค้า`);
    }
    if (!product.name) {
      errors.push(`[สินค้าที่ ${productIndex}] รหัส "${product.code}": ไม่มีชื่อสินค้า`);
    }

    // Check units
    if (product.units.length === 0) {
      errors.push(`[สินค้าที่ ${productIndex}] "${product.name}" (${product.code}): ต้องมีอย่างน้อย 1 หน่วย`);
    }

    // Check base unit
    const baseUnits = product.units.filter((u) => u.isBase);
    if (baseUnits.length === 0) {
      const unitList = product.units.map(u => `"${u.name}" (หน่วยฐาน: ${u.isBase ? "ใช่" : "ไม่ใช่"})`).join(", ");
      const unitCount = product.units.length;

      let errorMsg = `[สินค้าที่ ${productIndex}] "${product.name}" (${product.code}): ❌ ไม่มีหน่วยฐาน\n`;
      errorMsg += `  📦 หน่วยที่มีในไฟล์: ${unitCount} หน่วย → ${unitList}\n`;

      if (unitCount === 1) {
        errorMsg += `  ⚠️ สินค้านี้มีแค่ 1 หน่วย อาจขาดหน่วยอื่นๆ (เช่น ซอง, แพ็ค, ลัง)\n`;
        errorMsg += `  💡 กรุณาเพิ่มแถวในไฟล์ CSV/Excel สำหรับหน่วยที่ขาด และตั้งหน่วยที่เล็กที่สุดเป็นหน่วยฐาน (ใช่)\n`;
        errorMsg += `  📝 ตัวอย่าง: ถ้าขาดหน่วย "ซอง" ให้เพิ่มแถว → ${product.code},${product.name},...,ซอง,...,ใช่,1`;
      } else if (unitCount === 2) {
        errorMsg += `  ⚠️ สินค้านี้มีแค่ 2 หน่วย อาจขาดหน่วยอื่นๆ\n`;
        errorMsg += `  💡 กรุณาเพิ่มแถวสำหรับหน่วยที่ขาด และตั้งหน่วยที่เล็กที่สุดเป็นหน่วยฐาน (ใช่)`;
      } else {
        errorMsg += `  💡 กรุณาตรวจสอบคอลัมน์ "หน่วยฐาน" ต้องเป็น "ใช่", "Yes", "Y", "true", หรือ "1" สำหรับหน่วยที่เล็กที่สุด`;
      }

      errors.push(errorMsg);
    }
    if (baseUnits.length > 1) {
      const baseUnitNames = baseUnits.map(u => `"${u.name}"`).join(", ");
      errors.push(
        `[สินค้าที่ ${productIndex}] "${product.name}" (${product.code}): มีหน่วยฐานเกิน 1 หน่วย (${baseUnitNames})\n` +
        `  💡 ต้องมีหน่วยฐานเพียง 1 หน่วยเท่านั้น`
      );
    }

    // Check duplicate unit names
    const unitNames = product.units.map((u) => u.name.toLowerCase());
    const uniqueNames = new Set(unitNames);
    if (unitNames.length !== uniqueNames.size) {
      errors.push(`[สินค้าที่ ${productIndex}] "${product.name}" (${product.code}): มีชื่อหน่วยซ้ำกัน`);
    }

    // Check duplicate SKUs within product
    const skus = product.units.map((u) => u.sku).filter((s) => s);
    const uniqueSkus = new Set(skus);
    if (skus.length !== uniqueSkus.size) {
      errors.push(`[สินค้าที่ ${productIndex}] "${product.name}" (${product.code}): มี SKU ซ้ำกัน`);
    }
  }

  return errors;
}
