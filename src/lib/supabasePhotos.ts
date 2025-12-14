/**
 * Supabase Photo Operations
 *
 * Query helpers for attendance photos with performance optimization
 */

import { getSupabaseServiceClient } from "./supabaseClient";

export interface PhotoRecord {
  id: string;
  recordedDate: string;
  recordedTime: string;
  status: string;
  employeeName: string;
  storeName: string | null;
  photoPublicUrl: string | null;
  storagePath: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  note: string | null;
  createdAt: string;
}

export interface PhotoTimelineItem {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "3 พ.ย."
  dayOfWeek: string; // "พ."
  photos: PhotoRecord[]; // All photos for this date, sorted by time
  checkInPhoto: PhotoRecord | null; // Legacy: earliest check-in
  checkOutPhoto: PhotoRecord | null; // Legacy: latest check-out
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  missingPhotos: Array<"check-in" | "check-out">;
  totalPhotos: number;
}

export interface PhotoQueryOptions {
  employeeName?: string;
  storeName?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  hasPhoto?: boolean; // true = มีภาพ, false = ไม่มีภาพ, undefined = ทั้งหมด
  status?: "check-in" | "check-out";
  limit?: number;
  offset?: number;
}

export interface PhotoQueryResult {
  photos: PhotoRecord[];
  totalCount: number;
  hasNextPage: boolean;
}

/**
 * Query attendance photos with filters
 * Optimized with proper indexing and pagination
 */
