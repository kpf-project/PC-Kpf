/**
 * Supabase Leaves Operations
 *
 * This module handles all leave request operations via Supabase leave_requests table
 * Replaces filesystem-based storage from data/app-data.json
 */

import { getSupabaseServiceClient } from "./supabaseClient";
import type { Database } from "@/types/supabase";

type LeaveInsert = Database["public"]["Tables"]["leave_requests"]["Insert"];
type LeaveUpdate = Database["public"]["Tables"]["leave_requests"]["Update"];

export type LeaveStatus = "scheduled" | "approved" | "rejected" | "cancelled";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all leave requests with optional filtering
 */
export async function getLeaves(options?: {
  employeeId?: string;
  status?: LeaveStatus;
  startDate?: string;
  endDate?: string;
}): Promise<LeaveRequest[]> {
  const supabase = getSupabaseServiceClient();

  let query = supabase
    .from("leave_requests")
    .select("*")
    .order("start_date", { ascending: false });

  if (options?.employeeId) {
    query = query.eq("employee_id", options.employeeId);
  }

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  // Check for overlapping date ranges
  // A leave overlaps with the report range if:
  // leave.start_date <= report.endDate AND leave.end_date >= report.startDate
  if (options?.startDate && options?.endDate) {
    query = query
      .lte("start_date", options.endDate)
      .gte("end_date", options.startDate);
  } else if (options?.startDate) {
    query = query.gte("end_date", options.startDate);
  } else if (options?.endDate) {
    query = query.lte("start_date", options.endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[supabaseLeaves] Failed to fetch leaves:", error);
    throw new Error(`ไม่สามารถโหลดรายการลาได้: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    status: row.status as LeaveStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get a single leave request by ID
 */
export async function getLeave(id: string): Promise<LeaveRequest | null> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    console.error("[supabaseLeaves] Failed to fetch leave:", error);
    throw new Error(`ไม่สามารถโหลดรายการลาได้: ${error.message}`);
  }

  return {
    id: data.id,
    employeeId: data.employee_id,
    employeeName: data.employee_name,
    type: data.type,
    startDate: data.start_date,
    endDate: data.end_date,
    reason: data.reason,
    status: data.status as LeaveStatus,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Create a new leave request
 */
export async function createLeave(input: {
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status?: LeaveStatus;
}): Promise<LeaveRequest> {
  const supabase = getSupabaseServiceClient();

  // Validate dates
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);

  if (end < start) {
    throw new Error("วันที่สิ้นสุดต้องมากกว่าหรือเท่ากับวันที่เริ่มต้น");
  }

  const insertData: LeaveInsert = {
    employee_id: input.employeeId,
    employee_name: input.employeeName,
    type: input.type,
    start_date: input.startDate,
    end_date: input.endDate,
    reason: input.reason ?? null,
    status: input.status ?? "scheduled",
  };

  const { data, error } = await supabase
    .from("leave_requests")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("[supabaseLeaves] Failed to create leave:", error);
    throw new Error(`ไม่สามารถสร้างรายการลาได้: ${error.message}`);
  }

  return {
    id: data.id,
    employeeId: data.employee_id,
    employeeName: data.employee_name,
    type: data.type,
    startDate: data.start_date,
    endDate: data.end_date,
    reason: data.reason,
    status: data.status as LeaveStatus,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update an existing leave request
 */
export async function updateLeave(
  id: string,
  input: Partial<{
    employeeId: string;
    employeeName: string;
    type: string;
    startDate: string;
    endDate: string;
    reason: string | null;
    status: LeaveStatus;
  }>
): Promise<LeaveRequest> {
  const supabase = getSupabaseServiceClient();

  // Validate dates if both provided
  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    if (end < start) {
      throw new Error("วันที่สิ้นสุดต้องมากกว่าหรือเท่ากับวันที่เริ่มต้น");
    }
  }

  const updateData: LeaveUpdate = {
    ...(input.employeeId && { employee_id: input.employeeId }),
    ...(input.employeeName && { employee_name: input.employeeName }),
    ...(input.type && { type: input.type }),
    ...(input.startDate && { start_date: input.startDate }),
    ...(input.endDate && { end_date: input.endDate }),
    ...(input.reason !== undefined && { reason: input.reason }),
    ...(input.status && { status: input.status }),
  };

  const { data, error } = await supabase
    .from("leave_requests")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[supabaseLeaves] Failed to update leave:", error);
    throw new Error(`ไม่สามารถอัปเดตรายการลาได้: ${error.message}`);
  }

  return {
    id: data.id,
    employeeId: data.employee_id,
    employeeName: data.employee_name,
    type: data.type,
    startDate: data.start_date,
    endDate: data.end_date,
    reason: data.reason,
    status: data.status as LeaveStatus,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Delete a leave request
 */
export async function deleteLeave(id: string): Promise<void> {
  const supabase = getSupabaseServiceClient();

  const { error } = await supabase.from("leave_requests").delete().eq("id", id);

  if (error) {
    console.error("[supabaseLeaves] Failed to delete leave:", error);
    throw new Error(`ไม่สามารถลบรายการลาได้: ${error.message}`);
  }
}

/**
 * Approve or reject a leave request
 */
export async function updateLeaveStatus(
  id: string,
  status: "approved" | "rejected" | "cancelled"
): Promise<LeaveRequest> {
  return updateLeave(id, { status });
}
