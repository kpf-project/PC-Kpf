import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import {
  parseAssignmentsCsv,
  parseAssignmentsExcel,
  validateImportedAssignments,
  type AssignmentImportRow,
} from "@/lib/assignmentImportExport";
import { upsertProductAssignment } from "@/lib/supabaseProducts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmployeeRow = { id: string; name: string; employee_code: string | null };
type StoreRow = { id: string; name: string };
type ProductRow = { id: string; code: string; name: string };
type ProductUnitRow = { id: string; product_id: string; name: string; sku: string | null };

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_CSV_TYPES = ["text/csv", "application/vnd.ms-excel"];
const ALLOWED_EXCEL_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

interface ImportResponseBody {
  ok: boolean;
  message: string;
  success?: number;
  failed?: number;
  errors?: string[];
  created?: Array<{ employeeName: string; productName: string; storeName: string }>;
}

interface ErrorResponse {
  ok: false;
  message: string;
}

/**
 * POST /api/admin/product-assignments/import
 *
 * นำเข้าข้อมูลการผูกสินค้ากับพนักงานจากไฟล์ CSV หรือ Excel
 *
 * Flow:
 * 1. รับไฟล์ multipart/form-data
 * 2. ตรวจสอบประเภทไฟล์และขนาด
 * 3. Parse ไฟล์เป็น AssignmentImportRow[]
 * 4. ดึงข้อมูลพนักงาน, ร้านค้า, และสินค้าจาก Supabase
 * 5. Validate ข้อมูลที่ import มา
 * 6. Upsert assignments ลงใน Supabase
 * 7. Return สรุปผลการ import
 */
