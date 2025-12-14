/**
 * PC Daily Report Helper Functions
 *
 * This module provides helper functions for:
 * - Photo upload to Supabase Storage
 * - Report CRUD operations
 * - Stock usage calculations
 * - Data validation and transformation
 */

import { getSupabaseServiceClient } from "./supabaseClient";
import type { Database } from "@/types/supabase";

type PCDailyReport = Database["public"]["Tables"]["pc_daily_reports"]["Row"];
type PCDailyReportInsert = Database["public"]["Tables"]["pc_daily_reports"]["Insert"];
type PCDailyReportUpdate = Database["public"]["Tables"]["pc_daily_reports"]["Update"];
type PCShelfPhoto = Database["public"]["Tables"]["pc_shelf_photos"]["Row"];
type PCShelfPhotoInsert = Database["public"]["Tables"]["pc_shelf_photos"]["Insert"];
type PCStockUsage = Database["public"]["Tables"]["pc_stock_usage"]["Row"];

// Use the same bucket as attendance photos for now
// TODO: Create separate "pc-reports" bucket if needed for better organization
const STORAGE_BUCKET = process.env.SUPABASE_ATTENDANCE_BUCKET || "attendance-photos";

// ============================================================================
// Photo Upload Functions
// ============================================================================

/**
 * Generate storage path for PC report photos
 */
export function generatePhotoPath(
  employeeId: string,
  reportDate: string,
  storeId: string,
  photoType: "shelf" | "competitor" | "store-promo",
  timestamp: number = Date.now()
): string {
  const fileName = `${photoType}-${timestamp}.jpg`;
  return `${employeeId}/${reportDate}/${storeId}/${fileName}`;
}

/**
 * Upload a photo to Supabase Storage
 *
 * @param file - File object or base64 data URL
 * @param path - Storage path
 * @returns Public URL and storage path
 */
export async function uploadReportPhoto(
  file: File | string,
  path: string
): Promise<{ publicUrl: string; storagePath: string }> {
  const supabase = getSupabaseServiceClient();

  let uploadData: File | Buffer;

  if (typeof file === "string") {
    // Convert base64 data URL to buffer
    const base64Data = file.split(",")[1];
    uploadData = Buffer.from(base64Data, "base64");
  } else {
    uploadData = file;
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, uploadData, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload photo: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(data.path);

  return {
    publicUrl: urlData.publicUrl,
    storagePath: data.path,
  };
}

/**
 * Delete a photo from Supabase Storage
 */
export async function deleteReportPhoto(storagePath: string): Promise<void> {
  const supabase = getSupabaseServiceClient();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete photo: ${error.message}`);
  }
}

/**
 * Delete multiple photos from Supabase Storage
 */
export async function deleteReportPhotos(storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) return;

  const supabase = getSupabaseServiceClient();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove(storagePaths);

  if (error) {
    throw new Error(`Failed to delete photos: ${error.message}`);
  }
}

// ============================================================================
// Report CRUD Functions
// ============================================================================

/**
 * Create a new PC daily report (or return existing if found)
 * Uses upsert to prevent duplicate reports per day
 */
export async function createOrUpdateReport(
  data: PCDailyReportInsert
): Promise<PCDailyReport> {
  const supabase = getSupabaseServiceClient();

  const { data: report, error } = await supabase
    .from("pc_daily_reports")
    .upsert(
      {
        report_date: data.report_date,
        employee_id: data.employee_id,
        employee_name: data.employee_name,
        store_id: data.store_id,
        store_name: data.store_name,
        customer_activities: data.customer_activities,
        competitor_promo_photos: data.competitor_promo_photos || [],
        competitor_promo_notes: data.competitor_promo_notes,
        store_promo_photos: data.store_promo_photos || [],
        store_promo_notes: data.store_promo_notes,
        status: data.status || "draft",
        submitted_at: data.submitted_at,
      },
      {
        onConflict: "report_date,employee_id,store_id",
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create/update report: ${error.message}`);
  }

  return report;
}

/**
 * Update an existing PC daily report
 */
