import { NextRequest, NextResponse } from "next/server";
import { listEmployeesFromSupabase, listStoresFromSupabase } from "@/lib/supabaseDirectory";
import {
  getEmployeeStoreAssignments,
  setEmployeeStoreAssignments,
  removeEmployeeStoreAssignment,
} from "@/lib/supabaseEmployeeStores";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsPromise = {
  params: Promise<{ id: string }>;
};

interface EmployeeStoreAssignmentWithDetails {
  id: string;
  employeeId: string;
  storeId: string;
  storeName: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GetStoresResponse {
  success: true;
  assignments: EmployeeStoreAssignmentWithDetails[];
}

interface PutStoresRequest {
  storeIds: string[];
  primaryStoreId?: string | null;
}

interface SuccessResponse {
  success: true;
  message?: string;
}

interface ErrorResponse {
  success: false;
  error: string;
}

/**
 * GET /api/admin/employees/[id]/stores
 * Get all stores assigned to an employee
 */
export async function GET(
  request: NextRequest,
  context: ParamsPromise
): Promise<NextResponse<GetStoresResponse | ErrorResponse>> {
  try {
    const { id: employeeId } = await context.params;

    // Validate employee exists
    const employees = await listEmployeesFromSupabase();
    const employee = employees?.find((emp) => emp.id === employeeId);
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "ไม่พบพนักงานที่ระบุ" },
        { status: 404 }
      );
    }

    // Get store assignments from Supabase
    const assignments = await getEmployeeStoreAssignments(employeeId);

    // Get store details to include store names
    const stores = await listStoresFromSupabase();
    const storeMap = new Map(stores?.map((store) => [store.id, store.name]));

    // Combine assignment data with store names
    const assignmentsWithDetails: EmployeeStoreAssignmentWithDetails[] = assignments.map(
      (assignment) => ({
        id: assignment.id,
        employeeId: assignment.employeeId,
        storeId: assignment.storeId,
        storeName: storeMap.get(assignment.storeId) ?? "ไม่ทราบชื่อร้าน",
        isPrimary: assignment.isPrimary,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
      })
    );

    return NextResponse.json({
      success: true,
      assignments: assignmentsWithDetails,
    });
  } catch (error) {
    console.error("[employee-stores-api] GET error:", error);
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการดึงข้อมูลร้านค้า";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/employees/[id]/stores
 * Update all store assignments for an employee
 */
export async function PUT(
  request: NextRequest,
  context: ParamsPromise
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { id: employeeId } = await context.params;

    // Validate employee exists
    const employees = await listEmployeesFromSupabase();
    const employee = employees?.find((emp) => emp.id === employeeId);
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "ไม่พบพนักงานที่ระบุ" },
        { status: 404 }
      );
    }

    // Parse request body
    const body = (await request.json()) as PutStoresRequest;
    const { storeIds, primaryStoreId } = body;

    // Validate storeIds is an array
    if (!Array.isArray(storeIds)) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุรายการร้านค้าในรูปแบบ array" },
        { status: 400 }
      );
    }

    // Validate that all stores exist (if storeIds is not empty)
    if (storeIds.length > 0) {
      const stores = await listStoresFromSupabase();
      const storeIdSet = new Set(stores?.map((store) => store.id));

      const invalidStores = storeIds.filter((storeId) => !storeIdSet.has(storeId));
      if (invalidStores.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `ไม่พบร้านค้าที่ระบุ: ${invalidStores.join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Validate primaryStoreId is in storeIds (if provided)
      if (primaryStoreId && !storeIds.includes(primaryStoreId)) {
        return NextResponse.json(
          {
            success: false,
            error: "ร้านค้าหลักต้องอยู่ในรายการร้านค้าที่เลือก",
          },
          { status: 400 }
        );
      }
    }

    // Update store assignments in Supabase
    await setEmployeeStoreAssignments(
      employeeId,
      storeIds,
      primaryStoreId ?? null
    );

    // Update legacy default_store_id in employees table for backward compatibility
    // DISABLED: employees table is not in type definitions, causing build errors
    // TODO: Re-enable once employees table is added to Supabase types
    /*
    const supabase = getSupabaseServiceClient();
    const legacyDefaultStoreId =
      storeIds.length > 0 ? (primaryStoreId ?? storeIds[0]) : null;

    const updatePayload = {
      default_store_id: legacyDefaultStoreId,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("employees")
      .update(updatePayload)
      .eq("id", employeeId);

    if (updateError) {
      console.error(
        "[employee-stores-api] legacy update error:",
        updateError
      );
      // Don't fail the request if legacy update fails
      // The main operation (setEmployeeStoreAssignments) has already succeeded
    }
    */

    return NextResponse.json({
      success: true,
      message: "บันทึกร้านค้าของพนักงานเรียบร้อยแล้ว",
    });
  } catch (error) {
    console.error("[employee-stores-api] PUT error:", error);
    const message = error instanceof Error ? error.message : "ไม่สามารถบันทึกร้านค้าของพนักงานได้";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/employees/[id]/stores?storeId=xxx
 * Remove a specific store from an employee's assignments
 */
export async function DELETE(
  request: NextRequest,
  context: ParamsPromise
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { id: employeeId } = await context.params;

    // Validate employee exists
    const employees = await listEmployeesFromSupabase();
    const employee = employees?.find((emp) => emp.id === employeeId);
    if (!employee) {
      return NextResponse.json(
        { success: false, error: "ไม่พบพนักงานที่ระบุ" },
        { status: 404 }
      );
    }

    // Get storeId from query params
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId");

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุ storeId ใน query parameter" },
        { status: 400 }
      );
    }

    // Validate store exists
    const stores = await listStoresFromSupabase();
    const storeExists = stores?.some((store) => store.id === storeId) ?? false;
    if (!storeExists) {
      return NextResponse.json(
        { success: false, error: "ไม่พบร้านค้าที่ระบุ" },
        { status: 404 }
      );
    }

    // Remove the store assignment
    await removeEmployeeStoreAssignment(employeeId, storeId);

    // Update legacy default_store_id if the removed store was the primary one
    const _remainingAssignments = await getEmployeeStoreAssignments(employeeId);
    // DISABLED: employees table is not in type definitions, causing build errors
    // TODO: Re-enable once employees table is added to Supabase types
    /*
    const supabase = getSupabaseServiceClient();

    const newDefaultStoreId =
      remainingAssignments.length > 0
        ? remainingAssignments.find((a) => a.isPrimary)?.storeId ??
          remainingAssignments[0].storeId
        : null;

    const { error: updateError } = await supabase
      .from("employees")
      .update({
        default_store_id: newDefaultStoreId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", employeeId);

    if (updateError) {
      console.error(
        "[employee-stores-api] legacy update error after delete:",
        updateError
      );
      // Don't fail the request if legacy update fails
    }
    */

    return NextResponse.json({
      success: true,
      message: "ลบร้านค้าจากพนักงานเรียบร้อยแล้ว",
    });
  } catch (error) {
    console.error("[employee-stores-api] DELETE error:", error);
    const message = error instanceof Error ? error.message : "ไม่สามารถลบร้านค้าของพนักงานได้";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
