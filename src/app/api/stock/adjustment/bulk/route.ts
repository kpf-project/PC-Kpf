import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import { verifySession } from "@/lib/authSessions";
import { withTelemetrySpan } from "@/lib/observability";
import * as supabaseLogs from "@/lib/supabaseLogs";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =============================================
// Types
// =============================================

interface BatchSelection {
  batch_id: string;
  quantity: number; // Quantity in the selected unit
}

interface AdjustmentItem {
  transaction_type: "adjustment-add" | "adjustment-reduce" | "adjustment-set";
  employee_id: string;
  store_id: string;
  product_id: string;
  unit_id: string;
  quantity: number;
  adjustment_type: "add" | "reduce" | "set";
  adjustment_reason: string;
  selected_batches: BatchSelection[];
}

interface BulkAdjustmentRequest {
  adjustments: AdjustmentItem[];
}

interface AdjustmentResult {
  success: boolean;
  transaction_id?: string;
  balance_after?: number;
  error?: string;
  product_id: string;
  unit_id: string;
  quantity: number;
}

interface BulkAdjustmentResponse {
  success: boolean;
  results: AdjustmentResult[];
  total_success: number;
  total_failed: number;
  message: string;
}

interface ErrorResponse {
  success: false;
  message: string;
}

// =============================================
// Helper Functions
// =============================================

function isValidUUID(value: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(value);
}

function mapAdjustmentTypeToTransactionType(
  adjustmentType: "add" | "reduce" | "set"
): "receive" | "sale" | "adjustment" {
  switch (adjustmentType) {
    case "add":
      return "receive"; // Adding stock
    case "reduce":
      return "sale"; // Reducing stock
    case "set":
      return "adjustment"; // Setting exact amount
    default:
      return "adjustment";
  }
}

// =============================================
// POST - Bulk Stock Adjustment
// =============================================

