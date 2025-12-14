import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import {
  deleteProductAssignment,
  updateProductAssignmentUnit,
  insertProductAssignmentUnit
} from "@/lib/supabaseProducts";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsPromise = {
  params: Promise<{ id: string }>;
};

type ProductUnitRow = Database["public"]["Tables"]["product_units"]["Row"];
type AssignmentUnitRow = Database["public"]["Tables"]["product_assignment_units"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["product_assignments"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];

interface UpdateAssignmentRequestBody {
  units: Array<{
    unitId: string;
    pricePc: number;
    enabled: boolean;
  }>;
}

interface AssignmentDetailsResponse {
  success: boolean;
  assignment?: {
    assignmentId: string;
    productId: string;
    productCode: string;
    productName: string;
    productDescription: string | null;
    employeeId: string;
    employeeName: string;
    storeId: string | null;
    storeName: string | null;
    createdAt: string;
    units: Array<{
      assignmentUnitId: string;
      unitId: string;
      unitName: string;
      unitSku: string | null;
      multiplierToBase: number;
      isBase: boolean;
      pricePc: number;
      isActive: boolean;
    }>;
    productUnits: Array<{
      unitId: string;
      unitName: string;
      unitSku: string | null;
      multiplierToBase: number;
      isBase: boolean;
    }>;
  };
  error?: string;
}

interface UpdateAssignmentResponse {
  success: boolean;
  assignment?: {
    assignmentId: string;
    updatedUnits: number;
  };
  error?: string;
}

interface DeleteAssignmentResponse {
  success: boolean;
  error?: string;
}

/**
 * GET /api/admin/product-assignments/[id]
 * ดึงข้อมูลรายละเอียดของการผูกสินค้ากับพนักงาน
 */
export async function GET(
  request: Request,
  context: ParamsPromise
): Promise<NextResponse<AssignmentDetailsResponse>> {
  try {
    const { id: assignmentId } = await context.params;

    if (!assignmentId || assignmentId.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          error: "กรุณาระบุรหัสการผูกสินค้า",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // ดึงข้อมูล assignment พร้อมกับ employee และ store
    const { data: assignmentRow, error: assignmentError } = await supabase
      .from("product_assignments")
      .select("*")
      .eq("id", assignmentId)
      .maybeSingle();

    if (assignmentError) {
      console.error("[product-assignments/[id]] assignment query error:", assignmentError);
      return NextResponse.json(
        {
          success: false,
          error: "ไม่สามารถดึงข้อมูลการผูกสินค้าได้",
        },
        { status: 500 }
      );
    }

    if (!assignmentRow) {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่พบข้อมูลการผูกสินค้านี้",
        },
        { status: 404 }
      );
    }

    // Type guard: assignmentRow is not null at this point
    const assignment: AssignmentRow = assignmentRow;

    // ดึงข้อมูล product
    const { data: productRow, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", assignment.product_id)
      .single();

    if (productError || !productRow) {
      console.error("[product-assignments/[id]] product query error:", productError);
      return NextResponse.json(
        {
          success: false,
          error: "ไม่พบข้อมูลสินค้า",
        },
        { status: 404 }
      );
    }

    const product: ProductRow = productRow;

    // ดึงข้อมูล employee
    const { data: employeeRow, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", assignment.employee_id)
      .single();

    if (employeeError || !employeeRow) {
      console.error("[product-assignments/[id]] employee query error:", employeeError);
      return NextResponse.json(
        {
          success: false,
          error: "ไม่พบข้อมูลพนักงาน",
        },
        { status: 404 }
      );
    }

    const employee: EmployeeRow = employeeRow;

    // ดึงข้อมูล store (ถ้ามี)
    let storeName: string | null = null;
    if (assignment.store_id) {
      const { data: storeRow } = await supabase
        .from("stores")
        .select("name")
        .eq("id", assignment.store_id)
        .single();
      storeName = (storeRow as { name: string } | null)?.name ?? null;
    }

    // ดึงข้อมูล product units ทั้งหมดของสินค้านี้
    const { data: productUnitsRows, error: productUnitsError } = await supabase
      .from("product_units")
      .select("*")
      .eq("product_id", assignment.product_id)
      .order("multiplier_to_base", { ascending: true });

    if (productUnitsError) {
      console.error("[product-assignments/[id]] product units query error:", productUnitsError);
      return NextResponse.json(
        {
          success: false,
          error: "ไม่สามารถดึงข้อมูลหน่วยสินค้าได้",
        },
        { status: 500 }
      );
    }

    const productUnits = (productUnitsRows ?? []).map((unit: ProductUnitRow) => ({
      unitId: unit.id,
      unitName: unit.name,
      unitSku: unit.sku ?? null,
      multiplierToBase: unit.multiplier_to_base,
      isBase: unit.is_base,
    }));

    // ดึงข้อมูล assignment units (ราคาที่กำหนดไว้)
    const { data: assignmentUnitsRows, error: assignmentUnitsError } = await supabase
      .from("product_assignment_units")
      .select("*")
      .eq("assignment_id", assignmentId);

    if (assignmentUnitsError) {
      console.error("[product-assignments/[id]] assignment units query error:", assignmentUnitsError);
      return NextResponse.json(
        {
          success: false,
          error: "ไม่สามารถดึงข้อมูลราคาสินค้าได้",
        },
        { status: 500 }
      );
    }

    // รวมข้อมูล assignment units กับ product units
    const units = (assignmentUnitsRows ?? []).map((assignmentUnit: AssignmentUnitRow) => {
      const productUnit = productUnits.find((u) => u.unitId === assignmentUnit.unit_id);
      return {
        assignmentUnitId: assignmentUnit.id,
        unitId: assignmentUnit.unit_id,
        unitName: productUnit?.unitName ?? "",
        unitSku: productUnit?.unitSku ?? null,
        multiplierToBase: productUnit?.multiplierToBase ?? 1,
        isBase: productUnit?.isBase ?? false,
        pricePc: assignmentUnit.price_pc,
        isActive: assignmentUnit.is_active,
      };
    });

    // เรียงลำดับ units ตาม multiplierToBase
    units.sort((a, b) => a.multiplierToBase - b.multiplierToBase);

    return NextResponse.json({
      success: true,
      assignment: {
        assignmentId: assignment.id,
        productId: assignment.product_id,
        productCode: product.code,
        productName: product.name,
        productDescription: product.description,
        employeeId: assignment.employee_id,
        employeeName: employee.name,
        storeId: assignment.store_id,
        storeName,
        createdAt: assignment.created_at,
        units,
        productUnits,
      },
    });
  } catch (error) {
    console.error("[product-assignments/[id]] GET error:", error);
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่คาดคิด";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/product-assignments/[id]
 * อัปเดตราคาและสถานะของหน่วยสินค้าในการผูกสินค้ากับพนักงาน
 */
export async function PUT(
  request: Request,
  context: ParamsPromise
): Promise<NextResponse<UpdateAssignmentResponse>> {
  try {
    const { id: assignmentId } = await context.params;

    if (!assignmentId || assignmentId.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          error: "กรุณาระบุรหัสการผูกสินค้า",
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Partial<UpdateAssignmentRequestBody>;

    if (!Array.isArray(body.units)) {
      return NextResponse.json(
        {
          success: false,
          error: "กรุณาระบุข้อมูลหน่วยสินค้าที่ต้องการอัปเดต",
        },
        { status: 400 }
      );
    }

    // ตรวจสอบว่ามีอย่างน้อย 1 หน่วยที่เปิดใช้งานและมีราคา > 0
    const enabledUnits = body.units.filter((unit) => unit.enabled && unit.pricePc > 0);
    if (enabledUnits.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "กรุณากำหนดราคาอย่างน้อย 1 หน่วยสินค้า",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // ตรวจสอบว่า assignment นี้มีอยู่จริง
    const { data: existingAssignment, error: checkError } = await supabase
      .from("product_assignments")
      .select("id")
      .eq("id", assignmentId)
      .maybeSingle();

    if (checkError) {
      console.error("[product-assignments/[id]] check assignment error:", checkError);
      return NextResponse.json(
        {
          success: false,
          error: "ไม่สามารถตรวจสอบข้อมูลการผูกสินค้าได้",
        },
        { status: 500 }
      );
    }

    if (!existingAssignment) {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่พบข้อมูลการผูกสินค้านี้",
        },
        { status: 404 }
      );
    }

    // ดึงข้อมูล assignment units ที่มีอยู่
    const { data: existingUnits, error: existingUnitsError } = await supabase
      .from("product_assignment_units")
      .select("id, unit_id")
      .eq("assignment_id", assignmentId);

    if (existingUnitsError) {
      console.error("[product-assignments/[id]] existing units error:", existingUnitsError);
      return NextResponse.json(
        {
          success: false,
          error: "ไม่สามารถดึงข้อมูลหน่วยสินค้าที่มีอยู่ได้",
        },
        { status: 500 }
      );
    }

    const existingUnitsMap = new Map<string, string>();
    (existingUnits ?? []).forEach((unit: { id: string; unit_id: string }) => {
      existingUnitsMap.set(unit.unit_id, unit.id);
    });

    let updatedCount = 0;
    const now = new Date().toISOString();

    // อัปเดตหรือสร้าง assignment units
    for (const unit of body.units) {
      const existingUnitId = existingUnitsMap.get(unit.unitId);

      if (existingUnitId) {
        // อัปเดต unit ที่มีอยู่
        try {
          await updateProductAssignmentUnit(
            existingUnitId,
            unit.pricePc,
            unit.enabled
          );
          updatedCount++;
        } catch (error) {
          console.error("[product-assignments/[id]] update unit error:", error);
          throw new Error(`ไม่สามารถอัปเดตหน่วย ${unit.unitId} ได้`);
        }
      } else if (unit.enabled) {
        // สร้าง unit ใหม่ (เฉพาะ unit ที่เปิดใช้งาน)
        try {
          await insertProductAssignmentUnit(
            assignmentId,
            unit.unitId,
            unit.pricePc,
            now
          );
          updatedCount++;
        } catch (error) {
          console.error("[product-assignments/[id]] insert unit error:", error);
          throw new Error(`ไม่สามารถเพิ่มหน่วย ${unit.unitId} ได้`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      assignment: {
        assignmentId,
        updatedUnits: updatedCount,
      },
    });
  } catch (error) {
    console.error("[product-assignments/[id]] PUT error:", error);
    const message = error instanceof Error ? error.message : "ไม่สามารถอัปเดตข้อมูลการผูกสินค้าได้";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/product-assignments/[id]
 * ลบการผูกสินค้ากับพนักงาน
 */
export async function DELETE(
  request: Request,
  context: ParamsPromise
): Promise<NextResponse<DeleteAssignmentResponse>> {
  try {
    const { id: assignmentId } = await context.params;

    if (!assignmentId || assignmentId.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          error: "กรุณาระบุรหัสการผูกสินค้า",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // ตรวจสอบว่า assignment นี้มีอยู่จริง
    const { data: existingAssignment, error: checkError } = await supabase
      .from("product_assignments")
      .select("id")
      .eq("id", assignmentId)
      .maybeSingle();

    if (checkError) {
      console.error("[product-assignments/[id]] check assignment error:", checkError);
      return NextResponse.json(
        {
          success: false,
          error: "ไม่สามารถตรวจสอบข้อมูลการผูกสินค้าได้",
        },
        { status: 500 }
      );
    }

    if (!existingAssignment) {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่พบข้อมูลการผูกสินค้านี้",
        },
        { status: 404 }
      );
    }

    // ลบ assignment (จะลบ assignment units ด้วยผ่าน deleteProductAssignment function)
    await deleteProductAssignment(assignmentId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[product-assignments/[id]] DELETE error:", error);
    const message = error instanceof Error ? error.message : "ไม่สามารถลบการผูกสินค้ากับพนักงานได้";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
