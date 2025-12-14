import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import type { Database } from "@/types/supabase";

type EmployeeStoreAssignmentRow = Database["public"]["Tables"]["employee_store_assignments"]["Row"];
type EmployeeStoreAssignmentInsert = Database["public"]["Tables"]["employee_store_assignments"]["Insert"];
type EmployeeStoreAssignmentUpdate = Database["public"]["Tables"]["employee_store_assignments"]["Update"];

// Workaround for Supabase client type inference issue - .from() incorrectly infers 'never' in build context
// Using 'any' as intermediate type to bypass the type inference problem
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTypedClient = () => getSupabaseServiceClient() as any;

export type EmployeeStoreAssignment = {
  id: string;
  employeeId: string;
  storeId: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Get all store assignments for an employee
 */
export async function getEmployeeStoreAssignments(employeeId: string): Promise<EmployeeStoreAssignment[]> {
  const supabase = getTypedClient();

  const { data, error } = await supabase
    .from("employee_store_assignments")
    .select("*")
    .eq("employee_id", employeeId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[employee-stores] get assignments error", error);
    return [];
  }

  const rows: EmployeeStoreAssignmentRow[] = (data ?? []) as EmployeeStoreAssignmentRow[];
  return rows.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    storeId: row.store_id,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get the primary store for an employee
 */
export async function getEmployeePrimaryStore(employeeId: string): Promise<string | null> {
  const supabase = getTypedClient();

  const { data, error } = await supabase
    .from("employee_store_assignments")
    .select("store_id")
    .eq("employee_id", employeeId)
    .eq("is_primary", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const typedData = data as { store_id: string };
  return typedData.store_id;
}

/**
 * Set employee store assignments (replaces all existing assignments)
 */
export async function setEmployeeStoreAssignments(
  employeeId: string,
  storeIds: string[],
  primaryStoreId?: string | null
): Promise<void> {
  const supabase = getTypedClient();

  if (storeIds.length === 0) {
    // Remove all assignments
    await supabase
      .from("employee_store_assignments")
      .delete()
      .eq("employee_id", employeeId);
    return;
  }

  // Determine primary store
  let primary = primaryStoreId;
  if (!primary || !storeIds.includes(primary)) {
    // If no primary specified or primary not in list, use first store
    primary = storeIds[0];
  }

  // Delete existing assignments
  await supabase
    .from("employee_store_assignments")
    .delete()
    .eq("employee_id", employeeId);

  // Insert new assignments
  const now = new Date().toISOString();
  const assignments: EmployeeStoreAssignmentInsert[] = storeIds.map((storeId) => ({
    employee_id: employeeId,
    store_id: storeId,
    is_primary: storeId === primary,
    created_at: now,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("employee_store_assignments")
    .insert(assignments);

  if (error) {
    console.error("[employee-stores] set assignments error", error);
    throw new Error("ไม่สามารถบันทึกร้านค้าของพนักงานได้");
  }
}

/**
 * Add a store to an employee's assignments
 */
export async function addEmployeeStoreAssignment(
  employeeId: string,
  storeId: string,
  isPrimary: boolean = false
): Promise<void> {
  const supabase = getTypedClient();
  const now = new Date().toISOString();

  // Check if assignment already exists
  const { data: existing } = await supabase
    .from("employee_store_assignments")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (existing) {
    // Update existing assignment
    const updatePayload: EmployeeStoreAssignmentUpdate = {
      is_primary: isPrimary,
      updated_at: now,
    };
    await supabase
      .from("employee_store_assignments")
      .update(updatePayload)
      .eq("id", existing.id);
  } else {
    // Insert new assignment
    const insertPayload: EmployeeStoreAssignmentInsert = {
      employee_id: employeeId,
      store_id: storeId,
      is_primary: isPrimary,
      created_at: now,
      updated_at: now,
    };
    const { error } = await supabase
      .from("employee_store_assignments")
      .insert(insertPayload);

    if (error) {
      console.error("[employee-stores] add assignment error", error);
      throw new Error("ไม่สามารถเพิ่มร้านค้าให้พนักงานได้");
    }
  }
}

/**
 * Remove a store from an employee's assignments
 */
export async function removeEmployeeStoreAssignment(
  employeeId: string,
  storeId: string
): Promise<void> {
  const supabase = getTypedClient();

  const { error } = await supabase
    .from("employee_store_assignments")
    .delete()
    .eq("employee_id", employeeId)
    .eq("store_id", storeId);

  if (error) {
    console.error("[employee-stores] remove assignment error", error);
    throw new Error("ไม่สามารถลบร้านค้าของพนักงานได้");
  }
}

/**
 * Set a store as the primary store for an employee
 */
export async function setEmployeePrimaryStore(
  employeeId: string,
  storeId: string
): Promise<void> {
  const supabase = getTypedClient();
  const now = new Date().toISOString();

  // Check if employee has this store assigned
  const { data: existing } = await supabase
    .from("employee_store_assignments")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (!existing) {
    throw new Error("พนักงานยังไม่มีร้านค้านี้ในรายการ");
  }

  // The trigger will automatically unset other primary stores
  const updatePayload: EmployeeStoreAssignmentUpdate = {
    is_primary: true,
    updated_at: now,
  };
  const { error } = await supabase
    .from("employee_store_assignments")
    .update(updatePayload)
    .eq("employee_id", employeeId)
    .eq("store_id", storeId);

  if (error) {
    console.error("[employee-stores] set primary error", error);
    throw new Error("ไม่สามารถตั้งร้านค้าหลักได้");
  }
}

/**
 * Get all employees assigned to a specific store
 */
export async function getStoreEmployees(storeId: string): Promise<string[]> {
  const supabase = getTypedClient();

  const { data, error } = await supabase
    .from("employee_store_assignments")
    .select("employee_id")
    .eq("store_id", storeId);

  if (error) {
    console.error("[employee-stores] get store employees error", error);
    return [];
  }

  return (data ?? []).map((row: { employee_id: string }) => row.employee_id);
}
