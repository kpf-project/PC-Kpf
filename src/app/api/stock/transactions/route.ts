import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import { verifySession } from "@/lib/authSessions";
import { withTelemetrySpan } from "@/lib/observability";
import { stringify } from "csv-stringify/sync";
import ExcelJS from "exceljs";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_ZONE = process.env.APP_TIMEZONE?.trim() || "Asia/Bangkok";

// ========================
// Type Definitions
// ========================

type TransactionType = "receive" | "sale" | "return" | "initial" | "adjustment";

interface CreateTransactionRequest {
  employee_id: string;
  store_id: string;
  product_id: string;
  unit_id: string;
  transaction_type: TransactionType;
  quantity: number;
  note?: string;
  sales_record_id?: string;
  // Batch data (optional - manual entry for NEW batches on receive/initial)
  batch_data?: {
    lot_number?: string;  // ✅ Added: Lot/Batch number
    mfg_date?: string;
    exp_date?: string;
  };
  // Existing batch ID (optional - for linking returns to specific batches)
  batch_id?: string;
  // Submission ID (optional - to group transactions from the same form submission)
  submission_id?: string;
}

interface CreateTransactionResponse {
  success: true;
  transaction_id: string;
  balance_after: number;
  message: string;
}

interface TransactionRow {
  id: string;
  employee_id: string;
  employee_name: string;
  store_id: string;
  store_name: string;
  product_id: string;
  product_code: string;
  product_name: string;
  unit_id: string;
  unit_name: string;
  transaction_type: TransactionType;
  quantity: number;
  balance_after: number;
  note: string | null;
  sales_record_id: string | null;
  created_at: string;
}

interface GetTransactionsResponse {
  success: true;
  transactions: TransactionRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  summary?: {
    total_receive: number;
    total_sale: number;
    total_return: number;
    net_change: number;
  };
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

function isValidTransactionType(value: string): value is TransactionType {
  return ["receive", "sale", "return", "initial", "adjustment"].includes(value);
}

function getTransactionTypeLabel(type: TransactionType): string {
  const labels: Record<TransactionType, string> = {
    receive: "รับเข้า",
    sale: "ขาย",
    return: "รับคืน",
    initial: "ตั้งสต็อกเริ่มต้น",
    adjustment: "ปรับปรุง",
  };
  return labels[type] || type;
}

// ========================
// POST - Create Transaction
// ========================

export async function POST(request: NextRequest) {
  return withTelemetrySpan<NextResponse>(
    "stock.transaction.create",
    async (span) => {
      try {
        // ✅ Verify session authentication
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get('session')?.value;

        if (!sessionToken) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
            { status: 401 }
          );
        }

        const session = await verifySession(sessionToken);
        if (!session) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' },
            { status: 401 }
          );
        }

        const body = (await request.json()) as Partial<CreateTransactionRequest>;

        // Validate required fields
        const { employee_id, store_id, product_id, unit_id, transaction_type, quantity } = body;

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