export async function updateReport(
  reportId: string,
  updates: PCDailyReportUpdate
): Promise<PCDailyReport> {
  const supabase = getSupabaseServiceClient();

  const { data: report, error } = await supabase
    .from("pc_daily_reports")
    .update(updates)
    .eq("id", reportId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update report: ${error.message}`);
  }

  return report;
}

/**
 * Get a report by ID with all related data (photos and stock usage)
 */
export async function getReportById(reportId: string): Promise<{
  report: PCDailyReport;
  shelfPhotos: PCShelfPhoto[];
  stockUsage: PCStockUsage[];
} | null> {
  const supabase = getSupabaseServiceClient();

  const { data: report, error: reportError } = await supabase
    .from("pc_daily_reports")
    .select("*")
    .eq("id", reportId)
    .single();

  if (reportError || !report) {
    return null;
  }

  const { data: shelfPhotos } = await supabase
    .from("pc_shelf_photos")
    .select("*")
    .eq("report_id", reportId)
    .order("uploaded_at", { ascending: true });

  const { data: stockUsage } = await supabase
    .from("pc_stock_usage")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });

  return {
    report,
    shelfPhotos: shelfPhotos || [],
    stockUsage: stockUsage || [],
  };
}

/**
 * Get report by date, employee, and store (for loading existing draft)
 */
export async function getReportByDateEmployeeStore(
  reportDate: string,
  employeeId: string,
  storeId: string
): Promise<{
  report: PCDailyReport;
  shelfPhotos: PCShelfPhoto[];
  stockUsage: PCStockUsage[];
} | null> {
  const supabase = getSupabaseServiceClient();

  const { data: report, error } = await supabase
    .from("pc_daily_reports")
    .select("*")
    .eq("report_date", reportDate)
    .eq("employee_id", employeeId)
    .eq("store_id", storeId)
    .single();

  if (error || !report) {
    return null;
  }

  return getReportById(report.id);
}

/**
 * Delete a report and all associated data (photos, stock usage)
 * CASCADE DELETE will handle child records automatically
 */
export async function deleteReport(reportId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();

  // Get shelf photos to delete from storage
  const { data: shelfPhotos } = await supabase
    .from("pc_shelf_photos")
    .select("storage_path")
    .eq("report_id", reportId);

  // Get competitor and store promo photos from report
  const { data: _report } = await supabase
    .from("pc_daily_reports")
    .select("competitor_promo_photos, store_promo_photos")
    .eq("id", reportId)
    .single();

  // Delete the report (CASCADE will delete shelf photos and stock usage records)
  const { error } = await supabase
    .from("pc_daily_reports")
    .delete()
    .eq("id", reportId);

  if (error) {
    throw new Error(`Failed to delete report: ${error.message}`);
  }

  // Clean up storage files
  const storagePaths: string[] = [];

  if (shelfPhotos) {
    storagePaths.push(...shelfPhotos.map((p) => p.storage_path));
  }

  // Note: competitor_promo_photos and store_promo_photos are arrays of URLs
  // We need to extract storage paths from these URLs if we want to delete them
  // For now, we'll skip deleting these as they're stored as URLs in the report table

  if (storagePaths.length > 0) {
    await deleteReportPhotos(storagePaths);
  }
}

// ============================================================================
// Shelf Photo Functions
// ============================================================================

/**
 * Add a shelf photo to a report
 */
export async function addShelfPhoto(
  data: PCShelfPhotoInsert
): Promise<PCShelfPhoto> {
  const supabase = getSupabaseServiceClient();

  const { data: photo, error } = await supabase
    .from("pc_shelf_photos")
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add shelf photo: ${error.message}`);
  }

  return photo;
}

/**
 * Update shelf photo caption
 */
