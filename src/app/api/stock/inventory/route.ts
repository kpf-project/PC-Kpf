import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import { withTelemetrySpan } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ========================
// Type Definitions
// ========================

interface InventoryItem {
  productId: string;
  productCode: string;
  productName: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  quantityInBase: number; // Quantity in base unit (e.g., 54 ซอง)
  displayText: string;     // Smart display (e.g., "2 ลัง 2 แพ็ค")
  displayUnits: Array<{   // Breakdown for detailed view
    unitId: string;
    unitName: string;
    count: number;
    multiplier: number;
  }>;
  updatedAt: string;
  // Batch expiry tracking
  nearestExpiry: {
    expiryDate: string | null;  // ✅ Allow NULL for FIFO items
    daysUntilExpiry: number | null;
    lotNumber: string;
    expiryStatus: 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry';  // ✅ Add 'no_expiry'
  } | null;
  totalBatches: number;
  criticalCount: number;
  warningCount: number;
}

interface GetInventoryResponse {
  success: true;
  inventory: InventoryItem[];
}

interface UpdateInventoryRequest {
  employee_id: string;
  store_id: string;
  product_id: string;
  unit_id: string;
  quantity: number;
}

interface UpdateInventoryResponse {
  success: true;
  message: string;
  inventory_id: string;
  quantity: number;
}

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

// ========================
// Helper Functions
// ========================

/**
 * Validate UUID format
 */
