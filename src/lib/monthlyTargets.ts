/**
 * Monthly Sales Targets - Helper Functions
 *
 * This module provides functions for managing monthly sales targets including:
 * - Creating, reading, updating, and deleting targets
 * - Calculating progress against targets
 * - Employee target summaries
 *
 * All functions use Supabase as the primary data source.
 */

import { getSupabaseServiceClient } from "./supabaseClient";
import type { Database } from "@/types/supabase";

type MonthlyTargetRecord = Database["public"]["Tables"]["monthly_sales_targets"]["Row"];
type MonthlyTargetInsert = Database["public"]["Tables"]["monthly_sales_targets"]["Insert"];
type MonthlyTargetUpdate = Database["public"]["Tables"]["monthly_sales_targets"]["Update"];
type MonthlyTargetType = string;
type MonthlyTargetStatus = string;

export interface MonthlyTargetWithProgress extends MonthlyTargetRecord {
  progress?: {
    actual_revenue_pc: number;
    actual_quantity: number;
    revenue_achievement_percent: number;
    quantity_achievement_percent: number;
    overall_achievement_percent: number;
    is_achieved: boolean;
    days_elapsed: number;
    days_remaining: number;
  };
}

// ============================================================================
// Types
// ============================================================================

export interface CreateTargetParams {
  employeeId: string;
  employeeName: string;
  targetMonth: string; // YYYY-MM format
  targetType: MonthlyTargetType;
  targetRevenuePC?: number | null;
  targetQuantity?: number | null;
  notes?: string | null;
  createdBy?: string | null;
}

export interface UpdateTargetParams {
  targetRevenuePC?: number | null;
  targetQuantity?: number | null;
  targetType?: MonthlyTargetType;
  status?: MonthlyTargetStatus;
  notes?: string | null;
  updatedBy?: string | null;
}

export interface ListTargetsFilters {
  month?: string; // YYYY-MM
  employeeId?: string;
  status?: MonthlyTargetStatus;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new monthly sales target
 */
export async function createMonthlyTarget(
  params: CreateTargetParams
): Promise<MonthlyTargetRecord> {
  const supabase = getSupabaseServiceClient();

  // Validate target type and values
  if (params.targetType === "revenue" && !params.targetRevenuePC) {
    throw new Error("กรุณาระบุเป้าหมายยอดขาย สำหรับเป้าหมายประเภทยอดขาย");
  }
  if (params.targetType === "quantity" && !params.targetQuantity) {
    throw new Error("กรุณาระบุเป้าหมายจำนวนขาย สำหรับเป้าหมายประเภทจำนวนขาย");
  }
  if (
    params.targetType === "both" &&
    (!params.targetRevenuePC || !params.targetQuantity)
  ) {
    throw new Error("กรุณาระบุทั้งเป้าหมายยอดขายและจำนวนขาย สำหรับเป้าหมายแบบรวม");
  }

  // Validate month format
  if (!/^\d{4}-\d{2}$/.test(params.targetMonth)) {
    throw new Error("รูปแบบเดือนไม่ถูกต้อง ต้องเป็น YYYY-MM เท่านั้น");
  }

  const insertData: MonthlyTargetInsert = {
    employee_id: params.employeeId,
    employee_name: params.employeeName,
    target_month: params.targetMonth,
    target_type: params.targetType,
    target_revenue_pc: params.targetRevenuePC ?? null,
    target_quantity: params.targetQuantity ?? null,
    notes: params.notes ?? null,
    created_by: params.createdBy ?? null,
  };

  const { data, error } = await supabase
    .from("monthly_sales_targets")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      // Unique constraint violation
      throw new Error(
        `มีเป้าหมายสำหรับพนักงานนี้ในเดือน ${params.targetMonth} อยู่แล้ว`
      );
    }
    throw new Error(`ไม่สามารถสร้างเป้าหมายได้: ${error.message}`);
  }

  return data;
}

/**
 * Get all monthly targets with optional filtering
 */
