import { getSupabaseServiceClient } from "./supabaseClient";
import type { Database, Json } from "@/types/supabase";

type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];

export type ExpenseItem = {
  id: string;
  label: string;
  amount: number;
  note?: string;
};

export type ExpenseEntry = {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  store: string;
  baseline: number;
  currency: string;
  items: ExpenseItem[];
  effectiveMonth: string;
  lastUpdated: string;
};

function rowToExpenseEntry(row: ExpenseRow): ExpenseEntry {
  return {
    id: row.id,
    employeeId: row.employee_id,
    name: row.employee_name,
    role: row.role,
    store: row.store,
    baseline: row.baseline,
    currency: row.currency,
    items: Array.isArray(row.items) ? (row.items as ExpenseItem[]) : [],
    effectiveMonth: row.effective_month,
    lastUpdated: row.last_updated,
  };
}

function expenseEntryToInsert(entry: ExpenseEntry): ExpenseInsert {
  return {
    id: entry.id,
    employee_id: entry.employeeId,
    employee_name: entry.name,
    role: entry.role,
    store: entry.store,
    baseline: entry.baseline,
    currency: entry.currency,
    items: entry.items as Json,
    effective_month: entry.effectiveMonth,
    last_updated: new Date().toISOString(),
  };
}

/**
 * Get all expenses from Supabase
 */
export async function listExpenses(): Promise<ExpenseEntry[]> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("effective_month", { ascending: false });

  if (error) {
    console.error("[supabaseExpenses] list error", error);
    throw new Error("ไม่สามารถดึงข้อมูลค่าใช้จ่ายได้");
  }

  return (data || []).map(rowToExpenseEntry);
}

/**
 * Get expense by ID
 */
export async function getExpense(id: string): Promise<ExpenseEntry | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    console.error("[supabaseExpenses] get error", error);
    throw new Error("ไม่สามารถดึงข้อมูลค่าใช้จ่ายได้");
  }

  return rowToExpenseEntry(data);
}

/**
 * Upsert expense (insert or update if exists)
 */
export async function upsertExpense(entry: ExpenseEntry): Promise<ExpenseEntry> {
  const supabase = getSupabaseServiceClient();
  const insert = expenseEntryToInsert(entry);

  const { data, error } = await supabase
    .from("expenses")
    .upsert(insert, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    console.error("[supabaseExpenses] upsert error", error);
    throw new Error("ไม่สามารถบันทึกข้อมูลค่าใช้จ่ายได้");
  }

  return rowToExpenseEntry(data);
}

/**
 * Delete expense by ID
 */
export async function deleteExpense(id: string): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[supabaseExpenses] delete error", error);
    throw new Error("ไม่สามารถลบข้อมูลค่าใช้จ่ายได้");
  }
}
