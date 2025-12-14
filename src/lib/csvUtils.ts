/**
 * CSV Utilities for Products Import/Export
 */

import type { ProductRecord, CategoryRecord } from "./configStore";

// CSV Headers
export const PRODUCT_CSV_HEADERS = [
  "รหัสสินค้า",
  "ชื่อสินค้า",
  "ราคา",
  "หมวดหมู่",
  "SKU",
  "คำอธิบาย",
  "สถานะ",
];

/**
 * Convert products to CSV format
 */
export function productsToCSV(
  products: ProductRecord[],
  categories: CategoryRecord[]
): string {
  // Create category lookup map
  const categoryMap = new Map(categories.map((cat) => [cat.id, cat.name]));

  // Build CSV header
  const header = PRODUCT_CSV_HEADERS.join(",");

  // Build CSV rows
  const rows = products.map((product) => {
    const categoryName = product.categoryId
      ? categoryMap.get(product.categoryId) || ""
      : "";

    return [
      escapeCSVField(product.code),
      escapeCSVField(product.name),
      product.unitPrice.toString(),
      escapeCSVField(categoryName),
      escapeCSVField(product.sku || ""),
      escapeCSVField(product.description || ""),
      product.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน",
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

/**
 * Download CSV file
 */
export function downloadCSV(csv: string, filename: string): void {
  // Add BOM for Excel UTF-8 support
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse CSV file to products
 */
export async function parseProductsCSV(
  file: File,
  categories: CategoryRecord[]
): Promise<{
  products: Array<{
    code: string;
    name: string;
    unitPrice: number;
    categoryId: string | null;
    sku: string | null;
    description: string | null;
    isActive: boolean;
  }>;
  errors: string[];
}> {
  const text = await file.text();
  const lines = text.split("\n").filter((line) => line.trim());

  if (lines.length === 0) {
    return { products: [], errors: ["ไฟล์ว่างเปล่า"] };
  }

  // Skip header
  const dataLines = lines.slice(1);
  const products: Array<{
    code: string;
    name: string;
    unitPrice: number;
    categoryId: string | null;
    sku: string | null;
    description: string | null;
    isActive: boolean;
  }> = [];
  const errors: string[] = [];

  // Create category lookup by name
  const categoryByName = new Map(
    categories.map((cat) => [cat.name.toLowerCase(), cat.id])
  );

  dataLines.forEach((line, index) => {
    const rowNum = index + 2; // +2 because of header and 0-index
    try {
      const fields = parseCSVLine(line);

      if (fields.length < 3) {
        errors.push(`แถว ${rowNum}: ข้อมูลไม่ครบถ้วน`);
        return;
      }

      const [code, name, priceStr, categoryName, sku, description, statusStr] =
        fields;

      // Validate required fields
      if (!code?.trim()) {
        errors.push(`แถว ${rowNum}: ไม่มีรหัสสินค้า`);
        return;
      }

      if (!name?.trim()) {
        errors.push(`แถว ${rowNum}: ไม่มีชื่อสินค้า`);
        return;
      }

      const price = Number.parseFloat(priceStr || "0");
      if (!Number.isFinite(price) || price < 0) {
        errors.push(`แถว ${rowNum}: ราคาไม่ถูกต้อง (${priceStr})`);
        return;
      }

      // Find category ID
      let categoryId: string | null = null;
      if (categoryName?.trim()) {
        categoryId =
          categoryByName.get(categoryName.trim().toLowerCase()) || null;
        if (!categoryId) {
          errors.push(`แถว ${rowNum}: ไม่พบหมวดหมู่ "${categoryName}"`);
        }
      }

      // Parse status
      const isActive = statusStr?.trim() !== "ปิดใช้งาน";

      products.push({
        code: code.trim(),
        name: name.trim(),
        unitPrice: price,
        categoryId,
        sku: sku?.trim() || null,
        description: description?.trim() || null,
        isActive,
      });
    } catch (err) {
      errors.push(
        `แถว ${rowNum}: เกิดข้อผิดพลาด (${err instanceof Error ? err.message : "Unknown"})`
      );
    }
  });

  return { products, errors };
}

/**
 * Parse a single CSV line (handles quoted fields)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Escape CSV field (add quotes if needed)
 */
function escapeCSVField(field: string | null | undefined): string {
  if (!field) return "";

  const str = String(field);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generate CSV template for import
 */
export function generateCSVTemplate(): string {
  const header = PRODUCT_CSV_HEADERS.join(",");
  const example = [
    "P001",
    "สินค้าตัวอย่าง 1",
    "100.50",
    "หมวดหมู่ตัวอย่าง",
    "SKU001",
    "คำอธิบายสินค้า",
    "เปิดใช้งาน",
  ]
    .map((field) => escapeCSVField(field))
    .join(",");

  return `${header}\n${example}`;
}