export async function updateShelfPhotoCaption(
  photoId: string,
  caption: string
): Promise<PCShelfPhoto> {
  const supabase = getSupabaseServiceClient();

  const { data: photo, error } = await supabase
    .from("pc_shelf_photos")
    .update({ caption })
    .eq("id", photoId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update photo caption: ${error.message}`);
  }

  return photo;
}

/**
 * Delete a shelf photo
 */
export async function deleteShelfPhoto(photoId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();

  // Get storage path before deleting
  const { data: photo } = await supabase
    .from("pc_shelf_photos")
    .select("storage_path")
    .eq("id", photoId)
    .single();

  const { error } = await supabase
    .from("pc_shelf_photos")
    .delete()
    .eq("id", photoId);

  if (error) {
    throw new Error(`Failed to delete shelf photo: ${error.message}`);
  }

  // Delete from storage
  if (photo) {
    await deleteReportPhoto(photo.storage_path);
  }
}

// ============================================================================
// Stock Usage Functions
// ============================================================================

/**
 * Calculate total base units from quantities and product units
 */
export async function calculateTotalBaseUnits(
  productId: string,
  quantities: Record<string, number>
): Promise<number> {
  const supabase = getSupabaseServiceClient();

  // Get product units with multipliers
  const { data: units, error } = await supabase
    .from("product_units")
    .select("name, multiplier_to_base")
    .eq("product_id", productId);

  if (error || !units) {
    throw new Error(`Failed to fetch product units: ${error?.message}`);
  }

  let total = 0;
  for (const [unitName, quantity] of Object.entries(quantities)) {
    const unit = units.find((u) => u.name === unitName);
    if (unit) {
      total += quantity * unit.multiplier_to_base;
    }
  }

  return Math.round(total);
}

/**
 * Add stock usage to a report
 */
export async function addStockUsage(
  reportId: string,
  productId: string,
  productCode: string,
  productName: string,
  quantities: Record<string, number>
): Promise<PCStockUsage> {
  const supabase = getSupabaseServiceClient();

  // Calculate total base units
  const totalBaseUnits = await calculateTotalBaseUnits(productId, quantities);

  const { data: stockUsage, error } = await supabase
    .from("pc_stock_usage")
    .insert({
      report_id: reportId,
      product_id: productId,
      product_code: productCode,
      product_name: productName,
      quantities: quantities as unknown as Database["public"]["Tables"]["pc_stock_usage"]["Insert"]["quantities"],
      total_base_units: totalBaseUnits,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add stock usage: ${error.message}`);
  }

  return stockUsage;
}

/**
 * Update stock usage quantities
 */
export async function updateStockUsage(
  stockUsageId: string,
  productId: string,
  quantities: Record<string, number>
): Promise<PCStockUsage> {
  const supabase = getSupabaseServiceClient();

  // Calculate total base units
  const totalBaseUnits = await calculateTotalBaseUnits(productId, quantities);

  const { data: stockUsage, error } = await supabase
    .from("pc_stock_usage")
    .update({
      quantities: quantities as unknown as Database["public"]["Tables"]["pc_stock_usage"]["Update"]["quantities"],
      total_base_units: totalBaseUnits,
    })
    .eq("id", stockUsageId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update stock usage: ${error.message}`);
  }

  return stockUsage;
}

/**
 * Delete stock usage record
 */
export async function deleteStockUsage(stockUsageId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();

  const { error } = await supabase
    .from("pc_stock_usage")
    .delete()
    .eq("id", stockUsageId);

  if (error) {
    throw new Error(`Failed to delete stock usage: ${error.message}`);
  }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get reports with filters
 */
export async function getReports(filters: {
  employeeId?: string;
  storeId?: string;
  startDate?: string;
  endDate?: string;
  status?: "draft" | "submitted";
  limit?: number;
  offset?: number;
}): Promise<PCDailyReport[]> {
  const supabase = getSupabaseServiceClient();

  let query = supabase
    .from("pc_daily_reports")
    .select("*")
    .order("report_date", { ascending: false });

  if (filters.employeeId) {
    query = query.eq("employee_id", filters.employeeId);
  }

  if (filters.storeId) {
    query = query.eq("store_id", filters.storeId);
  }

  if (filters.startDate) {
    query = query.gte("report_date", filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte("report_date", filters.endDate);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  if (filters.offset) {
    query = query.range(
      filters.offset,
      filters.offset + (filters.limit || 50) - 1
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch reports: ${error.message}`);
  }

  return data || [];
}

/**
 * Format quantities object for display
 * Example: { "ลัง": 10, "แพ็ค": 5 } => "10 ลัง 5 แพ็ค"
 */
export function formatQuantities(quantities: Record<string, number>): string {
  return Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([unit, qty]) => `${qty} ${unit}`)
    .join(" ");
}