        if (!transaction_type || !isValidTransactionType(transaction_type)) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "ประเภทการทำรายการไม่ถูกต้อง" },
            { status: 400 }
          );
        }

        // Validate quantity based on transaction type
        if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "จำนวนไม่ถูกต้อง" },
            { status: 400 }
          );
        }

        // Quantity cannot be zero
        if (quantity === 0) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "จำนวนต้องไม่เป็น 0" },
            { status: 400 }
          );
        }

        // For adjustment, allow negative values (for subtract/decrease)
        // For other types (receive, sale, return), only allow positive values
        if (transaction_type !== "adjustment" && quantity <= 0) {
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "จำนวนต้องมากกว่า 0" },
            { status: 400 }
          );
        }

        // Validate UUIDs
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
        span.setAttribute("transaction_type", transaction_type);
        span.setAttribute("quantity", quantity);

        const supabase = getSupabaseServiceClient();

        // ============================================================================
        // Choose RPC based on transaction_type
        // ============================================================================
        // - "sale" or "return" → Use deduct_stock_multi_batch (FEFO/FIFO hybrid)
        // - "receive" or "initial" → Use add_stock_transaction (adds stock)
        // - "adjustment" → Use add_stock_transaction (can add or remove)
        // ============================================================================

        let result: {
          transaction_id?: string;
          balance_after: number;
          success: boolean;
          message: string;
        };

        if (transaction_type === 'sale' || transaction_type === 'return') {
          // ✅ Use deduct_stock_multi_batch for sale and return (both reduce stock)
          console.log(`[stock.transaction.create] Using deduct_stock_multi_batch for ${transaction_type}`);

          const { data: rpcData, error: rpcError } = await supabase.rpc(
            'deduct_stock_multi_batch',
            {
              p_employee_id: employee_id.trim(),
              p_store_id: store_id.trim(),
              p_product_id: product_id.trim(),
              p_unit_id: unit_id.trim(),
              p_quantity: Math.abs(quantity),
              p_note: body.note?.trim() || `${transaction_type === 'return' ? 'คืนสินค้าไปคลังใหญ่' : 'ขายสินค้า'}`,
              p_sales_record_id: body.sales_record_id?.trim() || undefined,
            }
          );

          if (rpcError) {
            console.error("[stock.transaction.create] deduct_stock_multi_batch error:", rpcError);
            span.markError(rpcError);
            return NextResponse.json<ErrorResponse>(
              { success: false, error: rpcError.message || "ไม่สามารถบันทึกรายการได้" },
              { status: 500 }
            );
          }

          if (!rpcData || rpcData.length === 0) {
            span.markError(new Error("RPC returned no data"));
            return NextResponse.json<ErrorResponse>(
              { success: false, error: "ไม่สามารถบันทึกรายการได้" },
              { status: 500 }
            );
          }

          const multiResult = rpcData[0] as {
            success: boolean;
            message: string;
            total_deducted: number;
            batches_affected: Array<{ transaction_id: string }>;
          };

          if (!multiResult.success) {
            span.markError(new Error(multiResult.message));
            return NextResponse.json<ErrorResponse>(
              { success: false, error: multiResult.message },
              { status: 400 }
            );
          }

          // Use first transaction_id from batches_affected
          result = {
            transaction_id: multiResult.batches_affected?.[0]?.transaction_id,
            balance_after: multiResult.total_deducted,
            success: true,
            message: multiResult.message,
          };

          // ✅ UPDATE: Save original_quantity, original_unit_id, and submission_id for ALL transactions
          if (multiResult.batches_affected && multiResult.batches_affected.length > 0) {
            const transactionIds = multiResult.batches_affected.map(b => b.transaction_id);

            const updateData: {
              original_quantity: number;
              original_unit_id: string;
              submission_id?: string;
            } = {
              original_quantity: quantity,  // Original quantity user entered
              original_unit_id: unit_id.trim(),  // Original unit user selected
            };

            // Add submission_id if provided
            if (body.submission_id && body.submission_id.trim()) {
              updateData.submission_id = body.submission_id.trim();
            }

            const { error: updateError } = await supabase
              .from('stock_transactions')
              .update(updateData)
              .in('id', transactionIds);

            if (updateError) {
              console.error('[stock.transaction.create] Failed to update original quantity/unit/submission_id for sale/return:', updateError);
            }
          }

        } else {
          // ✅ Use add_stock_transaction for receive, initial, adjustment
          console.log(`[stock.transaction.create] Using add_stock_transaction for ${transaction_type}`);

          let batchIdForRpc: string | undefined = undefined;
          if (body.batch_id && body.batch_id.trim() && isValidUUID(body.batch_id.trim())) {
            batchIdForRpc = body.batch_id.trim();
            console.log('[stock.transaction.create] 🔗 Using batch_id for RPC:', batchIdForRpc);
          }

          type RpcArgs = Database["public"]["Functions"]["add_stock_transaction"]["Args"];
          const rpcArgs: RpcArgs = {
            p_employee_id: employee_id.trim(),
            p_store_id: store_id.trim(),
            p_product_id: product_id.trim(),
            p_unit_id: unit_id.trim(),
            p_transaction_type: transaction_type,
            p_quantity: quantity,
            p_note: body.note?.trim() || undefined,
            p_sales_record_id: body.sales_record_id?.trim() || undefined,
            p_batch_id: batchIdForRpc,
          };

          const { data: rpcData, error: rpcError } = await supabase.rpc(
            "add_stock_transaction",
            rpcArgs
          );

          if (rpcError) {
            console.error("[stock.transaction.create] add_stock_transaction error:", rpcError);
            span.markError(rpcError);
            return NextResponse.json<ErrorResponse>(
              { success: false, error: rpcError.message || "ไม่สามารถบันทึกรายการได้" },
              { status: 500 }
            );
          }

          if (!rpcData || rpcData.length === 0) {
            span.markError(new Error("RPC returned no data"));
            return NextResponse.json<ErrorResponse>(
              { success: false, error: "ไม่สามารถบันทึกรายการได้" },
              { status: 500 }
            );
          }

          result = rpcData[0];

          if (!result.success) {
            span.markError(new Error(result.message));
            return NextResponse.json<ErrorResponse>(
              { success: false, error: result.message || "ไม่สามารถบันทึกรายการได้" },
              { status: 400 }
            );
          }
        }

        if (!result.transaction_id) {
          span.markError(new Error("No transaction_id returned"));
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "ไม่สามารถบันทึกรายการได้" },
            { status: 500 }
          );
        }

        span.setAttribute("transaction_id", result.transaction_id);
        span.setAttribute("balance_after", result.balance_after);

        // ✅ Update transaction with original_quantity, original_unit_id, and submission_id
        // Only for add_stock_transaction (deduct_stock_multi_batch already handles this above)
        if (transaction_type !== 'sale' && transaction_type !== 'return') {
          const updateData: {
            original_quantity: number;
            original_unit_id: string;
            submission_id?: string;
          } = {
            original_quantity: quantity,
            original_unit_id: unit_id.trim(),
          };

          // Add submission_id if provided
          if (body.submission_id && body.submission_id.trim()) {
            updateData.submission_id = body.submission_id.trim();
          }

          const { error: updateError } = await supabase
            .from('stock_transactions')
            .update(updateData)
            .eq('id', result.transaction_id);

          if (updateError) {
            console.error('[stock.transaction.create] Failed to update original quantity/unit/submission_id:', updateError);
          }
        }

        // ✅ ALWAYS create/merge batch for receive/initial (batch is mandatory!)
        if (transaction_type === 'receive' || transaction_type === 'initial') {
          // Auto-generate batch data if not provided
          const batch_data = body.batch_data || {};

          // Get product code for LOT generation
          const { data: productData } = await supabase
            .from('products')
            .select('code')
            .eq('id', product_id.trim())
            .single();

          const productCode = productData?.code || 'UNKNOWN';

          // Auto-fill missing batch fields
          const lot_number = batch_data.lot_number?.trim() ||
            `LOT-${productCode}-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14)}`;
          const mfg_date = batch_data.mfg_date?.trim() ||
            new Date().toISOString().split('T')[0];  // ✅ Auto-fill today
          const exp_date = batch_data.exp_date?.trim() || null;  // ✅ NULL = FIFO

          console.log('[stock.transaction.create] 🔍 Batch data (auto-filled):', {
            lot_number,
            mfg_date,
            exp_date,
            transaction_type,
            product_id: product_id.trim(),
            auto_filled: !body.batch_data,
          });

          // Lot number is always available now (auto-generated)
          if (lot_number) {
            try {
              // ✅ Get unit multiplier to convert to base unit
              const { data: unitData, error: unitError } = await supabase
                .from('product_units')
                .select('multiplier_to_base')
                .eq('id', unit_id.trim())
                .single();

              if (unitError) {
                console.error('[stock.transaction.create] ❌ Failed to fetch unit multiplier:', unitError);
                throw unitError;
              }

              // Convert quantity to base unit (e.g., 5 boxes × 24 = 120 pieces)
              const quantityInBase = quantity * (unitData.multiplier_to_base || 1);

              console.log('[stock.transaction.create] 📊 Unit conversion:', {
                quantity_input: quantity,
                unit_id: unit_id.trim(),
                multiplier: unitData.multiplier_to_base,
                quantity_in_base: quantityInBase,
              });

              // ✅ FDA GMP/ISO 22000: Check if batch exists with same (product_id + lot_number + expiry_date)
              let batchQuery = supabase
                .from('stock_batches')
                .select('id, initial_quantity, remaining_quantity, lot_number, expiry_date, mfg_date')
                .eq('product_id', product_id.trim())
                .eq('employee_id', employee_id.trim())
                .eq('store_id', store_id.trim())
                .eq('lot_number', lot_number.trim());

              // Handle expiry_date: use .is() for null, .eq() for string
              if (exp_date && exp_date.trim()) {
                batchQuery = batchQuery.eq('expiry_date', exp_date.trim());
              } else {
                batchQuery = batchQuery.is('expiry_date', null);
              }

              const { data: existingBatch, error: findError } = await batchQuery.maybeSingle();

              if (findError) {
                console.error('[stock.transaction.create] ❌ Error finding existing batch:', findError);
                throw findError;
              }

              let batch;

              if (existingBatch) {
                // ✅ Batch exists → MERGE (add quantities)
                console.log('[stock.transaction.create] 🔄 Existing batch found, merging quantities:', {
                  batch_id: existingBatch.id,
                  lot_number: existingBatch.lot_number,
                  old_initial: existingBatch.initial_quantity,
                  old_remaining: existingBatch.remaining_quantity,
                  adding: quantityInBase,
                });

                const newInitialQuantity = (existingBatch.initial_quantity || 0) + quantityInBase;
                const newRemainingQuantity = (existingBatch.remaining_quantity || 0) + quantityInBase;

                const { data: updatedBatch, error: updateError } = await supabase
                  .from('stock_batches')
                  .update({
                    initial_quantity: newInitialQuantity,
                    remaining_quantity: newRemainingQuantity,
                    mfg_date: mfg_date,  // ✅ Use provided or default (already set above)
                  })
                  .eq('id', existingBatch.id)
                  .select()
                  .single();

                if (updateError) {
                  console.error('[stock.transaction.create] ❌ Batch merge error:', updateError);
                  throw updateError;
                }

                batch = updatedBatch;

                console.log('[stock.transaction.create] ✅ Batch merged successfully:', {
                  batch_id: batch.id,
                  lot_number: batch.lot_number,
                  new_initial: newInitialQuantity,
                  new_remaining: newRemainingQuantity,
                });
              } else {
                // ✅ No existing batch → CREATE NEW
                console.log('[stock.transaction.create] ➕ No existing batch, creating new one');

                const { data: newBatch, error: createError } = await supabase
                  .from('stock_batches')
                  .insert({
                    product_id: product_id.trim(),
                    employee_id: employee_id.trim(),
                    store_id: store_id.trim(),
                    lot_number: lot_number,
                    mfg_date: mfg_date,  // ✅ Already defaulted to today
                    expiry_date: exp_date,  // ✅ NULL if not provided
                    initial_quantity: quantityInBase,
                    remaining_quantity: quantityInBase,
                    created_by: session.userId,
                    note: `Batch for ${transaction_type}`,
                  })
                  .select()
                  .single();

                if (createError) {
                  console.error('[stock.transaction.create] ❌ Batch creation error:', createError);
                  console.error('[stock.transaction.create] Error details:', {
                    code: createError.code,
                    message: createError.message,
                    details: createError.details,
                    hint: createError.hint,
                  });
                  throw createError;
                }

                batch = newBatch;

                console.log('[stock.transaction.create] ✅ Batch created successfully:', {
                  batch_id: batch.id,
                  lot_number: batch.lot_number,
                  expiry_date: batch.expiry_date,
                });
              }

              // Link batch to transaction (whether merged or newly created)
              if (batch) {
                const { error: linkError } = await supabase
                  .from('stock_transactions')
                  .update({ batch_id: batch.id })
                  .eq('id', result.transaction_id);

                if (linkError) {
                  console.error('[stock.transaction.create] ❌ Failed to link batch to transaction:', linkError);
                } else {
                  console.log('[stock.transaction.create] ✅ Batch linked to transaction');
                }
              }
            } catch (batchError) {
              console.error('[stock.transaction.create] ❌ Batch error (caught):', batchError);
              // Don't fail the whole transaction if batch creation fails
              throw batchError;  // ✅ Fail if batch creation fails (batch is mandatory)
            }
          }
        }

        const typeLabel = getTransactionTypeLabel(transaction_type);

        return NextResponse.json<CreateTransactionResponse>(
          {
            success: true,
            transaction_id: result.transaction_id,
            balance_after: result.balance_after,
            message: `${typeLabel}สต็อกสำเร็จ ยอดคงเหลือ: ${result.balance_after}`,
          },
          { status: 201 }
        );
      } catch (error) {
        console.error("[stock.transaction.create] Unexpected error:", error);
        span.markError(error);

        const message =
          error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึกรายการ";

        return NextResponse.json<ErrorResponse>(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );
}