export async function POST(request: NextRequest) {
  return withTelemetrySpan<NextResponse>(
    "stock.adjustment.bulk",
    async (span) => {
      try {
        // ✅ Verify authentication
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get('session')?.value;

        if (!sessionToken) {
          return NextResponse.json<ErrorResponse>(
            { success: false, message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
            { status: 401 }
          );
        }

        const session = await verifySession(sessionToken);
        if (!session) {
          return NextResponse.json<ErrorResponse>(
            { success: false, message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' },
            { status: 401 }
          );
        }

        const body = (await request.json()) as Partial<BulkAdjustmentRequest>;

        // Validate request body
        if (!body.adjustments || !Array.isArray(body.adjustments)) {
          return NextResponse.json<ErrorResponse>(
            { success: false, message: "กรุณาระบุรายการปรับสต็อก" },
            { status: 400 }
          );
        }

        if (body.adjustments.length === 0) {
          return NextResponse.json<ErrorResponse>(
            { success: false, message: "ไม่มีรายการปรับสต็อก" },
            { status: 400 }
          );
        }

        span.setAttribute("adjustment_count", body.adjustments.length);

        const supabase = getSupabaseServiceClient();
        const results: AdjustmentResult[] = [];

        // Process each adjustment
        for (const adjustment of body.adjustments) {
          try {
            // Validate required fields
            if (!adjustment.employee_id || !adjustment.employee_id.trim()) {
              results.push({
                success: false,
                error: "กรุณาระบุ employee_id",
                product_id: adjustment.product_id || "",
                unit_id: adjustment.unit_id || "",
                quantity: adjustment.quantity || 0,
              });
              continue;
            }

            if (!adjustment.store_id || !adjustment.store_id.trim()) {
              results.push({
                success: false,
                error: "กรุณาระบุ store_id",
                product_id: adjustment.product_id || "",
                unit_id: adjustment.unit_id || "",
                quantity: adjustment.quantity || 0,
              });
              continue;
            }

            if (!adjustment.product_id || !adjustment.product_id.trim()) {
              results.push({
                success: false,
                error: "กรุณาระบุ product_id",
                product_id: "",
                unit_id: adjustment.unit_id || "",
                quantity: adjustment.quantity || 0,
              });
              continue;
            }

            if (!adjustment.unit_id || !adjustment.unit_id.trim()) {
              results.push({
                success: false,
                error: "กรุณาระบุ unit_id",
                product_id: adjustment.product_id,
                unit_id: "",
                quantity: adjustment.quantity || 0,
              });
              continue;
            }

            if (typeof adjustment.quantity !== "number" || !Number.isFinite(adjustment.quantity)) {
              results.push({
                success: false,
                error: "จำนวนไม่ถูกต้อง",
                product_id: adjustment.product_id,
                unit_id: adjustment.unit_id,
                quantity: 0,
              });
              continue;
            }

            if (adjustment.quantity <= 0) {
              results.push({
                success: false,
                error: "จำนวนต้องมากกว่า 0",
                product_id: adjustment.product_id,
                unit_id: adjustment.unit_id,
                quantity: adjustment.quantity,
              });
              continue;
            }

            // Validate UUIDs
            if (!isValidUUID(adjustment.employee_id.trim())) {
              results.push({
                success: false,
                error: "employee_id ไม่ถูกต้อง",
                product_id: adjustment.product_id,
                unit_id: adjustment.unit_id,
                quantity: adjustment.quantity,
              });
              continue;
            }

            if (!isValidUUID(adjustment.store_id.trim())) {
              results.push({
                success: false,
                error: "store_id ไม่ถูกต้อง",
                product_id: adjustment.product_id,
                unit_id: adjustment.unit_id,
                quantity: adjustment.quantity,
              });
              continue;
            }

            if (!isValidUUID(adjustment.product_id.trim())) {
              results.push({
                success: false,
                error: "product_id ไม่ถูกต้อง",
                product_id: adjustment.product_id,
                unit_id: adjustment.unit_id,
                quantity: adjustment.quantity,
              });
              continue;
            }

            if (!isValidUUID(adjustment.unit_id.trim())) {
              results.push({
                success: false,
                error: "unit_id ไม่ถูกต้อง",
                product_id: adjustment.product_id,
                unit_id: adjustment.unit_id,
                quantity: adjustment.quantity,
              });
              continue;
            }

            // Map adjustment type to transaction type
            const transactionType = mapAdjustmentTypeToTransactionType(adjustment.adjustment_type);

            // Handle batch-specific adjustments
            if (adjustment.selected_batches && adjustment.selected_batches.length > 0) {
              // Process each batch separately
              for (const batch of adjustment.selected_batches) {
                if (!batch.batch_id || !batch.batch_id.trim()) {
                  console.warn("[bulk-adjustment] Skipping batch without batch_id");
                  continue;
                }

                if (!isValidUUID(batch.batch_id.trim())) {
                  console.warn("[bulk-adjustment] Invalid batch_id:", batch.batch_id);
                  continue;
                }

                if (typeof batch.quantity !== "number" || !Number.isFinite(batch.quantity) || batch.quantity <= 0) {
                  console.warn("[bulk-adjustment] Invalid batch quantity:", batch.quantity);
                  continue;
                }

                // Call RPC function for this batch
                type RpcArgs = Database["public"]["Functions"]["add_stock_transaction"]["Args"];
                const rpcArgs: RpcArgs = {
                  p_employee_id: adjustment.employee_id.trim(),
                  p_store_id: adjustment.store_id.trim(),
                  p_product_id: adjustment.product_id.trim(),
                  p_unit_id: adjustment.unit_id.trim(),
                  p_transaction_type: transactionType,
                  p_quantity: batch.quantity,
                  p_note: adjustment.adjustment_reason || undefined,
                  p_batch_id: batch.batch_id.trim(), // Critical: Link to specific batch
                };

                const { data: rpcData, error: rpcError } = await supabase.rpc(
                  "add_stock_transaction",
                  rpcArgs
                );

                if (rpcError) {
                  console.error("[bulk-adjustment] RPC error for batch:", rpcError);
                  results.push({
                    success: false,
                    error: rpcError.message || "ไม่สามารถบันทึกรายการได้",
                    product_id: adjustment.product_id,
                    unit_id: adjustment.unit_id,
                    quantity: batch.quantity,
                  });
                  continue;
                }

                if (!rpcData || rpcData.length === 0) {
                  results.push({
                    success: false,
                    error: "RPC returned no data",
                    product_id: adjustment.product_id,
                    unit_id: adjustment.unit_id,
                    quantity: batch.quantity,
                  });
                  continue;
                }

                const result = rpcData[0];

                if (!result.success) {
                  results.push({
                    success: false,
                    error: result.message || "ไม่สามารถบันทึกรายการได้",
                    product_id: adjustment.product_id,
                    unit_id: adjustment.unit_id,
                    quantity: batch.quantity,
                  });
                  continue;
                }

                results.push({
                  success: true,
                  transaction_id: result.transaction_id,
                  balance_after: result.balance_after,
                  product_id: adjustment.product_id,
                  unit_id: adjustment.unit_id,
                  quantity: batch.quantity,
                });
              }
            } else {
              // No batch selection - process as single adjustment
              type RpcArgs = Database["public"]["Functions"]["add_stock_transaction"]["Args"];
              const rpcArgs: RpcArgs = {
                p_employee_id: adjustment.employee_id.trim(),
                p_store_id: adjustment.store_id.trim(),
                p_product_id: adjustment.product_id.trim(),
                p_unit_id: adjustment.unit_id.trim(),
                p_transaction_type: transactionType,
                p_quantity: adjustment.quantity,
                p_note: adjustment.adjustment_reason || undefined,
              };

              const { data: rpcData, error: rpcError } = await supabase.rpc(
                "add_stock_transaction",
                rpcArgs
              );

              if (rpcError) {
                console.error("[bulk-adjustment] RPC error:", rpcError);
                results.push({
                  success: false,
                  error: rpcError.message || "ไม่สามารถบันทึกรายการได้",
                  product_id: adjustment.product_id,
                  unit_id: adjustment.unit_id,
                  quantity: adjustment.quantity,
                });
                continue;
              }

              if (!rpcData || rpcData.length === 0) {
                results.push({
                  success: false,
                  error: "RPC returned no data",
                  product_id: adjustment.product_id,
                  unit_id: adjustment.unit_id,
                  quantity: adjustment.quantity,
                });
                continue;
              }

              const result = rpcData[0];

              if (!result.success) {
                results.push({
                  success: false,
                  error: result.message || "ไม่สามารถบันทึกรายการได้",
                  product_id: adjustment.product_id,
                  unit_id: adjustment.unit_id,
                  quantity: adjustment.quantity,
                });
                continue;
              }

              results.push({
                success: true,
                transaction_id: result.transaction_id,
                balance_after: result.balance_after,
                product_id: adjustment.product_id,
                unit_id: adjustment.unit_id,
                quantity: adjustment.quantity,
              });
            }
          } catch (adjustmentError) {
            console.error("[bulk-adjustment] Error processing adjustment:", adjustmentError);
            results.push({
              success: false,
              error: adjustmentError instanceof Error ? adjustmentError.message : "เกิดข้อผิดพลาด",
              product_id: adjustment.product_id || "",
              unit_id: adjustment.unit_id || "",
              quantity: adjustment.quantity || 0,
            });
          }
        }

        // Calculate summary
        const total_success = results.filter((r) => r.success).length;
        const total_failed = results.filter((r) => !r.success).length;

        span.setAttribute("total_success", total_success);
        span.setAttribute("total_failed", total_failed);

        // Log bulk adjustment action
        await supabaseLogs.addLog({
          timestamp: new Date().toISOString(),
          scope: "stock",
          action: "bulk-adjustment",
          details: `ปรับสต็อกจำนวน ${body.adjustments.length} รายการ: สำเร็จ ${total_success}, ล้มเหลว ${total_failed}`,
          metadata: {
            userId: session.userId,
            total_items: body.adjustments.length,
            total_success,
            total_failed,
          },
        });

        // Determine overall success
        const overallSuccess = total_failed === 0;

        return NextResponse.json<BulkAdjustmentResponse>(
          {
            success: overallSuccess,
            results,
            total_success,
            total_failed,
            message: overallSuccess
              ? `บันทึกการปรับสต็อกสำเร็จทั้งหมด ${total_success} รายการ`
              : `บันทึกสำเร็จ ${total_success} รายการ, ล้มเหลว ${total_failed} รายการ`,
          },
          { status: overallSuccess ? 200 : 207 } // 207 Multi-Status for partial success
        );
      } catch (error) {
        console.error("[bulk-adjustment] Unexpected error:", error);
        span.markError(error);

        const message =
          error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึกการปรับสต็อก";

        return NextResponse.json<ErrorResponse>(
          { success: false, message },
          { status: 500 }
        );
      }
    }
  );
}
