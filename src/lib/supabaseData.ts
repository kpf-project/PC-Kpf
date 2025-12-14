import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import type { Database } from "@/types/supabase";

function toTimeString(value: string | null | undefined) {
  if (!value) return "";
  if (value.length === 5) return value;
  if (value.length >= 8) return value.slice(0, 5);
  return value;
}

function formatNumber(value: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return Number.isFinite(value) ? value.toString() : "";
}

type AttendanceFilters = {
  startDate: string;
  endDate: string;
  employeeName?: string;
  storeName?: string | null;
};

type SalesFilters = {
  startDate: string;
  endDate: string;
  employeeName?: string;
  storeName?: string | null;
};

export async function fetchAttendanceSheetRows(filters: AttendanceFilters) {
  const client = getSupabaseServiceClient();
  const { startDate, endDate, employeeName, storeName } = filters;

  let query = client
    .from("attendance_records")
    .select(
      "recorded_date, recorded_time, status, employee_name, store_name, note, latitude, longitude, accuracy, location_display, photo_public_url, submitted_at, created_at",
    )
    .gte("recorded_date", startDate)
    .lte("recorded_date", endDate)
    .order("recorded_date", { ascending: true })
    .order("recorded_time", { ascending: true });

  if (employeeName) {
    query = query.eq("employee_name", employeeName);
  }

  if (storeName) {
    query = query.eq("store_name", storeName);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[supabase] attendance query error", error);
    return [] as unknown[][];
  }

  const rows = (data ?? []) as Database["public"]["Tables"]["attendance_records"]["Row"][];

  return rows.map((row) => {
    const submittedAt = row.submitted_at ?? row.created_at ?? new Date().toISOString();
    return [
      row.recorded_date ?? "",
      toTimeString(row.recorded_time),
      row.status ?? "",
      row.employee_name ?? "",
      row.store_name ?? "",
      row.note ?? "",
      formatNumber(row.latitude),
      formatNumber(row.longitude),
      formatNumber(row.accuracy),
      row.location_display ?? "",
      "", // legacy image formula column placeholder
      row.photo_public_url ?? "",
      submittedAt,
    ];
  });
}

export async function fetchSalesSheetRows(filters: SalesFilters) {
  const client = getSupabaseServiceClient();
  const { startDate, endDate, employeeName, storeName } = filters;

  let query = client
    .from("sales_records")
    .select(
      "recorded_date, recorded_time, employee_name, store_name, product_code, product_name, quantity, unit_price, total, unit_name, assignment_id, unit_id, submitted_at, created_at",
    )
    .gte("recorded_date", startDate)
    .lte("recorded_date", endDate)
    .order("recorded_date", { ascending: true })
    .order("recorded_time", { ascending: true });

  if (employeeName) {
    query = query.eq("employee_name", employeeName);
  }

  if (storeName) {
    query = query.eq("store_name", storeName);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[supabase] sales query error", error);
    return [] as unknown[][];
  }

  const rows = (data ?? []) as Database["public"]["Tables"]["sales_records"]["Row"][];

  return rows.map((row) => {
    const submittedAt = row.submitted_at ?? row.created_at ?? new Date().toISOString();
    return [
      row.recorded_date ?? "",
      toTimeString(row.recorded_time),
      row.employee_name ?? "",
      row.store_name ?? "",
      row.product_code ?? "",
      row.product_name ?? "",
      formatNumber(row.quantity),
      formatNumber(row.unit_price),
      formatNumber(row.total),
      // Removed: unit_price_company (was index 9), total_company (was index 10)
      row.unit_name ?? "",         // Now index 9 (was 11)
      row.assignment_id ?? "",     // Now index 10 (was 12)
      row.unit_id ?? "",           // Now index 11 (was 13)
      submittedAt,                 // Now index 12 (was 14)
    ];
  });
}

export function normalizeDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
