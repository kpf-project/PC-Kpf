import { NextResponse } from "next/server";
import { listEmployeesFromSupabase, upsertEmployeeRecordToSupabase } from "@/lib/supabaseDirectory";
import { getEmployeeStoreAssignments } from "@/lib/supabaseEmployeeStores";
import { triggerAutomaticBackup } from "@/lib/supabaseBackup";

// ✅ Cache GET responses for 5 minutes (300 seconds)
// This reduces database load since employee data rarely changes
// Note: POST requests are never cached (by Next.js design)
export const revalidate = 300;

export async function GET() {
  const employees = await listEmployeesFromSupabase();

  if (!employees) {
    return NextResponse.json({ employees: [] });
  }

  // Fetch store assignments for each employee
  const employeesWithStores = await Promise.all(
    employees?.map(async (employee) => {
      const assignments = await getEmployeeStoreAssignments(employee.id);
      return {
        ...employee,
        storeIds: assignments.map(a => a.storeId),
      };
    })
  );

  return NextResponse.json({ employees: employeesWithStores });
}

export async function POST(request: Request) {
  try {
    const {
      name,
      employeeCode,
      phone,
      regularDayOff,
      province,
      region,
      defaultStoreId,
    } = (await request.json()) as {
      name?: string;
      employeeCode?: string;
      phone?: string;
      regularDayOff?: string;
      province?: string;
      region?: string;
      defaultStoreId?: string | null;
    };
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { ok: false, message: "กรุณาระบุชื่อพนักงาน" },
        { status: 400 },
      );
    }
    const now = new Date().toISOString();
    const employee = await upsertEmployeeRecordToSupabase({
      id: crypto.randomUUID(),
      name,
      employeeCode,
      phone,
      regularDayOff,
      province,
      region,
      defaultStoreId,
      createdAt: now,
      updatedAt: now,
    });

    // Trigger automatic backup after creating employee
    void triggerAutomaticBackup('employee', 'create', name).catch((err) =>
      console.error('[Employee API] Backup failed:', err)
    );

    return NextResponse.json({ ok: true, employee });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ไม่สามารถเพิ่มพนักงานได้";
    const isClientError = message.includes("กรุณา") || message.includes("มีชื่อ") || message.includes("รหัสพนักงาน");
    return NextResponse.json(
      { ok: false, message },
      { status: isClientError ? 400 : 500 },
    );
  }
}