export async function getAttendancePhotos(
  options: PhotoQueryOptions = {}
): Promise<PhotoQueryResult> {
  const supabase = getSupabaseServiceClient();

  const {
    employeeName,
    storeName,
    startDate,
    endDate,
    hasPhoto,
    status,
    limit = 100,
    offset = 0,
  } = options;

  // Build query (no joins needed - schema is denormalized)
  let query = supabase
    .from("attendance_records")
    .select(
      `
      id,
      recorded_date,
      recorded_time,
      status,
      employee_name,
      store_name,
      photo_public_url,
      storage_path,
      latitude,
      longitude,
      accuracy,
      note,
      created_at
      `,
      { count: "exact" }
    )
    .order("recorded_date", { ascending: false })
    .order("recorded_time", { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (employeeName) {
    query = query.eq("employee_name", employeeName);
  }

  if (storeName) {
    query = query.eq("store_name", storeName);
  }

  if (startDate) {
    query = query.gte("recorded_date", startDate);
  }

  if (endDate) {
    query = query.lte("recorded_date", endDate);
  }

  if (hasPhoto === true) {
    query = query.not("photo_public_url", "is", null);
  } else if (hasPhoto === false) {
    query = query.is("photo_public_url", null);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[supabasePhotos] Query error:", error);
    throw new Error(`Failed to fetch photos: ${error.message}`);
  }

  // Transform data to PhotoRecord format
  const photos: PhotoRecord[] = (data || []).map((record: Record<string, unknown>) => ({
    id: record.id as string,
    recordedDate: record.recorded_date as string,
    recordedTime: record.recorded_time as string,
    status: record.status as string,
    employeeName: record.employee_name as string,
    storeName: (record.store_name as string | null) || null,
    photoPublicUrl: (record.photo_public_url as string | null) || null,
    storagePath: (record.storage_path as string | null) || null,
    latitude: (record.latitude as number | null) || null,
    longitude: (record.longitude as number | null) || null,
    accuracy: (record.accuracy as number | null) || null,
    note: (record.note as string | null) || null,
    createdAt: record.created_at as string,
  }));

  return {
    photos,
    totalCount: count || 0,
    hasNextPage: offset + limit < (count || 0),
  };
}

/**
 * Build timeline view: group check-in and check-out by date
 * Performance: O(n) single pass grouping
 */
export async function getPhotoTimeline(
  employeeName: string,
  startDate: string,
  endDate: string
): Promise<PhotoTimelineItem[]> {
  // Fetch all photos for date range
  const { photos } = await getAttendancePhotos({
    employeeName,
    startDate,
    endDate,
    limit: 1000, // Reasonable limit for one month
  });

  // Group by date - CHANGED: Keep ALL photos, not just first/last
  const dateMap = new Map<string, PhotoRecord[]>();

  for (const photo of photos) {
    const date = photo.recordedDate;

    if (!dateMap.has(date)) {
      dateMap.set(date, []);
    }

    dateMap.get(date)!.push(photo);
  }

  // Convert to timeline items with Thai formatting
  const timeline: PhotoTimelineItem[] = [];
  const sortedDates = Array.from(dateMap.keys()).sort().reverse();

  for (const date of sortedDates) {
    const dayPhotos = dateMap.get(date)!;

    // Sort photos by time (earliest to latest)
    const sortedPhotos = dayPhotos.sort((a, b) => {
      return a.recordedTime.localeCompare(b.recordedTime);
    });

    // DEDUPLICATION: Keep only the latest record per (date, store, status)
    // This handles cases where users accidentally clock in/out multiple times
    const deduplicatedPhotos = Object.values(
      sortedPhotos.reduce((acc, photo) => {
        const key = `${photo.recordedDate}-${photo.storeName}-${photo.status}`;

        // Keep the latest time for each unique combination
        if (!acc[key] || photo.recordedTime > acc[key].recordedTime) {
          acc[key] = photo;
        }

        return acc;
      }, {} as Record<string, PhotoRecord>)
    );

    // Re-sort deduplicated photos by time
    const finalPhotos = deduplicatedPhotos.sort((a, b) => {
      return a.recordedTime.localeCompare(b.recordedTime);
    });

    // Find earliest check-in and latest check-out for legacy support
    const checkIns = finalPhotos.filter(p => p.status === "check-in");
    const checkOuts = finalPhotos.filter(p => p.status === "check-out");

    const earliestCheckIn = checkIns.length > 0 ? checkIns[0] : null;
    const latestCheckOut = checkOuts.length > 0 ? checkOuts[checkOuts.length - 1] : null;

    const missingPhotos: Array<"check-in" | "check-out"> = [];

    if (earliestCheckIn && !earliestCheckIn.photoPublicUrl) {
      missingPhotos.push("check-in");
    }
    if (latestCheckOut && !latestCheckOut.photoPublicUrl) {
      missingPhotos.push("check-out");
    }

    timeline.push({
      date,
      dayLabel: formatDayLabel(date),
      dayOfWeek: getDayOfWeek(date),
      photos: finalPhotos, // UPDATED: Deduplicated photos
      checkInPhoto: earliestCheckIn, // Legacy
      checkOutPhoto: latestCheckOut, // Legacy
      hasCheckIn: checkIns.length > 0,
      hasCheckOut: checkOuts.length > 0,
      missingPhotos,
      totalPhotos: finalPhotos.length, // UPDATED: Use deduplicated count
    });
  }

  return timeline;
}

/**
 * Get single photo detail by attendance record ID
 */
export async function getPhotoDetail(recordId: string): Promise<PhotoRecord | null> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("attendance_records")
    .select(
      `
      id,
      recorded_date,
      recorded_time,
      status,
      employee_name,
      store_name,
      photo_public_url,
      storage_path,
      latitude,
      longitude,
      accuracy,
      note,
      created_at
      `
    )
    .eq("id", recordId)
    .single();

  if (error || !data) {
    return null;
  }

  const record = data as Record<string, unknown>;

  return {
    id: record.id as string,
    recordedDate: record.recorded_date as string,
    recordedTime: record.recorded_time as string,
    status: record.status as string,
    employeeName: record.employee_name as string,
    storeName: (record.store_name as string | null) || null,
    photoPublicUrl: (record.photo_public_url as string | null) || null,
    storagePath: (record.storage_path as string | null) || null,
    latitude: (record.latitude as number | null) || null,
    longitude: (record.longitude as number | null) || null,
    accuracy: (record.accuracy as number | null) || null,
    note: (record.note as string | null) || null,
    createdAt: record.created_at as string,
  };
}

/**
 * Get photo statistics for an employee
 */
export interface PhotoStatistics {
  totalRecords: number;
  recordsWithPhoto: number;
  recordsWithoutPhoto: number;
  checkInWithPhoto: number;
  checkInWithoutPhoto: number;
  checkOutWithPhoto: number;
  checkOutWithoutPhoto: number;
  photoCompletionRate: number; // 0-100
}

export async function getPhotoStatistics(
  employeeName: string,
  startDate: string,
  endDate: string
): Promise<PhotoStatistics> {
  const { photos, totalCount } = await getAttendancePhotos({
    employeeName,
    startDate,
    endDate,
    limit: 1000,
  });

  const stats: PhotoStatistics = {
    totalRecords: totalCount,
    recordsWithPhoto: 0,
    recordsWithoutPhoto: 0,
    checkInWithPhoto: 0,
    checkInWithoutPhoto: 0,
    checkOutWithPhoto: 0,
    checkOutWithoutPhoto: 0,
    photoCompletionRate: 0,
  };

  for (const photo of photos) {
    const hasPhoto = !!photo.photoPublicUrl;

    if (hasPhoto) {
      stats.recordsWithPhoto++;
      if (photo.status === "check-in") {
        stats.checkInWithPhoto++;
      } else if (photo.status === "check-out") {
        stats.checkOutWithPhoto++;
      }
    } else {
      stats.recordsWithoutPhoto++;
      if (photo.status === "check-in") {
        stats.checkInWithoutPhoto++;
      } else if (photo.status === "check-out") {
        stats.checkOutWithoutPhoto++;
      }
    }
  }

  stats.photoCompletionRate = stats.totalRecords > 0
    ? Math.round((stats.recordsWithPhoto / stats.totalRecords) * 100)
    : 0;

  return stats;
}

// ===== Helper Functions =====

/**
 * Format date to Thai short format: "3 พ.ย."
 */
function formatDayLabel(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T00:00:00Z");
    const formatter = new Intl.DateTimeFormat("th-TH", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
    });
    return formatter.format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Get Thai day of week abbreviation: "จ.", "อ.", "พ."
 */
function getDayOfWeek(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T00:00:00Z");
    const dayIndex = date.getUTCDay();
    const thaiDays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    return thaiDays[dayIndex];
  } catch {
    return "";
  }
}