// ========================
// GET - Fetch Transactions
// ========================

export async function GET(request: NextRequest) {
  return withTelemetrySpan<NextResponse>(
    "stock.transaction.list",
    async (span) => {
      try {
        const { searchParams } = new URL(request.url);

        // Extract filters
        const employee_id = searchParams.get("employee_id");
        const store_id = searchParams.get("store_id");
        const product_id = searchParams.get("product_id");
        const unit_id = searchParams.get("unit_id");
        const transaction_type = searchParams.get("transaction_type");
        const start_date = searchParams.get("start_date");
        const end_date = searchParams.get("end_date");
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
        const exportFormat = searchParams.get("export");

        span.setAttribute("page", page);
        span.setAttribute("limit", limit);
        span.setAttribute("export_format", exportFormat || "none");

        const supabase = getSupabaseServiceClient();

        // Build query
        // ✅ Join with product_units to get original_unit_name
        let query = supabase
          .from("stock_transactions")
          .select(`
            *,
            original_unit:product_units!original_unit_id(name)
          `, { count: "exact" });

        // Apply filters
        if (employee_id && employee_id.trim() && isValidUUID(employee_id.trim())) {
          query = query.eq("employee_id", employee_id.trim());
          span.setAttribute("filter_employee", true);
        }

        if (store_id && store_id.trim() && isValidUUID(store_id.trim())) {
          query = query.eq("store_id", store_id.trim());
          span.setAttribute("filter_store", true);
        }

        if (product_id && product_id.trim() && isValidUUID(product_id.trim())) {
          query = query.eq("product_id", product_id.trim());
          span.setAttribute("filter_product", true);
        }

        if (unit_id && unit_id.trim() && isValidUUID(unit_id.trim())) {
          query = query.eq("unit_id", unit_id.trim());
          span.setAttribute("filter_unit", true);
        }

        if (
          transaction_type &&
          transaction_type !== "all" &&
          isValidTransactionType(transaction_type)
        ) {
          query = query.eq("transaction_type", transaction_type);
          span.setAttribute("filter_transaction_type", transaction_type);
        }

        // Date range filter
        if (start_date && /^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
          query = query.gte("created_at", `${start_date}T00:00:00Z`);
          span.setAttribute("filter_start_date", start_date);
        }

        if (end_date && /^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
          query = query.lte("created_at", `${end_date}T23:59:59Z`);
          span.setAttribute("filter_end_date", end_date);
        }

        // Order by created_at descending
        query = query.order("created_at", { ascending: false });

        // Execute query with pagination
        const offset = (page - 1) * limit;
        const { data: transactions, error: queryError, count } = await query.range(
          offset,
          offset + limit - 1
        );

        if (queryError) {
          console.error("[stock.transaction.list] Query error:", queryError);
          span.markError(queryError);
          return NextResponse.json<ErrorResponse>(
            { success: false, error: "ไม่สามารถดึงข้อมูลรายการได้" },
            { status: 500 }
          );
        }

        const typedTransactions = (transactions || []) as TransactionRow[];
        const total = count || 0;
        const total_pages = Math.ceil(total / limit);

        span.setAttribute("total_transactions", total);
        span.setAttribute("total_pages", total_pages);

        // Calculate summary
        const summary = {
          total_receive: typedTransactions
            .filter((t) => t.transaction_type === "receive")
            .reduce((sum, t) => sum + t.quantity, 0),
          total_sale: typedTransactions
            .filter((t) => t.transaction_type === "sale")
            .reduce((sum, t) => sum + t.quantity, 0),
          total_return: typedTransactions
            .filter((t) => t.transaction_type === "return")
            .reduce((sum, t) => sum + t.quantity, 0),
          net_change: 0,
        };

        summary.net_change = summary.total_receive + summary.total_return - summary.total_sale;

        // Handle export
        if (exportFormat === "csv") {
          return generateCSVExport(typedTransactions);
        }

        if (exportFormat === "xlsx") {
          return generateExcelExport(typedTransactions);
        }

        // Return JSON response
        return NextResponse.json<GetTransactionsResponse>({
          success: true,
          transactions: typedTransactions,
          pagination: {
            page,
            limit,
            total,
            total_pages,
          },
          summary,
        });
      } catch (error) {
        console.error("[stock.transaction.list] Unexpected error:", error);
        span.markError(error);

        const message =
          error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการดึงข้อมูลรายการ";

        return NextResponse.json<ErrorResponse>(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );
}

// ========================
// Export Functions
// ========================

/**
 * Generate CSV export
 */
function generateCSVExport(transactions: TransactionRow[]): NextResponse {
  const headers = [
    "วันที่",
    "เวลา",
    "พนักงาน",
    "ร้าน",
    "รหัสสินค้า",
    "ชื่อสินค้า",
    "หน่วย",
    "ประเภท",
    "จำนวน",
    "คงเหลือหลังทำรายการ",
    "หมายเหตุ",
  ];

  const rows = transactions.map((t) => {
    const date = new Date(t.created_at);
    const dateStr = date.toLocaleDateString("th-TH", { timeZone: TIME_ZONE });
    const timeStr = date.toLocaleTimeString("th-TH", {
      timeZone: TIME_ZONE,
      hour12: false,
    });

    return [
      dateStr,
      timeStr,
      t.employee_name,
      t.store_name,
      t.product_code,
      t.product_name,
      t.unit_name,
      getTransactionTypeLabel(t.transaction_type),
      t.quantity.toString(),
      t.balance_after.toString(),
      t.note || "",
    ];
  });

  const csv = stringify([headers, ...rows], {
    bom: true,
    quoted: true,
  });

  const filename = `stock-transactions-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Generate Excel export
 */
async function generateExcelExport(transactions: TransactionRow[]): Promise<NextResponse> {
  const workbook = new ExcelJS.Workbook();

  // Summary sheet
  const summarySheet = workbook.addWorksheet("สรุป");

  summarySheet.columns = [
    { key: "label", width: 30 },
    { key: "value", width: 20 },
  ];

  const summary = {
    total_receive: transactions
      .filter((t) => t.transaction_type === "receive")
      .reduce((sum, t) => sum + t.quantity, 0),
    total_sale: transactions
      .filter((t) => t.transaction_type === "sale")
      .reduce((sum, t) => sum + t.quantity, 0),
    total_return: transactions
      .filter((t) => t.transaction_type === "return")
      .reduce((sum, t) => sum + t.quantity, 0),
  };

  summarySheet.addRows([
    { label: "รับเข้าทั้งหมด", value: summary.total_receive },
    { label: "ขายทั้งหมด", value: summary.total_sale },
    { label: "รับคืนทั้งหมด", value: summary.total_return },
    { label: "สุทธิ", value: summary.total_receive + summary.total_return - summary.total_sale },
  ]);

  // Detail sheet
  const detailSheet = workbook.addWorksheet("รายการทั้งหมด");

  detailSheet.columns = [
    { header: "วันที่", key: "date", width: 15 },
    { header: "เวลา", key: "time", width: 12 },
    { header: "พนักงาน", key: "employee", width: 25 },
    { header: "ร้าน", key: "store", width: 25 },
    { header: "รหัสสินค้า", key: "code", width: 15 },
    { header: "ชื่อสินค้า", key: "product", width: 30 },
    { header: "หน่วย", key: "unit", width: 12 },
    { header: "ประเภท", key: "type", width: 12 },
    { header: "จำนวน", key: "quantity", width: 12 },
    { header: "คงเหลือ", key: "balance", width: 12 },
    { header: "หมายเหตุ", key: "note", width: 30 },
  ];

  transactions.forEach((t) => {
    const date = new Date(t.created_at);
    detailSheet.addRow({
      date: date.toLocaleDateString("th-TH", { timeZone: TIME_ZONE }),
      time: date.toLocaleTimeString("th-TH", {
        timeZone: TIME_ZONE,
        hour12: false,
      }),
      employee: t.employee_name,
      store: t.store_name,
      code: t.product_code,
      product: t.product_name,
      unit: t.unit_name,
      type: getTransactionTypeLabel(t.transaction_type),
      quantity: t.quantity,
      balance: t.balance_after,
      note: t.note || "",
    });
  });

  // Style headers
  detailSheet.getRow(1).font = { bold: true };
  detailSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  const filename = `stock-transactions-${new Date().toISOString().split("T")[0]}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
