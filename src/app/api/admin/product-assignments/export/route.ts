import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import { listProductAssignments } from "@/lib/supabaseProducts";
import {
  exportAssignmentsCsv,
  exportAssignmentsExcelSimple,
  type AssignmentExportRow,
} from "@/lib/assignmentImportExport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportFormat = "csv" | "excel";
type EmployeeRow = { id: string; name: string; employee_code: string | null };
type StoreRow = { id: string; name: string; province: string | null };

/**
 * GET /api/admin/product-assignments/export
 *
 * ส่งออกข้อมูลการผูกสินค้ากับพนักงานในรูปแบบ CSV หรือ Excel
 *
 * Query Parameters:
 * - format: "csv" | "excel" (default: "csv")
 * - employeeId: กรองตามพนักงาน (optional)
 * - storeId: กรองตามร้านค้า (optional)
 *
 * Flow:
 * 1. Parse query parameters
 * 2. Fetch assignments จาก Supabase ตาม filters
 * 3. Fetch employees และ stores เพื่อแปลง ID เป็นชื่อ
 * 4. Transform เป็น AssignmentExportRow format (แยกแต่ละ unit เป็น row)
 * 5. Export เป็น CSV หรือ Excel
 * 6. Return file พร้อม headers ที่เหมาะสม
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") || "csv").toLowerCase() as ExportFormat;
    const employeeId = url.searchParams.get("employeeId") || undefined;
    const storeId = url.searchParams.get("storeId") || undefined;

    // Validate format
    if (format !== "csv" && format !== "excel") {
      return NextResponse.json(
        { ok: false, message: "รูปแบบไฟล์ไม่ถูกต้อง (รองรับ csv และ excel เท่านั้น)" },
        { status: 400 }
      );
    }

    // Fetch assignments based on filters
    const allAssignments = await listProductAssignments({
      employeeId,
      storeId: storeId === "" ? null : storeId,
      onlyActiveUnits: false, // Export all units including inactive ones
    });

    // Filter out assignments with no units (incomplete data)
    const assignments = allAssignments.filter(assignment => assignment.units.length > 0);

    if (allAssignments.length > assignments.length) {
      const skippedCount = allAssignments.length - assignments.length;
      console.warn(
        `[export-assignments] Skipped ${skippedCount} assignments with no units. ` +
        `These assignments need to be edited to add unit prices.`
      );
    }

    if (assignments.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: allAssignments.length > 0
            ? "การผูกสินค้าทั้งหมดยังไม่มีข้อมูลหน่วยและราคา กรุณาแก้ไขการผูกสินค้าเพื่อเพิ่มข้อมูลก่อน export"
            : "ไม่มีข้อมูลการผูกสินค้าที่ต้องการส่งออก"
        },
        { status: 404 }
      );
    }

    // Fetch employees, stores, and product_units to get names and SKUs
    const supabase = getSupabaseServiceClient();

    const employeeIds = Array.from(new Set(assignments.map((a) => a.employeeId)));
    const storeIds = Array.from(
      new Set(assignments.map((a) => a.storeId).filter((id): id is string => id !== null))
    );

    // Collect all unit IDs to fetch SKUs
    const unitIds = Array.from(
      new Set(
        assignments.flatMap((a) =>
          a.units.map((u) => u.unitId)
        )
      )
    );

    // Fetch employees, stores, units to build export rows
    const [
      employeesResult,
      storesResult,
      unitsResult,
    ] = await Promise.all([
      supabase.from("employees").select("id, name, employee_code").in("id", employeeIds),
      storeIds.length > 0
        ? supabase.from("stores").select("id, name, province").in("id", storeIds)
        : Promise.resolve({ data: [], error: null }),
      unitIds.length > 0
        ? supabase.from("product_units").select("id, sku").in("id", unitIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (employeesResult.error) {
      console.error("[export-assignments] employees fetch error", employeesResult.error);
      return NextResponse.json(
        { ok: false, message: "ไม่สามารถดึงข้อมูลพนักงานได้" },
        { status: 500 }
      );
    }

    if (storesResult.error) {
      console.error("[export-assignments] stores fetch error", storesResult.error);
      return NextResponse.json(
        { ok: false, message: "ไม่สามารถดึงข้อมูลร้านค้าได้" },
        { status: 500 }
      );
    }

    if (unitsResult.error) {
      console.error("[export-assignments] units fetch error", unitsResult.error);
      return NextResponse.json(
        { ok: false, message: "ไม่สามารถดึงข้อมูล SKU ได้" },
        { status: 500 }
      );
    }

    const employees: EmployeeRow[] = (employeesResult.data ?? []) as EmployeeRow[];
    const stores: StoreRow[] = (storesResult.data ?? []) as StoreRow[];
    const units = (unitsResult.data ?? []) as Array<{ id: string; sku: string | null }>;

    // Build lookup maps
    const employeeById = new Map(
      employees?.map((emp) => [
        emp.id,
        { name: emp.name, code: emp.employee_code || "" },
      ])
    );
    const storeById = new Map(stores?.map((store) => [store.id, store.name]));
    const unitSkuById = new Map(units.map((unit) => [unit.id, unit.sku || ""]));

    // Debug logging
    console.log("[export-assignments] Debug info:");
    console.log("- Total assignments:", assignments.length);
    console.log("- Employees map size:", employeeById.size);
    console.log("- Stores map size:", storeById.size);
    console.log("- Units map size:", unitSkuById.size);
    if (assignments.length > 0) {
      console.log("- First assignment sample:", JSON.stringify(assignments[0], null, 2));
    }
    console.log("- Employee IDs in map:", Array.from(employeeById.keys()));
    console.log("- Store IDs in map:", Array.from(storeById.keys()));

    // Transform assignments to export rows (one row per unit)
    const exportRows: AssignmentExportRow[] = [];

    for (const assignment of assignments) {
      const employee = employeeById.get(assignment.employeeId);
      if (!employee) {
        console.warn(`[export-assignments] Employee not found: ${assignment.employeeId}`);
        console.warn(`[export-assignments] Available employee IDs:`, Array.from(employeeById.keys()));
        continue;
      }

      const storeName = assignment.storeId ? storeById.get(assignment.storeId) || "" : "";

      // Create one row per unit
      for (const unit of assignment.units) {
        const unitSku = unitSkuById.get(unit.unitId) || "";
        exportRows.push({
          employeeName: employee.name,
          employeeCode: employee.code,
          storeName,
          productCode: assignment.productCode,
          productName: assignment.productName,
          unitName: unit.unitName,
          unitSku, // ✅ ดึง SKU จริงจาก database
          pricePc: unit.pricePc,
          isActive: unit.isActive ? "ใช้งาน" : "ไม่ใช้งาน",
        });
      }
    }

    // Sort rows for consistent output
    exportRows.sort((a, b) => {
      // Sort by employee name, then store name, then product code
      if (a.employeeName !== b.employeeName) {
        return a.employeeName.localeCompare(b.employeeName, "th");
      }
      if (a.storeName !== b.storeName) {
        return a.storeName.localeCompare(b.storeName, "th");
      }
      if (a.productCode !== b.productCode) {
        return a.productCode.localeCompare(b.productCode);
      }
      return a.unitName.localeCompare(b.unitName, "th");
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
    const fileBaseName = `product-assignments-${timestamp}`;

    // Export based on format
    if (format === "excel") {
      // Use simple Excel export (no dropdowns, no formulas, no master data)
      const buffer = await exportAssignmentsExcelSimple(exportRows);
      const filename = `${fileBaseName}.xlsx`;

      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    } else {
      // CSV format
      const csv = exportAssignmentsCsv(exportRows);
      const filename = `${fileBaseName}.csv`;

      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }
  } catch (error) {
    console.error("[export-assignments] error", error);
    const message = error instanceof Error ? error.message : "ไม่สามารถส่งออกข้อมูลได้";
    return NextResponse.json(
      { ok: false, message },
      { status: 500 }
    );
  }
}
