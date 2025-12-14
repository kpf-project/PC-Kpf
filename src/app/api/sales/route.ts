import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addLog } from "@/lib/supabaseLogs";
import { getSupabaseServiceClient, assertSupabaseConfig } from "@/lib/supabaseClient";
import { verifySession } from "@/lib/authSessions";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SalesUnitPayload = {
  assignmentUnitId: string;
  quantity: number;
};

type SalesItemPayload = {
  assignmentId: string;
  units: SalesUnitPayload[];
};

type SalesPayload = {
  storeId?: string | null;
  storeName: string;
  employeeId?: string | null;
  employeeName: string;
  items: SalesItemPayload[];
  submittedAt?: string;
};

interface StockDeductionRecord {
  id: string;
  product_code: string | null;
  product_name: string | null;
  unit_id: string | null;
  quantity: number;
  employee_name: string | null;
  store_name: string | null;
  assignment_id: string | null;
}

const REQUIRED_SUPABASE_ENV: Array<keyof NodeJS.ProcessEnv> = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const SALES_TIME_ZONE = process.env.APP_TIMEZONE?.trim() || "Asia/Bangkok";

const CLIENT_ERROR_MESSAGES = new Set([
  "กรุณากรอกข้อมูลให้ครบถ้วน",
  "กรุณากรอกรายการสินค้าอย่างน้อย 1 รายการ",
  "กรุณากำหนดจำนวนสินค้ามากกว่า 0",
  "ไม่พบข้อมูลสินค้าในระบบ",
  "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
]);

function assertEnv() {
  for (const key of REQUIRED_SUPABASE_ENV) {
    if (!process.env[key] || process.env[key]!.trim().length === 0) {
      throw new Error("กรุณาตั้งค่าตัวแปรสภาพแวดล้อมของ Supabase ให้ครบ");
    }
  }
  assertSupabaseConfig();
}

function formatForSupabase(date: Date, timeZone: string) {
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return {
    date: dateFormatter.format(date),
    time: timeFormatter.format(date),
  };
}

