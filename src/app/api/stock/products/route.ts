import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import { withTelemetrySpan } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ========================
// Type Definitions
// ========================

interface ProductUnit {
  unitId: string;
  unitName: string;
  assignmentUnitId: string;
  pricePc: number;
  multiplierToBase: number;
}

interface AssignedProduct {
  productId: string;
  productCode: string;
  productName: string;
  companyId: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  assignmentId: string;
  units: ProductUnit[];
}

interface GetProductsResponse {
  success: true;
  products: AssignedProduct[];
}

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

// ========================
// Helper Functions
// ========================

function isValidUUID(value: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(value);
}

// ========================
// GET - Fetch Assigned Products
// ========================

/**
 * ดึงรายการสินค้าที่ assign ให้พนักงาน (สำหรับ dropdown ในหน้า Stock Management)
 *
 * เหมือนกับ logic ในหน้า Sales Form แต่เฉพาะข้อมูลที่จำเป็นสำหรับระบบสต็อก
 */
export async function GET(request: NextRequest) {
  return withTelemetrySpan<NextResponse>("stock.products.list", async (span) => {
    try {
      const { searchParams } = new URL(request.url);
      // Support both camelCase and snake_case parameter names
      const employee_id = searchParams.get("employee_id") || searchParams.get("employeeId");
      const store_id = searchParams.get("store_id") || searchParams.get("storeId");

      // Validate required parameters
      if (!employee_id || !employee_id.trim()) {
        return NextResponse.json<ErrorResponse>(
          { success: false, error: "กรุณาระบุ employee_id หรือ employeeId" },
          { status: 400 }
        );
      }

      if (!isValidUUID(employee_id.trim())) {
        return NextResponse.json<ErrorResponse>(
          { success: false, error: "employee_id ไม่ถูกต้อง" },
          { status: 400 }
        );
      }

      // Validate store_id if provided (optional)
      if (store_id && store_id.trim() && !isValidUUID(store_id.trim())) {
        return NextResponse.json<ErrorResponse>(
          { success: false, error: "store_id ไม่ถูกต้อง" },
          { status: 400 }
        );
      }

      span.setAttribute("employee_id", employee_id.trim());
      if (store_id) {
        span.setAttribute("store_id", store_id.trim());
      }

      const supabase = getSupabaseServiceClient();

      // Verify employee exists
      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .select("id, name")
        .eq("id", employee_id.trim())
        .single();

      if (employeeError || !employee) {
        span.markError(employeeError || new Error("Employee not found"));
        return NextResponse.json<ErrorResponse>(
          { success: false, error: "ไม่พบข้อมูลพนักงาน" },
          { status: 404 }
        );
      }

      // Verify store exists (only if storeId provided)
      if (store_id && store_id.trim()) {
        const { data: store, error: storeError } = await supabase
          .from("stores")
          .select("id, name")
          .eq("id", store_id.trim())
          .single();

        if (storeError || !store) {
          span.markError(storeError || new Error("Store not found"));
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "ไม่พบข้อมูลร้าน" },
            { status: 404 }
          );
        }
      }

      /**
       * Query product assignments for this employee:
       * - If storeId provided: Global assignments OR store-specific assignments
       * - If no storeId: Only global assignments
       */
      let assignmentQuery = supabase
        .from("product_assignments")
        .select(
          `
          id,
          product_id,
          store_id,
          products!inner (
            id,
            code,
            name,
            is_active,
            company_id,
            companies (
              id,
              name,
              logo_url
            )
          )
        `
        )
        .eq("employee_id", employee_id.trim())
        .eq("products.is_active", true);

      // Add store filter if provided
      if (store_id && store_id.trim()) {
        assignmentQuery = assignmentQuery.or(`store_id.is.null,store_id.eq.${store_id.trim()}`);
      } else {
        // Only global assignments if no store selected
        assignmentQuery = assignmentQuery.is("store_id", null);
      }

      const { data: assignments, error: assignmentError } = await assignmentQuery;

      if (assignmentError) {
        console.error("[stock.products.list] Assignment query error:", assignmentError);
        span.markError(assignmentError);
        return NextResponse.json<ErrorResponse>(
          { success: false, error: "ไม่สามารถดึงข้อมูลสินค้าได้" },
          { status: 500 }
        );
      }

      if (!assignments || assignments.length === 0) {
        span.setAttribute("product_count", 0);
        return NextResponse.json<GetProductsResponse>({
          success: true,
          products: [],
        });
      }

      // Get assignment IDs
      const assignmentIds = assignments.map((a) => {
        const typedAssignment = a as { id: string };
        return typedAssignment.id;
      });

      // Fetch assignment units with pricing
      const { data: assignmentUnits, error: unitsError } = await supabase
        .from("product_assignment_units")
        .select(
          `
          id,
          assignment_id,
          unit_id,
          price_pc,
          is_active,
          product_units!inner (
            id,
            name,
            multiplier_to_base
          )
        `
        )
        .in("assignment_id", assignmentIds)
        .eq("is_active", true);

      if (unitsError) {
        console.error("[stock.products.list] Units query error:", unitsError);
        span.markError(unitsError);
        return NextResponse.json<ErrorResponse>(
          { success: false, error: "ไม่สามารถดึงข้อมูลหน่วยสินค้าได้" },
          { status: 500 }
        );
      }

      // Build product map with units
      const productMap = new Map<string, AssignedProduct>();

      assignments.forEach((assignment) => {
        const typedAssignment = assignment as {
          id: string;
          product_id: string;
          products: {
            id: string;
            code: string;
            name: string;
            company_id: string | null;
            companies: {
              id: string;
              name: string;
              logo_url: string | null;
            } | null;
          };
        };

        const product = typedAssignment.products;
        const company = product.companies;

        if (!productMap.has(product.id)) {
          productMap.set(product.id, {
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            companyId: product.company_id,
            companyName: company?.name || null,
            companyLogoUrl: company?.logo_url || null,
            assignmentId: typedAssignment.id,
            units: [],
          });
        }

        // Add units for this assignment
        const productUnits = (assignmentUnits || [])
          .filter((au) => {
            const typedUnit = au as { assignment_id: string };
            return typedUnit.assignment_id === typedAssignment.id;
          })
          .map((au) => {
            const typedUnit = au as {
              id: string;
              unit_id: string;
              price_pc: number | null;
              product_units: { name: string; multiplier_to_base: number };
            };

            return {
              unitId: typedUnit.unit_id,
              unitName: typedUnit.product_units.name,
              assignmentUnitId: typedUnit.id,
              pricePc: typeof typedUnit.price_pc === "number" ? typedUnit.price_pc : 0,
              multiplierToBase: typedUnit.product_units.multiplier_to_base,
            };
          });

        // Merge units (avoid duplicates)
        const existingProduct = productMap.get(product.id)!;
        const existingUnitIds = new Set(existingProduct.units.map((u) => u.unitId));

        productUnits.forEach((unit) => {
          if (!existingUnitIds.has(unit.unitId)) {
            existingProduct.units.push(unit);
            existingUnitIds.add(unit.unitId);
          }
        });
      });

      // Convert to array and filter out products with no units
      const products = Array.from(productMap.values()).filter((p) => p.units.length > 0);

      span.setAttribute("product_count", products.length);
      span.setAttribute("total_units", products.reduce((sum, p) => sum + p.units.length, 0));

      return NextResponse.json<GetProductsResponse>({
        success: true,
        products,
      });
    } catch (error) {
      console.error("[stock.products.list] Unexpected error:", error);
      span.markError(error);

      const message =
        error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า";

      return NextResponse.json<ErrorResponse>(
        { success: false, error: message },
        { status: 500 }
      );
    }
  });
}
