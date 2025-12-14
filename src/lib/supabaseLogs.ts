/**
 * Supabase Logs Operations
 *
 * This module handles all log operations via Supabase app_logs table
 * Replaces filesystem-based logging from data/app-data.json
 */

import { getSupabaseServiceClient } from "./supabaseClient";
import type { Database, Json } from "@/types/supabase";

export type AppLogRow = Database["public"]["Tables"]["app_logs"]["Row"];
type AppLogInsert = Database["public"]["Tables"]["app_logs"]["Insert"];

export interface LogEntry {
  timestamp: string;
  action: string;
  scope: string;
  actorName?: string | null;
  actorId?: string | null;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
}

export type LogScope = string;

/**
 * Add a new log entry to Supabase
 */
export async function addLog(entry: LogEntry): Promise<AppLogRow> {
  const supabase = getSupabaseServiceClient();

  const logData: AppLogInsert = {
    timestamp: entry.timestamp,
    action: entry.action,
    scope: entry.scope,
    actor_name: entry.actorName ?? null,
    actor_id: entry.actorId ?? null,
    details: entry.details ?? null,
    metadata: entry.metadata ? (entry.metadata as Json) : undefined,
  };

  const { data, error } = await supabase
    .from("app_logs")
    .insert(logData)
    .select()
    .single();

  if (error) {
    console.error("[supabaseLogs] Failed to insert log:", error);
    throw new Error(`ไม่สามารถบันทึก log ได้: ${error.message}`);
  }

  return data;
}

/**
 * Get logs with optional filtering
 */
export async function getLogs(options?: {
  scope?: string;
  actorId?: string;
  limit?: number;
  offset?: number;
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
}): Promise<AppLogRow[]> {
  const supabase = getSupabaseServiceClient();

  let query = supabase
    .from("app_logs")
    .select("*")
    .order("timestamp", { ascending: false });

  if (options?.scope) {
    query = query.eq("scope", options.scope);
  }

  if (options?.actorId) {
    query = query.eq("actor_id", options.actorId);
  }

  if (options?.startDate) {
    query = query.gte("timestamp", options.startDate);
  }

  if (options?.endDate) {
    query = query.lte("timestamp", options.endDate);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(
      options.offset,
      options.offset + (options.limit ?? 100) - 1
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("[supabaseLogs] Failed to fetch logs:", error);
    throw new Error(`ไม่สามารถโหลด logs ได้: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Get log count with optional filtering
 */
export async function getLogCount(options?: {
  scope?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<number> {
  const supabase = getSupabaseServiceClient();

  let query = supabase
    .from("app_logs")
    .select("*", { count: "exact", head: true });

  if (options?.scope) {
    query = query.eq("scope", options.scope);
  }

  if (options?.actorId) {
    query = query.eq("actor_id", options.actorId);
  }

  if (options?.startDate) {
    query = query.gte("timestamp", options.startDate);
  }

  if (options?.endDate) {
    query = query.lte("timestamp", options.endDate);
  }

  const { count, error } = await query;

  if (error) {
    console.error("[supabaseLogs] Failed to count logs:", error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Delete old logs (for cleanup)
 * @param daysToKeep Number of days to keep logs (default: 90 days)
 */
export async function cleanupOldLogs(daysToKeep = 90): Promise<number> {
  const supabase = getSupabaseServiceClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  const cutoffIso = cutoffDate.toISOString();

  const { count, error } = await supabase
    .from("app_logs")
    .delete({ count: "exact" })
    .lt("timestamp", cutoffIso);

  if (error) {
    console.error("[supabaseLogs] Failed to cleanup logs:", error);
    throw new Error(`ไม่สามารถลบ logs เก่าได้: ${error.message}`);
  }

  return count ?? 0;
}