export async function POST(request: Request): Promise<NextResponse<ImportResponseBody | ErrorResponse>> {
  try {
    // Parse multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file");

    // Validate file presence and type (check for Blob-like object)
    // Note: In Node.js environment, File is not available, but FormData returns Blob-like objects
    if (!file || typeof file === "string" || !("name" in file) || !("arrayBuffer" in file)) {
      return NextResponse.json(
        { ok: false, message: "กรุณาแนบไฟล์ที่ต้องการนำเข้า" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size === 0) {
      return NextResponse.json(
        { ok: false, message: "ไฟล์ว่างเปล่า กรุณาเลือกไฟล์อื่น" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, message: "ไฟล์ใหญ่เกินกำหนด (สูงสุด 5MB)" },
        { status: 400 }
      );
    }

    // Determine file type and parse accordingly
    const fileType = file.type.toLowerCase();
    let assignments: AssignmentImportRow[];

    if (ALLOWED_CSV_TYPES.includes(fileType) || file.name.toLowerCase().endsWith(".csv")) {
      // Parse CSV
      const text = await file.text();
      assignments = parseAssignmentsCsv(text);
    } else if (ALLOWED_EXCEL_TYPES.includes(fileType) || file.name.toLowerCase().endsWith(".xlsx")) {
      // Parse Excel
      const buffer = await file.arrayBuffer();
      assignments = await parseAssignmentsExcel(buffer);
    } else {
      return NextResponse.json(
        { ok: false, message: "รองรับเฉพาะไฟล์ CSV และ Excel (.xlsx) เท่านั้น" },
        { status: 400 }
      );
    }

    if (assignments.length === 0) {
      return NextResponse.json(
        { ok: false, message: "ไม่พบข้อมูลที่ต้องการนำเข้าในไฟล์" },
        { status: 400 }
      );
    }

    // Fetch reference data from Supabase
    const supabase = getSupabaseServiceClient();

    const [employeesResult, storesResult, productsResult] = await Promise.all([
      supabase.from("employees").select("id, name").order("name"),
      supabase.from("stores").select("id, name").order("name"),
      supabase.from("products").select("id, code, name").order("code"),
    ]);

    if (employeesResult.error) {
      console.error("[import-assignments] employees fetch error", employeesResult.error);
      return NextResponse.json(
        { ok: false, message: "ไม่สามารถดึงข้อมูลพนักงานได้" },
        { status: 500 }
      );
    }

    if (storesResult.error) {
      console.error("[import-assignments] stores fetch error", storesResult.error);
      return NextResponse.json(
        { ok: false, message: "ไม่สามารถดึงข้อมูลร้านค้าได้" },
        { status: 500 }
      );
    }

    if (productsResult.error) {
      console.error("[import-assignments] products fetch error", productsResult.error);
      return NextResponse.json(
        { ok: false, message: "ไม่สามารถดึงข้อมูลสินค้าได้" },
        { status: 500 }
      );
    }

    const employees: EmployeeRow[] = (employeesResult.data ?? []) as EmployeeRow[];
    const stores: StoreRow[] = (storesResult.data ?? []) as StoreRow[];
    const products: ProductRow[] = (productsResult.data ?? []) as ProductRow[];

    // Build lookup maps
    const employeeNameToId = new Map(
      employees?.map((emp) => [emp.name.trim().toLowerCase(), emp.id])
    );
    const storeNameToId = new Map(
      stores?.map((store) => [store.name.trim().toLowerCase(), store.id])
    );
    const productCodeToData = new Map(
      products.map((prod) => [prod.code.trim().toLowerCase(), { id: prod.id, name: prod.name }])
    );

    // Validate imported assignments
    const existingEmployeeNames = employees?.map((emp) => emp.name);
    const existingStoreNames = stores?.map((store) => store.name);
    const existingProductCodes = products.map((prod) => prod.code);

    const validationErrors = validateImportedAssignments(
      assignments,
      existingEmployeeNames,
      existingStoreNames,
      existingProductCodes
    );

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "พบข้อผิดพลาดในไฟล์ที่นำเข้า",
          errors: validationErrors.slice(0, 10), // Limit to first 10 errors
        },
        { status: 400 }
      );
    }

    // Fetch product units for each product
    const productIds = Array.from(productCodeToData.values()).map((p) => p.id);
    const { data: productUnits, error: unitsError } = await supabase
      .from("product_units")
      .select("id, product_id, name, sku")
      .in("product_id", productIds);

    if (unitsError) {
      console.error("[import-assignments] units fetch error", unitsError);
      return NextResponse.json(
        { ok: false, message: "ไม่สามารถดึงข้อมูลหน่วยสินค้าได้" },
        { status: 500 }
      );
    }

    // Build unit lookup: productId -> unitName -> unitId
    const unitLookup = new Map<string, Map<string, string>>();
    for (const unit of (productUnits ?? []) as ProductUnitRow[]) {
      if (!unitLookup.has(unit.product_id)) {
        unitLookup.set(unit.product_id, new Map());
      }
      const productUnitsMap = unitLookup.get(unit.product_id)!;
      productUnitsMap.set(unit.name.trim().toLowerCase(), unit.id);
    }

    // Process imports
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      created: [] as Array<{ employeeName: string; productName: string; storeName: string }>,
    };

    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i];
      const rowNum = i + 1;

      try {
        // Resolve employee ID
        const employeeId = employeeNameToId.get(assignment.employeeName.trim().toLowerCase());
        if (!employeeId) {
          results.errors.push(`แถว ${rowNum}: ไม่พบพนักงาน "${assignment.employeeName}"`);
          results.failed++;
          continue;
        }

        // Resolve store ID (null for global assignment)
        let storeId: string | null = null;
        if (assignment.storeName) {
          const resolvedStoreId = storeNameToId.get(assignment.storeName.trim().toLowerCase());
          if (!resolvedStoreId) {
            results.errors.push(`แถว ${rowNum}: ไม่พบร้านค้า "${assignment.storeName}"`);
            results.failed++;
            continue;
          }
          storeId = resolvedStoreId;
        }

        // Resolve product ID
        const productData = productCodeToData.get(assignment.productCode.trim().toLowerCase());
        if (!productData) {
          results.errors.push(`แถว ${rowNum}: ไม่พบสินค้า "${assignment.productCode}"`);
          results.failed++;
          continue;
        }
        const productId = productData.id;

        // Build units array with resolved unit IDs
        const productUnitsMap = unitLookup.get(productId);
        if (!productUnitsMap) {
          results.errors.push(
            `แถว ${rowNum}: สินค้า "${assignment.productName}" ยังไม่มีหน่วยในระบบ`
          );
          results.failed++;
          continue;
        }

        const units = [];
        for (const unitData of assignment.units) {
          const unitId = productUnitsMap.get(unitData.unitName.trim().toLowerCase());
          if (!unitId) {
            results.errors.push(
              `แถว ${rowNum}: ไม่พบหน่วย "${unitData.unitName}" ของสินค้า "${assignment.productName}"`
            );
            results.failed++;
            break;
          }

          units.push({
            unitId,
            pricePc: unitData.pricePc,
            enabled: unitData.isActive,
          });
        }

        // Skip if any unit failed to resolve
        if (units.length !== assignment.units.length) {
          continue;
        }

        // Upsert assignment
        await upsertProductAssignment({
          productId,
          employeeId,
          storeId,
          units,
        });

        results.success++;
        results.created.push({
          employeeName: assignment.employeeName,
          productName: assignment.productName,
          storeName: assignment.storeName || "ทุกร้าน",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "ไม่ทราบสาเหตุ";
        results.errors.push(`แถว ${rowNum}: ${message}`);
        results.failed++;
      }
    }

    return NextResponse.json({
      ok: true,
      message: `นำเข้าการผูกสินค้าสำเร็จ ${results.success} รายการ${results.failed > 0 ? `, ล้มเหลว ${results.failed} รายการ` : ""}`,
      success: results.success,
      failed: results.failed,
      errors: results.errors.slice(0, 20), // Limit to first 20 errors
      created: results.created,
    });
  } catch (error) {
    console.error("[import-assignments] error", error);
    const message = error instanceof Error ? error.message : "ไม่สามารถนำเข้าข้อมูลได้";
    return NextResponse.json(
      { ok: false, message },
      { status: 500 }
    );
  }
}
