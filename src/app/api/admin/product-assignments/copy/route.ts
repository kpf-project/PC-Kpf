import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import { upsertProductAssignment } from "@/lib/supabaseProducts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CopyAssignmentRequest {
  fromEmployeeId: string;
  toEmployeeId: string;
  fromStoreId?: string | null;
  toStoreId?: string | null;
}

interface CopyAssignmentResponse {
  success: boolean;
  message: string;
  copied: number;
  skipped: number;
  errors?: string[];
}

/**
 * POST /api/admin/product-assignments/copy
 *
 * คัดลอกการผูกสินค้าจากพนักงานหนึ่งไปยังอีกพนักงานหนึ่ง
 * รองรับการคัดลอกทั้งแบบ global และเฉพาะร้าน
 */
export async function POST(request: Request): Promise<NextResponse<CopyAssignmentResponse>> {
  try {
    const body = (await request.json()) as CopyAssignmentRequest;
    const { fromEmployeeId, toEmployeeId, fromStoreId, toStoreId } = body;

    // Validate required fields
    if (!fromEmployeeId || !toEmployeeId) {
      return NextResponse.json(
        {
          success: false,
          message: "กรุณาระบุพนักงานต้นทางและปลายทาง",
          copied: 0,
          skipped: 0,
        },
        { status: 400 }
      );
    }

    if (fromEmployeeId === toEmployeeId && fromStoreId === toStoreId) {
      return NextResponse.json(
        {
          success: false,
          message: "ไม่สามารถคัดลอกไปยังพนักงานและร้านเดียวกันได้",
          copied: 0,
          skipped: 0,
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Fetch source assignments
    let query = supabase
      .from("product_assignments")
      .select(`
        product_id,
        store_id,
        product_assignment_units (
          unit_id,
          price_pc,
          is_active
        )
      `)
      .eq("employee_id", fromEmployeeId);

    // Filter by store if specified
    if (fromStoreId) {
      query = query.eq("store_id", fromStoreId);
    } else {
      query = query.is("store_id", null);
    }

    const { data: sourceAssignments, error: fetchError } = await query;

    if (fetchError) {
      console.error("[copy-assignments] Fetch error:", fetchError);
      return NextResponse.json(
        {
          success: false,
          message: "ไม่สามารถดึงข้อมูลการผูกสินค้าต้นทางได้",
          copied: 0,
          skipped: 0,
        },
        { status: 500 }
      );
    }

    if (!sourceAssignments || sourceAssignments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "ไม่พบการผูกสินค้าจากพนักงานต้นทาง",
          copied: 0,
          skipped: 0,
        },
        { status: 404 }
      );
    }

    // Copy each assignment to target employee
    let copiedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const assignment of sourceAssignments) {
      try {
        const units = (assignment.product_assignment_units || []) as Array<{
          unit_id: string;
          price_pc: number;
          is_active: boolean;
        }>;

        if (units.length === 0) {
          skippedCount++;
          continue;
        }

        await upsertProductAssignment({
          productId: assignment.product_id,
          employeeId: toEmployeeId,
          storeId: toStoreId || null,
          units: units.map((unit) => ({
            unitId: unit.unit_id,
            pricePc: unit.price_pc,
            enabled: unit.is_active,
          })),
        });

        copiedCount++;
      } catch (error) {
        skippedCount++;
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Product ${assignment.product_id}: ${message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `คัดลอกการผูกสินค้าสำเร็จ ${copiedCount} รายการ${skippedCount > 0 ? `, ข้าม ${skippedCount} รายการ` : ""}`,
      copied: copiedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error("[copy-assignments] Error:", error);
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการคัดลอกการผูกสินค้า";
    return NextResponse.json(
      {
        success: false,
        message,
        copied: 0,
        skipped: 0,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/product-assignments/copy?employeeId=xxx&storeId=yyy
 *
 * ดึงจำนวนการผูกสินค้าที่มีอยู่ (สำหรับแสดงก่อนคัดลอก)
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const storeId = searchParams.get("storeId");

    if (!employeeId) {
      return NextResponse.json(
        { success: false, message: "กรุณาระบุ employeeId" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    let query = supabase
      .from("product_assignments")
      .select("product_id", { count: "exact", head: true })
      .eq("employee_id", employeeId);

    if (storeId && storeId !== "null") {
      query = query.eq("store_id", storeId);
    } else {
      query = query.is("store_id", null);
    }

    const { count, error } = await query;

    if (error) {
      console.error("[copy-assignments] Count error:", error);
      return NextResponse.json(
        { success: false, message: "ไม่สามารถนับจำนวนการผูกสินค้าได้" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: count || 0,
    });
  } catch (error) {
    console.error("[copy-assignments] GET error:", error);
    return NextResponse.json(
      { success: false, message: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 }
    );
  }
}
