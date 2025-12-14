/**
 * Supabase Day-Off Swaps Operations
 *
 * This module handles all day-off swap request operations via Supabase day_off_swaps table
 * Allows employees to swap their regular day-off or public holidays with working days
 */

import { getSupabaseServiceClient } from "./supabaseClient";
import type { Database } from "@/types/supabase";

type SwapInsert = Database["public"]["Tables"]["day_off_swaps"]["Insert"];
type SwapUpdate = Database["public"]["Tables"]["day_off_swaps"]["Update"];

export type SwapType = "regular-day-off" | "public-holiday";
export type SwapStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface DayOffSwap {
  id: string;
  employeeId: string;
  workOnDate: string; // วันที่จะมาทำงาน (ปกติเป็นวันหยุด)
  offOnDate: string; // วันที่จะหยุดแทน (ปกติเป็นวันทำงาน)
  swapType: SwapType;
  originalSchedule: string | null; // เช่น "Sunday", "2025-12-31 (วันสิ้นปี)"
  reason: string | null;
  status: SwapStatus;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all day-off swaps with optional filtering
 */
export async function getDayOffSwaps(options?: {
  employeeId?: string;
  status?: SwapStatus;
  startDate?: string; // Filter swaps affecting dates >= startDate
  endDate?: string; // Filter swaps affecting dates <= endDate
}): Promise<DayOffSwap[]> {
  const supabase = getSupabaseServiceClient();

  let query = supabase
    .from("day_off_swaps")
    .select("*")
    .order("work_on_date", { ascending: false });

  if (options?.employeeId) {
    query = query.eq("employee_id", options.employeeId);
  }

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  // Filter by date range - include swaps where either work_on_date or off_on_date falls in range
  if (options?.startDate && options?.endDate) {
    query = query.or(
      `work_on_date.gte.${options.startDate},work_on_date.lte.${options.endDate},off_on_date.gte.${options.startDate},off_on_date.lte.${options.endDate}`
    );
  } else if (options?.startDate) {
    query = query.or(
      `work_on_date.gte.${options.startDate},off_on_date.gte.${options.startDate}`
    );
  } else if (options?.endDate) {
    query = query.or(
      `work_on_date.lte.${options.endDate},off_on_date.lte.${options.endDate}`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("[supabaseDayOffSwaps] Failed to fetch swaps:", error);
    throw new Error(`ไม่สามารถโหลดรายการสลับวันหยุดได้: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    workOnDate: row.work_on_date,
    offOnDate: row.off_on_date,
    swapType: row.swap_type as SwapType,
    originalSchedule: row.original_schedule,
    reason: row.reason,
    status: row.status as SwapStatus,
    requestedAt: row.requested_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get a single day-off swap by ID
 */
export async function getDayOffSwap(id: string): Promise<DayOffSwap | null> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("day_off_swaps")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    console.error("[supabaseDayOffSwaps] Failed to fetch swap:", error);
    throw new Error(`ไม่สามารถโหลดรายการสลับวันหยุดได้: ${error.message}`);
  }

  return {
    id: data.id,
    employeeId: data.employee_id,
    workOnDate: data.work_on_date,
    offOnDate: data.off_on_date,
    swapType: data.swap_type as SwapType,
    originalSchedule: data.original_schedule,
    reason: data.reason,
    status: data.status as SwapStatus,
    requestedAt: data.requested_at,
    reviewedBy: data.reviewed_by,
    reviewedAt: data.reviewed_at,
    adminNotes: data.admin_notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Create a new day-off swap request
 */
export async function createDayOffSwap(input: {
  employeeId: string;
  workOnDate: string; // YYYY-MM-DD
  offOnDate: string; // YYYY-MM-DD
  swapType: SwapType;
  originalSchedule?: string | null;
  reason?: string | null;
  status?: SwapStatus;
}): Promise<DayOffSwap> {
  const supabase = getSupabaseServiceClient();

  // Validate dates
  const workDate = new Date(input.workOnDate);
  const offDate = new Date(input.offOnDate);

  if (workDate.getTime() === offDate.getTime()) {
    throw new Error("วันที่มาทำงานและวันที่หยุดแทนต้องไม่ใช่วันเดียวกัน");
  }

  // Check for existing swap on the same work_on_date
  const { data: existing } = await supabase
    .from("day_off_swaps")
    .select("id")
    .eq("employee_id", input.employeeId)
    .eq("work_on_date", input.workOnDate)
    .single();

  if (existing) {
    throw new Error("มีการสลับวันหยุดสำหรับวันที่นี้อยู่แล้ว");
  }

  const insertData: SwapInsert = {
    employee_id: input.employeeId,
    work_on_date: input.workOnDate,
    off_on_date: input.offOnDate,
    swap_type: input.swapType,
    original_schedule: input.originalSchedule ?? null,
    reason: input.reason ?? null,
    status: input.status ?? "pending",
  };

  const { data, error } = await supabase
    .from("day_off_swaps")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("[supabaseDayOffSwaps] Failed to create swap:", error);
    throw new Error(`ไม่สามารถสร้างรายการสลับวันหยุดได้: ${error.message}`);
  }

  return {
    id: data.id,
    employeeId: data.employee_id,
    workOnDate: data.work_on_date,
    offOnDate: data.off_on_date,
    swapType: data.swap_type as SwapType,
    originalSchedule: data.original_schedule,
    reason: data.reason,
    status: data.status as SwapStatus,
    requestedAt: data.requested_at,
    reviewedBy: data.reviewed_by,
    reviewedAt: data.reviewed_at,
    adminNotes: data.admin_notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update an existing day-off swap request
 */
export async function updateDayOffSwap(
  id: string,
  input: Partial<{
    workOnDate: string;
    offOnDate: string;
    swapType: SwapType;
    originalSchedule: string | null;
    reason: string | null;
    status: SwapStatus;
    reviewedBy: string | null;
    adminNotes: string | null;
  }>
): Promise<DayOffSwap> {
  const supabase = getSupabaseServiceClient();

  // Validate dates if both provided
  if (input.workOnDate && input.offOnDate) {
    const workDate = new Date(input.workOnDate);
    const offDate = new Date(input.offOnDate);

    if (workDate.getTime() === offDate.getTime()) {
      throw new Error("วันที่มาทำงานและวันที่หยุดแทนต้องไม่ใช่วันเดียวกัน");
    }
  }

  const updateData: SwapUpdate = {
    ...(input.workOnDate && { work_on_date: input.workOnDate }),
    ...(input.offOnDate && { off_on_date: input.offOnDate }),
    ...(input.swapType && { swap_type: input.swapType }),
    ...(input.originalSchedule !== undefined && { original_schedule: input.originalSchedule }),
    ...(input.reason !== undefined && { reason: input.reason }),
    ...(input.status && { status: input.status }),
    ...(input.reviewedBy !== undefined && { reviewed_by: input.reviewedBy }),
    ...(input.adminNotes !== undefined && { admin_notes: input.adminNotes }),
  };

  // If status is being changed to approved/rejected, set reviewed_at
  if (input.status && (input.status === "approved" || input.status === "rejected")) {
    updateData.reviewed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("day_off_swaps")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[supabaseDayOffSwaps] Failed to update swap:", error);
    throw new Error(`ไม่สามารถอัปเดตรายการสลับวันหยุดได้: ${error.message}`);
  }

  return {
    id: data.id,
    employeeId: data.employee_id,
    workOnDate: data.work_on_date,
    offOnDate: data.off_on_date,
    swapType: data.swap_type as SwapType,
    originalSchedule: data.original_schedule,
    reason: data.reason,
    status: data.status as SwapStatus,
    requestedAt: data.requested_at,
    reviewedBy: data.reviewed_by,
    reviewedAt: data.reviewed_at,
    adminNotes: data.admin_notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Delete a day-off swap request
 */
export async function deleteDayOffSwap(id: string): Promise<void> {
  const supabase = getSupabaseServiceClient();

  const { error } = await supabase.from("day_off_swaps").delete().eq("id", id);

  if (error) {
    console.error("[supabaseDayOffSwaps] Failed to delete swap:", error);
    throw new Error(`ไม่สามารถลบรายการสลับวันหยุดได้: ${error.message}`);
  }
}

/**
 * Approve or reject a day-off swap request
 */
export async function updateSwapStatus(
  id: string,
  status: "approved" | "rejected" | "cancelled",
  reviewedBy?: string | null,
  adminNotes?: string | null
): Promise<DayOffSwap> {
  return updateDayOffSwap(id, {
    status,
    reviewedBy,
    adminNotes,
  });
}

/**
 * Format date in Thai format for swap notes
 * e.g., "2025-11-20" -> "วันพฤหัส 20 พ.ย."
 */
function formatSwapDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  const dayFormatter = new Intl.DateTimeFormat("th-TH", {
    timeZone: "UTC",
    weekday: "long",
  });
  const dateFormatter = new Intl.DateTimeFormat("th-TH", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });

  const dayName = dayFormatter.format(date);
  const dateLabel = dateFormatter.format(date);

  return `วัน${dayName} ${dateLabel}`;
}

/**
 * Get approved swaps for an employee in a date range
 * Used by attendance report to determine which days are swapped
 */
export async function getApprovedSwaps(
  employeeId: string,
  startDate: string,
  endDate: string
): Promise<{
  workDates: Set<string>; // Days when employee will work (normally off)
  offDates: Map<string, string>; // Days when employee will be off (normally work) -> formatted note
}> {
  const swaps = await getDayOffSwaps({
    employeeId,
    status: "approved",
    startDate,
    endDate,
  });

  const workDates = new Set<string>();
  const offDates = new Map<string, string>();

  for (const swap of swaps) {
    // Add work date
    workDates.add(swap.workOnDate);

    // Build formatted note for off date
    // e.g., "สลับวันหยุด (กับวันพฤหัส 20 พ.ย.)"
    const workDateFormatted = formatSwapDate(swap.workOnDate);
    const offDateNote = `สลับวันหยุด (กับ${workDateFormatted})`;
    offDates.set(swap.offOnDate, offDateNote);
  }

  return { workDates, offDates };
}