function parsePositiveNumber(value: unknown, fieldLabel: string) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${fieldLabel} ต้องมากกว่า 0`);
  }
  return number;
}
export async function POST(request: Request) {
  try {
    // ✅ Verify session authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { ok: false, message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      );
    }

    const session = await verifySession(sessionToken);
    if (!session) {
      return NextResponse.json(
        { ok: false, message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' },
        { status: 401 }
      );
    }

    assertEnv();

    const raw = (await request.json()) as Partial<SalesPayload>;
    const storeName = raw.storeName?.trim() ?? "";
    const employeeName = raw.employeeName?.trim() ?? "";

    if (!storeName || !employeeName) {
      return NextResponse.json(
        { ok: false, message: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 },
      );
    }

    const rawItems = Array.isArray(raw.items) ? raw.items : [];
    if (rawItems.length === 0) {
      return NextResponse.json(
        { ok: false, message: "กรุณากรอกรายการสินค้าอย่างน้อย 1 รายการ" },
        { status: 400 },
      );
    }

    const normalizedItems = rawItems.map((item, itemIndex) => {
      if (!item || typeof item.assignmentId !== "string" || item.assignmentId.trim().length === 0) {
        throw new Error(`กรุณาเลือกสินค้าในแถวที่ ${itemIndex + 1}`);
      }
      const assignmentId = item.assignmentId.trim();
      const unitsInput = Array.isArray(item.units) ? item.units : [];
      if (unitsInput.length === 0) {
        throw new Error(`กรุณาระบุหน่วยสินค้าอย่างน้อย 1 หน่วย (แถวที่ ${itemIndex + 1})`);
      }
      const units = unitsInput.map((unit) => {
        if (!unit || typeof unit.assignmentUnitId !== "string" || unit.assignmentUnitId.trim().length === 0) {
          throw new Error(`กรุณาเลือกหน่วยสินค้า (แถวที่ ${itemIndex + 1})`);
        }
        return {
          assignmentUnitId: unit.assignmentUnitId.trim(),
          quantity: parsePositiveNumber(
            unit.quantity,
            `จำนวนสินค้า (แถวที่ ${itemIndex + 1})`
          ),
        };
      });
      return {
        assignmentId,
        units,
      };
    });

    const assignmentIds = Array.from(new Set(normalizedItems.map((item) => item.assignmentId)));
    const assignmentUnitIds = Array.from(
      new Set(normalizedItems.flatMap((item) => item.units.map((unit) => unit.assignmentUnitId))),
    );

    const supabase = getSupabaseServiceClient();

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("product_assignments")
      .select("id, product_id")
      .in("id", assignmentIds);

    if (assignmentError || !assignmentRows || assignmentRows.length !== assignmentIds.length) {
      throw new Error("ไม่พบข้อมูลสินค้าในระบบ");
    }

    // ✅ Properly typed - extract product IDs from assignments
    type AssignmentRow = Pick<Database['public']['Tables']['product_assignments']['Row'], 'id' | 'product_id'>;
    const typedAssignments = assignmentRows as AssignmentRow[];
    const productIds = Array.from(new Set(typedAssignments.map((row) => row.product_id)));

    const [productsResponse, assignmentUnitsResponse] = await Promise.all([
      supabase.from("products").select("id, code, name").in("id", productIds),
      supabase
        .from("product_assignment_units")
        .select("id, assignment_id, unit_id, price_pc, is_active")
        .in("id", assignmentUnitIds),
    ]);

    if (productsResponse.error || assignmentUnitsResponse.error) {
      throw new Error("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    }

    // ✅ Properly typed data structures
    type ProductRow = Pick<Database['public']['Tables']['products']['Row'], 'id' | 'code' | 'name'>;
    type AssignmentUnitRow = Pick<
      Database['public']['Tables']['product_assignment_units']['Row'],
      'id' | 'assignment_id' | 'unit_id' | 'price_pc' | 'is_active'
    >;

    const productsData = (productsResponse.data ?? []) as ProductRow[];
    const assignmentUnitData = (assignmentUnitsResponse.data ?? []) as AssignmentUnitRow[];

    if (assignmentUnitData.length !== assignmentUnitIds.length) {
      const foundIds = new Set(assignmentUnitData.map((row) => row.id));
      const missingIds = assignmentUnitIds.filter((id) => !foundIds.has(id));
      console.error("[sales] missing assignment units", { missingIds, assignmentUnitIds });
      throw new Error("ไม่พบข้อมูลสินค้าในระบบ");
    }

    const unitIds = Array.from(
      new Set(
        assignmentUnitData
          .map((row) => row.unit_id)
          .filter((id) => typeof id === "string" && id.length > 0),
      ),
    ) as string[];

    let unitsData: Array<{ id: string; name: string }> = [];
    if (unitIds.length > 0) {
      const { data: unitRows, error: unitError } = await supabase
        .from("product_units")
        .select("id, name")
        .in("id", unitIds);
      if (unitError) {
        console.error("[sales] fetch units error", unitError);
        throw new Error("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      }
      unitsData = unitRows ?? [];
    }

    // ✅ Build lookup maps with proper typing
    const assignmentById = new Map<string, AssignmentRow>(
      typedAssignments.map((row) => [row.id, row])
    );
    const productById = new Map<string, ProductRow>(
      productsData.map((row) => [row.id, row])
    );
    const assignmentUnitById = new Map<string, AssignmentUnitRow>(
      assignmentUnitData.map((row) => [row.id, row])
    );
    type UnitRow = Pick<Database['public']['Tables']['product_units']['Row'], 'id' | 'name'>;
    const unitById = new Map<string, UnitRow>(
      (unitsData as UnitRow[]).map((row) => [row.id, row])
    );

    const submittedAt = raw.submittedAt ? new Date(raw.submittedAt) : new Date();
    if (Number.isNaN(submittedAt.valueOf())) {
      throw new Error("กรุณากรอกข้อมูลให้ครบถ้วน");
    }

    const { date, time } = formatForSupabase(submittedAt, SALES_TIME_ZONE);
    const timestamp = submittedAt.toISOString();

    // ✅ Generate submission_id to group all sales transactions from this form submit
    const submissionId = crypto.randomUUID();

    const insertPayload: Array<Database["public"]["Tables"]["sales_records"]["Insert"]> = [];
    const logItems: Array<{
      productCode: string;
      productName: string;
      unitName: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }> = [];

    for (const item of normalizedItems) {
      const assignment = assignmentById.get(item.assignmentId);
      if (!assignment) {
        throw new Error("ไม่พบข้อมูลสินค้าในระบบ");
      }
      const product = productById.get(assignment.product_id);
      if (!product) {
        throw new Error("ไม่พบข้อมูลสินค้าในระบบ");
      }

      for (const unit of item.units) {
        const assignmentUnit = assignmentUnitById.get(unit.assignmentUnitId);
        if (!assignmentUnit || assignmentUnit.assignment_id !== item.assignmentId || !assignmentUnit.is_active) {
          throw new Error("ไม่พบข้อมูลสินค้าในระบบ");
        }
        const unitInfo = unitById.get(assignmentUnit.unit_id);
        if (!unitInfo) {
          console.error("[sales] missing product unit", {
            assignmentUnitId: assignmentUnit.id,
            unitId: assignmentUnit.unit_id,
            availableUnitIds: Array.from(unitById.keys()),
          });
          throw new Error("ไม่พบข้อมูลสินค้าในระบบ");
        }
        const quantity = unit.quantity;
        const unitPrice = assignmentUnit.price_pc ?? 0;
        if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
          throw new Error("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
        }
        const total = Number((quantity * unitPrice).toFixed(2));

        insertPayload.push({
          recorded_date: date,
          recorded_time: time,
          employee_name: employeeName,
          store_name: storeName,
          product_code: product.code,
          product_name: product.name,
          unit_name: unitInfo.name,
          quantity,
          unit_price: unitPrice,
          total,
          assignment_id: assignment.id,
          unit_id: unitInfo.id,
          submitted_at: timestamp,
        });

        logItems.push({
          productCode: product.code,
          productName: product.name,
          unitName: unitInfo.name,
          quantity,
          unitPrice,
          total,
        });
      }
    }

    if (insertPayload.length === 0) {
      throw new Error("กรุณากำหนดจำนวนสินค้ามากกว่า 0");
    }

    let insertedRecordIds: string[] = [];
    try {
      // ✅ Insert sales records with proper typing
      const { data: insertedData, error: insertError } = await supabase
        .from("sales_records")
        .insert(insertPayload)
        .select("id, product_code, product_name, unit_id, quantity, employee_name, store_name, assignment_id");

      if (insertError) {
        console.error('[sales] insert error', insertError);
        throw new Error(insertError.message ?? 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      }

      if (!insertedData || insertedData.length === 0) {
        throw new Error('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      }

      insertedRecordIds = insertedData.map((record: StockDeductionRecord) => record.id);
      void insertedRecordIds; // For future use (e.g., logging, debugging)

      // Extract employee_id and store_id from raw payload
      const employeeId = raw.employeeId?.trim();
      const storeId = raw.storeId?.trim();

      // Check if we can proceed with stock deduction (requires IDs)
      if (!employeeId || !storeId) {
        console.warn('[sales] skipping all stock deductions: missing employee_id or store_id in request payload');
      } else {
        // Process automatic stock deduction for each sales record
        const stockDeductionResults = await Promise.allSettled(
          insertedData.map(async (record: StockDeductionRecord) => {
            // Validate required fields for stock deduction
            if (!record.unit_id) {
              console.warn(`[sales] skipping stock deduction for record ${record.id}: missing unit_id`);
              return { success: false, recordId: record.id, reason: 'missing_unit_id' };
            }

            if (!record.assignment_id) {
              console.warn(`[sales] skipping stock deduction for record ${record.id}: missing assignment_id`);
              return { success: false, recordId: record.id, reason: 'missing_assignment_id' };
            }

            // Get assignment to find product_id
            const assignment = assignmentById.get(record.assignment_id);
            if (!assignment) {
              console.warn(`[sales] skipping stock deduction for record ${record.id}: assignment not found for id ${record.assignment_id}`);
              return { success: false, recordId: record.id, reason: 'assignment_not_found' };
            }

            try {
              // ✅ NEW: Use deduct_stock_multi_batch RPC for FEFO/FIFO hybrid auto deduction
              // This RPC will automatically:
              // 1. Select batches in FEFO/FIFO order (expiry_date first, then mfg_date)
              // 2. Deduct from multiple batches if needed
              // 3. Update stock_inventory aggregate
              // 4. Create stock_transactions for each batch
              // 5. Return detailed info about which batches were affected

              console.log(`[sales] Using deduct_stock_multi_batch (FEFO/FIFO hybrid) for ${record.product_name} (${Math.abs(record.quantity)} units)`);

              // ✅ Call new RPC function
              const { data: stockResult, error: stockError } = await supabase.rpc(
                'deduct_stock_multi_batch',
                {
                  p_employee_id: employeeId,
                  p_store_id: storeId,
                  p_product_id: assignment.product_id,
                  p_unit_id: record.unit_id,
                  p_quantity: Math.abs(record.quantity),
                  p_note: `ขายจากระบบ - ${record.product_name}`,
                  p_sales_record_id: record.id,
                }
              );

              if (stockError) {
                console.error(`[sales] deduct_stock_multi_batch failed for record ${record.id}:`, stockError);
                return { success: false, recordId: record.id, error: stockError.message };
              }

              if (!stockResult || !Array.isArray(stockResult) || stockResult.length === 0) {
                console.error(`[sales] deduct_stock_multi_batch returned no result for record ${record.id}`);
                return { success: false, recordId: record.id, reason: 'no_result' };
              }

              const result = stockResult[0] as {
                success: boolean;
                message: string;
                total_deducted: number;
                batches_affected: Array<{
                  batch_id: string;
                  lot_number: string;
                  mfg_date: string;
                  expiry_date: string | null;
                  quantity_deducted: number;
                  selection_reason: 'fefo' | 'fifo';
                  days_until_expiry: number | null;
                  transaction_id: string;
                }>;
              };

              if (!result.success) {
                // Stock deduction failed (insufficient stock) - log warning but continue
                console.warn(`[sales] stock insufficient for record ${record.id}: ${result.message}`);
                return {
                  success: false,
                  recordId: record.id,
                  message: result.message,
                };
              }

              // Success - stock was deducted from one or more batches
              console.log(`[sales] ✅ Stock deducted for record ${record.id}:`);
              console.log(`  - Total deducted: ${result.total_deducted} (base units)`);
              console.log(`  - Batches affected: ${result.batches_affected.length}`);
              result.batches_affected.forEach((batch, idx) => {
                console.log(`  - Batch ${idx + 1}: LOT-${batch.lot_number}, qty=${batch.quantity_deducted}, strategy=${batch.selection_reason.toUpperCase()}`);
              });

              // ✅ Update stock_transactions with original_quantity, original_unit_id, and submission_id
              // Note: RPC creates multiple transactions (one per batch), so we update all of them
              for (const batch of result.batches_affected) {
                const { error: updateError } = await supabase
                  .from('stock_transactions')
                  .update({
                    original_quantity: Math.abs(record.quantity),  // จำนวนที่ขายจริง (ของทั้งหมด)
                    original_unit_id: record.unit_id,              // หน่วยที่ขายจริง
                    submission_id: submissionId,                   // ✅ Group all sales from same submit
                  })
                  .eq('id', batch.transaction_id);

                if (updateError) {
                  console.warn(`[sales] Failed to update original quantity/unit/submission_id for transaction ${batch.transaction_id}:`, updateError);
                  // ไม่ fail ทั้งหมด เพราะ transaction หลักสำเร็จแล้ว
                }
              }

              return {
                success: true,
                recordId: record.id,
                totalDeducted: result.total_deducted,
                batchesAffected: result.batches_affected,
              };
            } catch (error) {
              console.error(`[sales] deduct_stock_multi_batch exception for record ${record.id}:`, error);
              return {
                success: false,
                recordId: record.id,
                error: error instanceof Error ? error.message : 'unknown_error',
              };
            }
          })
        );

        // Log stock deduction summary
        const successCount = stockDeductionResults.filter(
          result => result.status === 'fulfilled' && result.value.success
        ).length;
        const failureCount = stockDeductionResults.length - successCount;

        if (failureCount > 0) {
          console.warn(`[sales] stock deduction summary: ${successCount} succeeded, ${failureCount} failed`);
          stockDeductionResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && !result.value.success) {
              console.warn(`[sales] failed stock deduction ${index + 1}:`, result.value);
            } else if (result.status === 'rejected') {
              console.error(`[sales] rejected stock deduction ${index + 1}:`, result.reason);
            }
          });
        } else {
        }
      }

    } catch (error) {
      console.error('[sales] insert or stock deduction error', error);
      throw new Error(error instanceof Error ? error.message : 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    }

    const overallTotal = insertPayload.reduce((sum, record) => sum + (record.total ?? 0), 0);

    await addLog({
      timestamp,
      scope: "sales",
      action: "create",
      details: `บันทึกยอดขาย ${insertPayload.length} รายการ โดย ${employeeName}`,
      actorName: employeeName,
      metadata: {
        storeName,
        employeeName,
        items: logItems,
        total: overallTotal,
        submittedAt: timestamp,
      },
    });

    return NextResponse.json({ ok: true, total: overallTotal });
  } catch (error) {
    console.error("[sales] submit error", error);
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
    const isClientError = CLIENT_ERROR_MESSAGES.has(message) || message.includes("กรุณากรอกข้อมูล");
    return NextResponse.json({ ok: false, message }, { status: isClientError ? 400 : 500 });
  }
}