function isValidUUID(value: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(value);
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeToUTCMidnight(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function computeDaysUntilExpiry(expiryDate: string | null) {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const nowUtc = normalizeToUTCMidnight(new Date());
  const expiryUtc = normalizeToUTCMidnight(expiry);
  return Math.floor((expiryUtc - nowUtc) / MILLISECONDS_PER_DAY);
}

function computeExpiryStatus(daysUntilExpiry: number | null) {
  if (daysUntilExpiry === null) return null;
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 7) return "critical";
  if (daysUntilExpiry <= 30) return "warning";
  return "ok";
}

/**
 * Validate required query parameters
 */

// ========================
// GET - Fetch Inventory
// ========================

export async function GET(request: NextRequest) {
  return withTelemetrySpan<NextResponse>(
    "stock.inventory.get",
    async (span) => {
      try {
        const { searchParams } = new URL(request.url);
        // Support both camelCase and snake_case parameter names
        const employee_id = searchParams.get("employee_id") || searchParams.get("employeeId");
        const store_id = searchParams.get("store_id") || searchParams.get("storeId");
        const product_id = searchParams.get("product_id") || searchParams.get("productId");

        // Validate required parameters
        if (!employee_id || !employee_id.trim()) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "กรุณาระบุ employee_id หรือ employeeId" },
            { status: 400 }
          );
        }

        if (!store_id || !store_id.trim()) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "กรุณาระบุ store_id หรือ storeId" },
            { status: 400 }
          );
        }

        if (!isValidUUID(employee_id.trim())) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "employee_id ไม่ถูกต้อง" },
            { status: 400 }
          );
        }

        if (!isValidUUID(store_id.trim())) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "store_id ไม่ถูกต้อง" },
            { status: 400 }
          );
        }

        span.setAttribute("employee_id", employee_id.trim());
        span.setAttribute("store_id", store_id.trim());
        span.setAttribute("product_id", product_id || "");

        const supabase = getSupabaseServiceClient();

        // Verify employee exists
        const { data: employee, error: employeeError } = await supabase
          .from("employees")
          .select("id, name")
          .eq("id", employee_id!.trim())
          .single();

        if (employeeError || !employee) {
          span.markError(employeeError || new Error("Employee not found"));
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "ไม่พบข้อมูลพนักงาน" },
            { status: 404 }
          );
        }

        // Verify store exists
        const { data: store, error: storeError } = await supabase
          .from("stores")
          .select("id, name")
          .eq("id", store_id!.trim())
          .single();

        if (storeError || !store) {
          span.markError(storeError || new Error("Store not found"));
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "ไม่พบข้อมูลร้าน" },
            { status: 404 }
          );
        }

        // Build inventory query (quantity is now always in BASE unit)
        let query = supabase
          .from("stock_inventory")
          .select(
            `
            id,
            product_id,
            quantity,
            updated_at,
            products!inner (
              code,
              name,
              company_id,
              companies (
                id,
                name,
                logo_url
              )
            )
          `
          )
          .eq("employee_id", employee_id!.trim())
          .eq("store_id", store_id!.trim())
          .gt("quantity", 0) // Only show items with stock
          .order("updated_at", { ascending: false });

        // Filter by product if specified
        if (product_id && product_id.trim() && isValidUUID(product_id.trim())) {
          query = query.eq("product_id", product_id.trim());
          span.setAttribute("filter_by_product", true);
        }

        const { data: inventoryRows, error: inventoryError } = await query;

        if (inventoryError) {
          console.error("[stock.inventory.get] Query error:", inventoryError);
          span.markError(inventoryError);
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "ไม่สามารถดึงข้อมูลสต็อกได้" },
            { status: 500 }
          );
        }

        // Fetch all units for products in inventory (for smart display)
        const productIds = Array.from(new Set((inventoryRows || []).map((row: { product_id: string }) => row.product_id)));
        const unitsData = productIds.length > 0
          ? (await supabase
            .from("product_units")
            .select("id, product_id, name, multiplier_to_base, is_base")
            .in("product_id", productIds)
            .order("multiplier_to_base", { ascending: false })
          ).data
          : [];

        // Group units by product
        const unitsByProduct = new Map<string, Array<{ id: string; name: string; multiplier: number; isBase: boolean }>>();
        for (const unit of unitsData || []) {
          if (!unitsByProduct.has(unit.product_id)) {
            unitsByProduct.set(unit.product_id, []);
          }
          unitsByProduct.get(unit.product_id)!.push({
            id: unit.id,
            name: unit.name,
            multiplier: unit.multiplier_to_base,
            isBase: unit.is_base,
          });
        }

        // Fetch batch data for expiry tracking (server-side, no auth issues)
        type BatchRow = {
          product_id: string | null;
          expiry_date: string | null;
          days_until_expiry: number | null;
          lot_number: string | null;
          expiry_status: string | null;
        };

        let batchRows: BatchRow[] = [];

        if (productIds.length > 0) {
          const { data: batchesData, error: batchesError } = await supabase
            .from('stock_batches_display')
            .select('*')
            .eq('employee_id', employee_id!.trim())
            .eq('store_id', store_id!.trim())
            .in('product_id', productIds)
            .order('expiry_date', { ascending: true, nullsFirst: false });

          if (batchesError) {
            console.error('[stock.inventory.get] Batch view error, falling back to stock_batches:', batchesError);
            const { data: fallbackBatches, error: fallbackError } = await supabase
              .from('stock_batches')
              .select('product_id, lot_number, expiry_date')
              .eq('employee_id', employee_id!.trim())
              .eq('store_id', store_id!.trim())
              .in('product_id', productIds)
              .order('expiry_date', { ascending: true, nullsFirst: false });

            if (fallbackError) {
              console.error('[stock.inventory.get] Batch fallback failed:', fallbackError);
            } else {
              batchRows = (fallbackBatches || []).map((batch) => {
                const daysUntil = computeDaysUntilExpiry(batch.expiry_date || null);
                return {
                  product_id: batch.product_id,
                  expiry_date: batch.expiry_date,
                  days_until_expiry: daysUntil,
                  lot_number: batch.lot_number,
                  expiry_status: computeExpiryStatus(daysUntil),
                };
              });
            }
          } else {
            batchRows = (batchesData ?? []) as BatchRow[];
          }
        }

        // Group batches by product and calculate summary
        type BatchSummary = {
          nearestExpiry: {
            expiryDate: string | null;  // ✅ Allow NULL
            daysUntilExpiry: number | null;
            lotNumber: string;
            expiryStatus: 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry';  // ✅ Add 'no_expiry'
          } | null;
          totalBatches: number;
          criticalCount: number;
          warningCount: number;
        };

        const batchesByProduct = new Map<string, BatchSummary>();

        for (const productId of productIds) {
          const productBatches = batchRows.filter((b) => b.product_id === productId);

          if (productBatches.length === 0) {
            batchesByProduct.set(productId, {
              nearestExpiry: null,
              totalBatches: 0,
              criticalCount: 0,
              warningCount: 0,
            });
            continue;
          }

          // ✅ Find batch that will be SOLD FIRST (FEFO/FIFO hybrid priority)
          // Priority (same as deduct_stock_multi_batch RPC):
          // 1. FEFO: Batches with expiry_date AND not expired yet (sell expiring items first to reduce waste)
          // 2. FIFO: Batches without expiry_date (sell oldest first)
          // 3. Expired batches only if no other batches available
          //
          // Split batches into available and expired groups
          const availableFefoBatches = productBatches.filter((b) =>
            b.expiry_date !== null && b.expiry_status !== 'expired'
          );  // มีหมดอายุ แต่ยังไม่หมดอายุ

          const fifoBatches = productBatches.filter((b) => b.expiry_date === null);  // ไม่หมดอายุ

          const expiredBatches = productBatches.filter((b) => b.expiry_status === 'expired');  // หมดอายุแล้ว

          // Choose the batch that will be sold FIRST (matches modal & RPC logic)
          let nearest: {
            expiry_date: string | null;
            days_until_expiry: number | null;
            lot_number: string;
            expiry_status: string;
          };

          if (availableFefoBatches.length > 0) {
            // ✅ FEFO batches available → sell expiring items FIRST (reduce waste)
            nearest = availableFefoBatches[0] as typeof nearest;
          } else if (fifoBatches.length > 0) {
            // ✅ Only FIFO batches → show "no expiry"
            nearest = fifoBatches[0] as typeof nearest;
          } else if (expiredBatches.length > 0) {
            // ⚠️ All batches expired → show expired batch with warning
            nearest = expiredBatches[0] as typeof nearest;
          } else {
            // ✅ Fallback (should never happen)
            nearest = productBatches[0] as typeof nearest;
          }

          // ✅ Always create nearestExpiry (even if expiry_date is NULL)
          const nearestExpiry = {
            expiryDate: nearest.expiry_date,  // ✅ Can be NULL
            daysUntilExpiry: nearest.days_until_expiry,  // ✅ Can be NULL
            lotNumber: nearest.lot_number,
            expiryStatus: nearest.expiry_date
              ? ((nearest.expiry_status || 'ok') as 'ok' | 'warning' | 'critical' | 'expired')
              : ('no_expiry' as const),  // ✅ NULL = no_expiry (use FIFO)
          };

          // Count critical and warning batches
          const criticalCount = productBatches.filter((b: { expiry_status: string | null }) => b.expiry_status === 'critical' || b.expiry_status === 'expired').length;
          const warningCount = productBatches.filter((b: { expiry_status: string | null }) => b.expiry_status === 'warning').length;

          batchesByProduct.set(productId, {
            nearestExpiry,
            totalBatches: productBatches.length,
            criticalCount,
            warningCount,
          });
        }

        // Helper function for smart display
        function smartDisplay(baseQuantity: number, units: Array<{ id: string; name: string; multiplier: number; isBase: boolean }>) {
          if (baseQuantity === 0) {
            return { text: '0', breakdown: [] };
          }

          const breakdown: Array<{ unitId: string; unitName: string; count: number; multiplier: number }> = [];
          let remaining = baseQuantity;

          // Sort by multiplier descending (largest unit first)
          const sortedUnits = [...units].sort((a, b) => b.multiplier - a.multiplier);

          for (const unit of sortedUnits) {
            if (remaining >= unit.multiplier) {
              const count = Math.floor(remaining / unit.multiplier);
              breakdown.push({
                unitId: unit.id,
                unitName: unit.name,
                count,
                multiplier: unit.multiplier,
              });
              remaining = remaining % unit.multiplier;
            }
          }

          const text = breakdown.map(u => `${u.count} ${u.unitName}`).join(' ');
          return { text: text || '0', breakdown };
        }

        // Transform data with smart display + batch data
        const inventory: InventoryItem[] = (inventoryRows || []).map((row) => {
          const typedRow = row as {
            id: string;
            product_id: string;
            quantity: number;
            updated_at: string;
            products: {
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

          const units = unitsByProduct.get(typedRow.product_id) || [];
          const display = smartDisplay(typedRow.quantity, units);
          const batchSummary = batchesByProduct.get(typedRow.product_id) || {
            nearestExpiry: null,
            totalBatches: 0,
            criticalCount: 0,
            warningCount: 0,
          };

          return {
            productId: typedRow.product_id,
            productCode: typedRow.products.code,
            productName: typedRow.products.name,
            companyName: typedRow.products.companies?.name || null,
            companyLogoUrl: typedRow.products.companies?.logo_url || null,
            quantityInBase: typedRow.quantity,
            displayText: display.text,
            displayUnits: display.breakdown,
            updatedAt: typedRow.updated_at,
            // Include batch data in response
            nearestExpiry: batchSummary.nearestExpiry,
            totalBatches: batchSummary.totalBatches,
            criticalCount: batchSummary.criticalCount,
            warningCount: batchSummary.warningCount,
          };
        });

        span.setAttribute("inventory_count", inventory.length);

        return NextResponse.json<GetInventoryResponse>({
          success: true,
          inventory,
        });
      } catch (error) {
        console.error("[stock.inventory.get] Unexpected error:", error);
        span.markError(error);

        const message =
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการดึงข้อมูลสต็อก";

        return NextResponse.json<ErrorResponse>(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );
}

// ========================
// POST - Set Inventory (Admin Only) - Uses RPC for base unit conversion
// ========================

export async function POST(request: NextRequest) {
  return withTelemetrySpan<NextResponse>(
    "stock.inventory.set",
    async (span) => {
      try {
        const body = (await request.json()) as Partial<UpdateInventoryRequest>;

        // Validate required fields
        const { employee_id, store_id, product_id, unit_id, quantity } = body;

        if (!employee_id || !employee_id.trim()) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "กรุณาระบุ employee_id" },
            { status: 400 }
          );
        }

        if (!store_id || !store_id.trim()) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "กรุณาระบุ store_id" },
            { status: 400 }
          );
        }

        if (!product_id || !product_id.trim()) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "กรุณาระบุ product_id" },
            { status: 400 }
          );
        }

        if (!unit_id || !unit_id.trim()) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "กรุณาระบุ unit_id" },
            { status: 400 }
          );
        }

        if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 0) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "จำนวนสต็อกไม่ถูกต้อง" },
            { status: 400 }
          );
        }

        // Validate UUID formats
        if (!isValidUUID(employee_id.trim())) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "employee_id ไม่ถูกต้อง" },
            { status: 400 }
          );
        }

        if (!isValidUUID(store_id.trim())) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "store_id ไม่ถูกต้อง" },
            { status: 400 }
          );
        }

        if (!isValidUUID(product_id.trim())) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "product_id ไม่ถูกต้อง" },
            { status: 400 }
          );
        }

        if (!isValidUUID(unit_id.trim())) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "unit_id ไม่ถูกต้อง" },
            { status: 400 }
          );
        }

        span.setAttribute("employee_id", employee_id.trim());
        span.setAttribute("store_id", store_id.trim());
        span.setAttribute("product_id", product_id.trim());
        span.setAttribute("unit_id", unit_id.trim());
        span.setAttribute("quantity", quantity);

        const supabase = getSupabaseServiceClient();

        // Use RPC function to set stock (will convert to base unit automatically)
        // This replaces direct INSERT/UPDATE to stock_inventory
        type RpcResult = {
          transaction_id: string | null;
          balance_after: number;
          success: boolean;
          message: string;
        };

        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "add_stock_transaction",
          {
            p_employee_id: employee_id.trim(),
            p_store_id: store_id.trim(),
            p_product_id: product_id.trim(),
            p_unit_id: unit_id.trim(),
            p_transaction_type: "initial", // Use 'initial' type for setting stock
            p_quantity: quantity,
            p_note: "ตั้งค่าสต็อกโดย Admin",
          }
        );

        if (rpcError) {
          console.error("[stock.inventory.set] RPC error:", rpcError);
          span.markError(rpcError);
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "ไม่สามารถตั้งค่าสต็อกได้" },
            { status: 500 }
          );
        }

        if (!rpcData || rpcData.length === 0) {
          span.markError(new Error("RPC returned no data"));
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "ไม่สามารถตั้งค่าสต็อกได้" },
            { status: 500 }
          );
        }

        const result = rpcData[0] as RpcResult;

        if (!result.success) {
          span.markError(new Error(result.message));
          return NextResponse.json<ErrorResponse>(
            { success: false, error: result.message || "ไม่สามารถตั้งค่าสต็อกได้" },
            { status: 400 }
          );
        }

        span.setAttribute("transaction_id", result.transaction_id || "");
        span.setAttribute("balance_after", result.balance_after);

        return NextResponse.json<UpdateInventoryResponse>(
          {
            success: true,
            message: `ตั้งค่าสต็อกสำเร็จ (คงเหลือ: ${result.balance_after} หน่วยฐาน)`,
            inventory_id: result.transaction_id || "",
            quantity: result.balance_after,
          },
          { status: 200 }
        );
      } catch (error) {
        console.error("[stock.inventory.set] Unexpected error:", error);
        span.markError(error);

        const message =
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการตั้งค่าสต็อก";

        return NextResponse.json<ErrorResponse>(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );
}