export async function listMonthlyTargets(
  filters: ListTargetsFilters = {}
): Promise<MonthlyTargetRecord[]> {
  const supabase = getSupabaseServiceClient();

  let query = supabase
    .from("monthly_sales_targets")
    .select("*")
    .order("target_month", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.month) {
    query = query.eq("target_month", filters.month);
  }
  if (filters.employeeId) {
    query = query.eq("employee_id", filters.employeeId);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`ไม่สามารถโหลดรายการเป้าหมายได้: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Get a single target by ID
 */
export async function getMonthlyTarget(
  targetId: string
): Promise<MonthlyTargetRecord | null> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("monthly_sales_targets")
    .select("*")
    .eq("id", targetId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Not found
      return null;
    }
    throw new Error(`ไม่สามารถโหลดเป้าหมายได้: ${error.message}`);
  }

  return data;
}

/**
 * Update an existing monthly target
 */
export async function updateMonthlyTarget(
  targetId: string,
  params: UpdateTargetParams
): Promise<MonthlyTargetRecord> {
  const supabase = getSupabaseServiceClient();

  // Build update object
  const updateData: MonthlyTargetUpdate = {};

  if (params.targetRevenuePC !== undefined) {
    updateData.target_revenue_pc = params.targetRevenuePC;
  }
  if (params.targetQuantity !== undefined) {
    updateData.target_quantity = params.targetQuantity;
  }
  if (params.targetType) {
    updateData.target_type = params.targetType;
  }
  if (params.status) {
    updateData.status = params.status;
  }
  if (params.notes !== undefined) {
    updateData.notes = params.notes;
  }
  if (params.updatedBy) {
    updateData.updated_by = params.updatedBy;
  }

  // Validate if changing target_type
  if (params.targetType) {
    const existing = await getMonthlyTarget(targetId);
    if (!existing) {
      throw new Error("ไม่พบเป้าหมายที่ต้องการแก้ไข");
    }

    const newRevenuePC = params.targetRevenuePC ?? existing.target_revenue_pc;
    const newQuantity = params.targetQuantity ?? existing.target_quantity;

    if (params.targetType === "revenue" && !newRevenuePC) {
      throw new Error("กรุณาระบุเป้าหมายยอดขาย");
    }
    if (params.targetType === "quantity" && !newQuantity) {
      throw new Error("กรุณาระบุเป้าหมายจำนวนขาย");
    }
    if (params.targetType === "both" && (!newRevenuePC || !newQuantity)) {
      throw new Error("กรุณาระบุทั้งเป้าหมายยอดขายและจำนวนขาย");
    }
  }

  const { data, error } = await supabase
    .from("monthly_sales_targets")
    .update(updateData)
    .eq("id", targetId)
    .select()
    .single();

  if (error) {
    throw new Error(`ไม่สามารถอัปเดตเป้าหมายได้: ${error.message}`);
  }

  return data;
}

/**
 * Delete a monthly target
 */
export async function deleteMonthlyTarget(targetId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();

  const { error } = await supabase
    .from("monthly_sales_targets")
    .delete()
    .eq("id", targetId);

  if (error) {
    throw new Error(`ไม่สามารถลบเป้าหมายได้: ${error.message}`);
  }
}

// ============================================================================
// Progress Calculation
// ============================================================================

/**
 * Calculate progress for a specific target
 * Uses the database function for accurate calculation
 */
export async function calculateTargetProgress(
  employeeId: string,
  targetMonth: string
): Promise<MonthlyTargetWithProgress | null> {
  const supabase = getSupabaseServiceClient();

  // Get the base target record
  const { data: target, error: targetError } = await supabase
    .from("monthly_sales_targets")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("target_month", targetMonth)
    .single();

  if (targetError) {
    if (targetError.code === "PGRST116") {
      return null; // Not found
    }
    throw new Error(`ไม่สามารถโหลดเป้าหมายได้: ${targetError.message}`);
  }

  // Calculate progress using database function
  const { data: progressData, error: progressError } = await supabase.rpc(
    "calculate_target_progress",
    {
      p_employee_id: employeeId,
      p_target_month: targetMonth,
    }
  );

  if (progressError) {
    throw new Error(
      `ไม่สามารถคำนวณความคืบหน้าได้: ${progressError.message}`
    );
  }

  if (!progressData || progressData.length === 0) {
    throw new Error("ไม่พบข้อมูลความคืบหน้า");
  }

  const progress = progressData[0];

  // Combine target and progress data
  const targetWithProgress: MonthlyTargetWithProgress = {
    ...target,
    progress: {
      actual_revenue_pc: progress.actual_revenue_pc,
      actual_quantity: progress.actual_quantity,
      revenue_achievement_percent: progress.revenue_achievement_percent,
      quantity_achievement_percent: progress.quantity_achievement_percent,
      overall_achievement_percent: progress.overall_achievement_percent,
      is_achieved: progress.is_achieved,
      days_remaining: progress.days_remaining,
      days_elapsed: progress.days_elapsed,
    },
  };

  return targetWithProgress;
}

/**
 * Calculate progress for multiple targets
 */
export async function calculateMultipleTargetProgress(
  targets: MonthlyTargetRecord[]
): Promise<MonthlyTargetWithProgress[]> {
  const progressPromises = targets.map((target) =>
    calculateTargetProgress(target.employee_id, target.target_month)
  );

  const results = await Promise.allSettled(progressPromises);

  return results
    .filter((result) => result.status === "fulfilled" && result.value !== null)
    .map((result) => (result as PromiseFulfilledResult<MonthlyTargetWithProgress>).value);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Auto-complete past targets (mark as completed)
 * Should be called periodically (e.g., daily cron job)
 */
export async function autoCompletePastTargets(): Promise<number> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase.rpc("auto_complete_past_targets");

  if (error) {
    throw new Error(
      `ไม่สามารถปิดเป้าหมายที่หมดอายุได้: ${error.message}`
    );
  }

  return data ?? 0;
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Validate month format
 */
export function isValidMonthFormat(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month);
}

/**
 * Format month for display (Thai)
 */
export function formatMonthThai(month: string): string {
  const [year, monthNum] = month.split("-");
  const monthNames = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  const monthIndex = parseInt(monthNum, 10) - 1;
  const buddhistYear = parseInt(year, 10) + 543;
  return `${monthNames[monthIndex]} ${buddhistYear}`;
}

// ============================================================================
// Employee Summary
// ============================================================================

export interface EmployeeTargetSummary {
  employeeId: string;
  employeeName: string;
  currentMonth: {
    target: MonthlyTargetWithProgress | null;
    hasTarget: boolean;
  };
  recentHistory: Array<{
    month: string;
    targetRevenuePC: number | null;
    targetQuantity: number | null;
    actualRevenuePC: number;
    actualQuantity: number;
    achieved: boolean;
  }>;
  stats: {
    totalTargetsSet: number;
    targetsAchieved: number;
    achievementRate: number;
    averageAchievementPercent: number;
  };
}

/**
 * Get comprehensive summary of employee's targets
 * Includes current month target, recent history, and achievement statistics
 */
export async function getEmployeeTargetSummary(
  employeeId: string
): Promise<EmployeeTargetSummary> {
  const supabase = getSupabaseServiceClient();

  // Get employee name
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("name")
    .eq("id", employeeId)
    .single();

  if (employeeError) {
    throw new Error(`ไม่พบพนักงาน: ${employeeError.message}`);
  }

  const currentMonth = getCurrentMonth();

  // Get current month target with progress
  const currentTarget = await calculateTargetProgress(employeeId, currentMonth);

  // Get all targets for this employee (for history)
  const allTargets = await listMonthlyTargets({ employeeId });

  // Calculate stats
  const completedTargets = allTargets.filter((t) => t.status === "completed");
  const targetsWithProgress = await calculateMultipleTargetProgress(
    completedTargets
  );

  const achievedCount = targetsWithProgress.filter((t) => t.progress?.is_achieved ?? false).length;
  const totalCompleted = targetsWithProgress.length;
  const achievementRate =
    totalCompleted > 0 ? (achievedCount / totalCompleted) * 100 : 0;

  const avgAchievement =
    targetsWithProgress.length > 0
      ? targetsWithProgress.reduce(
          (sum, t) => sum + (t.progress?.overall_achievement_percent ?? 0),
          0
        ) / targetsWithProgress.length
      : 0;

  // Get recent history (last 6 months, excluding current month)
  const recentHistory = targetsWithProgress
    .filter((t) => t.target_month !== currentMonth)
    .sort(
      (a, b) =>
        new Date(b.target_month).getTime() - new Date(a.target_month).getTime()
    )
    .slice(0, 6)
    .map((t) => ({
      month: t.target_month,
      targetRevenuePC: t.target_revenue_pc,
      targetQuantity: t.target_quantity,
      actualRevenuePC: t.progress?.actual_revenue_pc ?? 0,
      actualQuantity: t.progress?.actual_quantity ?? 0,
      achieved: t.progress?.is_achieved ?? false,
    }));

  return {
    employeeId,
    employeeName: employee.name,
    currentMonth: {
      target: currentTarget,
      hasTarget: currentTarget !== null,
    },
    recentHistory,
    stats: {
      totalTargetsSet: allTargets.length,
      targetsAchieved: achievedCount,
      achievementRate: parseFloat(achievementRate.toFixed(2)),
      averageAchievementPercent: parseFloat(avgAchievement.toFixed(2)),
    },
  };
}
