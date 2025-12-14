import { randomUUID } from "node:crypto";
import { listStoresFromSupabase } from "@/lib/supabaseDirectory";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { addLog } from "@/lib/supabaseLogs";
import { assertSupabaseConfig, getSupabaseServiceClient } from "@/lib/supabaseClient";
import { verifySession } from "@/lib/authSessions";
import { validateDataUrl } from "@/lib/fileValidation";
import { validateDateString, validateLatitude, validateLongitude } from "@/lib/validators";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AttendancePayload = {
  date: string;
  time: string;
  status: string;
  employeeName: string;
  storeName: string;
  note?: string;
  photo: string;
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;



    
  };
};

type SanitizedPayload = {
  date: string;
  time: string;
  status: "check-in" | "check-out";
  employeeName: string;
  storeName: string;
  note: string | null;
  photo: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  } | null;
};

type UploadedPhoto = {
  storagePath: string;
  publicUrl: string;
};

type GeofenceResult = {
  isWithin: boolean;
  distance: number | null;
  radius: number | null;
  warning: string | null;
};

const REQUIRED_SUPABASE_ENV: Array<keyof NodeJS.ProcessEnv> = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ATTENDANCE_BUCKET",
];

// Reserved for future validation (currently using file size check in validateDataUrl)
// const _MAX_BASE64_LENGTH = 7_000_000; // ~5MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

const CLIENT_ERROR_MESSAGES = new Set([
  "กรุณาตั้งค่าตัวแปรสภาพแวดล้อมของ Supabase ให้ครบ",
  "กรุณากรอกวันที่ให้ถูกต้อง",
  "กรุณากรอกเวลาให้ถูกต้อง",
  "กรุณากรอกข้อมูลให้ครบถ้วน",
  "กรุณาเลือกรูปภาพที่ถูกต้อง",
  "ไฟล์รูปมีขนาดใหญ่เกินกำหนด (สูงสุด 5MB)",
  "ไม่สามารถอัปโหลดรูปภาพได้",
  "ไม่สามารถสร้างลิงก์รูปภาพได้",
  "ไม่พบสาขาที่เลือกในระบบ",
]);

function assertEnv() {
  for (const key of REQUIRED_SUPABASE_ENV) {
    if (!process.env[key] || process.env[key]!.trim().length === 0) {
      throw new Error("กรุณาตั้งค่าตัวแปรสภาพแวดล้อมของ Supabase ให้ครบ");
    }
  }
  assertSupabaseConfig();
}

function getSupabaseBucketName() {
  const bucket = process.env.SUPABASE_ATTENDANCE_BUCKET?.trim();
  if (!bucket) {
    throw new Error("กรุณาตั้งค่าตัวแปรสภาพแวดล้อมของ Supabase ให้ครบ");
  }
  return bucket;
}

function normalizeDate(value: string) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new Error("กรุณากรอกวันที่ให้ถูกต้อง");
  }

  // Try YYYY-MM-DD format first
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    // ✅ Use validator for additional checks (e.g., prevent 2024-02-30)
    if (validateDateString(trimmed)) {
      return trimmed;
    }
    throw new Error("กรุณากรอกวันที่ให้ถูกต้อง");
  }

  // Try DD/MM/YYYY or DD-MM-YYYY format
  const dmy = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    const normalized = `${year}-${month}-${day}`;
    if (validateDateString(normalized)) {
      return normalized;
    }
    throw new Error("กรุณากรอกวันที่ให้ถูกต้อง");
  }

  // Fallback: Try parsing as Date
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error("กรุณากรอกวันที่ให้ถูกต้อง");
  }
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  const normalized = `${year}-${month}-${day}`;

  if (validateDateString(normalized)) {
    return normalized;
  }
  throw new Error("กรุณากรอกวันที่ให้ถูกต้อง");
}

function normalizeTime(value: string) {
  const cleaned = value?.trim().replace(/\./g, ":") ?? "";
  const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new Error("กรุณากรอกเวลาให้ถูกต้อง");
  }
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("กรุณากรอกเวลาให้ถูกต้อง");
  }
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function sanitizePayload(payload: AttendancePayload): SanitizedPayload {
  if (!payload) {
    throw new Error("กรุณากรอกข้อมูลให้ครบถ้วน");
  }

  const date = normalizeDate(payload.date);
  const time = normalizeTime(payload.time);
  const status = payload.status?.toLowerCase() === "check-out" ? "check-out" : "check-in";
  const employeeName = payload.employeeName?.trim() ?? "";
  const storeName = payload.storeName?.trim() ?? "";

  if (!employeeName || !storeName) {
    throw new Error("กรุณากรอกข้อมูลให้ครบถ้วน");
  }

  const note = payload.note?.trim() ?? null;

  // ✅ Enhanced photo validation using fileValidation utilities
  if (typeof payload.photo !== "string" || payload.photo.trim().length === 0) {
    throw new Error("กรุณาเลือกรูปภาพที่ถูกต้อง");
  }
  const photo = payload.photo.trim();

  // Validate data URL format, MIME type, and size
  const photoValidation = validateDataUrl(photo);
  if (!photoValidation.valid) {
    throw new Error(photoValidation.error || "รูปภาพไม่ถูกต้อง");
  }

  // ✅ Enhanced GPS coordinate validation using validators
  let location: SanitizedPayload["location"] = null;
  if (payload.location) {
    const { latitude, longitude, accuracy } = payload.location;
    if (
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      validateLatitude(latitude) &&
      validateLongitude(longitude)
    ) {
      location = {
        latitude,
        longitude,
        accuracy:
          typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy >= 0
            ? accuracy
            : null,
      };
    } else if (latitude !== undefined || longitude !== undefined) {
      // Coordinates were provided but invalid - throw error
      throw new Error("พิกัด GPS ไม่ถูกต้อง (latitude: -90 to 90, longitude: -180 to 180)");
    }
  }

  return { date, time, status, employeeName, storeName, note, photo, location };
}

function formatLocation(location: SanitizedPayload["location"]) {
  if (!location) return "";
  const accuracyDisplay =
    typeof location.accuracy === "number" ? `±${Math.round(location.accuracy)}m` : "";
  return `${location.latitude.toFixed(6)},${location.longitude.toFixed(6)} ${accuracyDisplay}`.trim();
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("กรุณาเลือกรูปภาพที่ถูกต้อง");
  }
  const mimeType = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0 || !ALLOWED_MIME_TYPES[mimeType]) {
    throw new Error("กรุณาเลือกรูปภาพที่ถูกต้อง");
  }
  return { mimeType, buffer };
}

function createStoragePath(extension: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `attendance/${year}/${month}/${day}/${randomUUID()}.${extension}`;
}

async function uploadPhoto(dataUrl: string): Promise<UploadedPhoto> {
  const { mimeType, buffer } = parseDataUrl(dataUrl);
  const extension = ALLOWED_MIME_TYPES[mimeType];
  const storagePath = createStoragePath(extension);

  const supabase = getSupabaseServiceClient();
  const bucket = getSupabaseBucketName();

  const uploadResult = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (uploadResult.error) {
    console.error("[attendance] photo upload error", uploadResult.error);
    throw new Error("ไม่สามารถอัปโหลดรูปภาพได้");
  }

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  const publicUrl = publicData?.publicUrl;
  if (!publicUrl) {
    throw new Error("ไม่สามารถสร้างลิงก์รูปภาพได้");
  }

  return { storagePath, publicUrl };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371_000; // metres
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function checkGeofence(
  storeName: string,
  latitude: number | null,
  longitude: number | null,
): Promise<GeofenceResult> {
  if (latitude === null || longitude === null) {
    return { isWithin: true, distance: null, radius: null, warning: null };
  }

  const stores = await listStoresFromSupabase();
  const store = stores?.find((item) => item.name.trim() === storeName.trim());
  if (!store || !isFinite(store.latitude ?? NaN) || !isFinite(store.longitude ?? NaN)) {
    return { isWithin: true, distance: null, radius: null, warning: null };
  }

  const radius = typeof store.radius === "number" && Number.isFinite(store.radius) ? store.radius : 100;
  const distance = calculateDistance(latitude, longitude, store.latitude!, store.longitude!);

  if (distance <= radius) {
    return { isWithin: true, distance, radius, warning: null };
  }

  const warning = `ตำแหน่งปัจจุบันอยู่นอกพื้นที่ที่กำหนด (ห่าง ${Math.round(
    distance,
  )} ม. เกินรัศมี ${radius} ม.)`;
  return { isWithin: false, distance, radius, warning };
}

function formatSubmittedAt() {
  return new Date();
}

export async function POST(request: Request) {
  try {
    // ✅ Verify session authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { ok: false, message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      );
    }

    const session = await verifySession(sessionToken);
    if (!session) {
      return NextResponse.json(
        { ok: false, message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' },
        { status: 401 }
      );
    }

    assertEnv();
    const raw = (await request.json()) as AttendancePayload;
    const sanitized = sanitizePayload(raw);

    const supabase = getSupabaseServiceClient();
    const submittedAt = formatSubmittedAt();
    const locationDisplay = formatLocation(sanitized.location);

    const photoUpload = await uploadPhoto(sanitized.photo);

    const geofenceResult = await checkGeofence(
      sanitized.storeName,
      sanitized.location?.latitude ?? null,
      sanitized.location?.longitude ?? null,
    );

    // ✅ Geocoding is now handled asynchronously to prevent timeouts
    // Address will be populated by background processor (see /api/admin/geocoding/process)
    const addressData = {
      subdistrict: null as string | null,
      district: null as string | null,
      province: null as string | null,
    };

    // Check for duplicate within 5 minutes (same date, store, status)
    const fiveMinutesAgo = new Date(new Date(`${sanitized.date}T${sanitized.time}`).getTime() - 5 * 60 * 1000);
    const fiveMinutesAgoTime = fiveMinutesAgo.toTimeString().split(' ')[0].substring(0, 8); // HH:MM:SS

    // ✅ Properly typed query using explicit type annotation
    type RecentRecordRow = Pick<Database['public']['Tables']['attendance_records']['Row'], 'id' | 'recorded_time'>;
    const { data: recentRecords } = await supabase
      .from("attendance_records")
      .select("id, recorded_time")
      .eq("employee_name", sanitized.employeeName)
      .eq("store_name", sanitized.storeName)
      .eq("recorded_date", sanitized.date)
      .eq("status", sanitized.status)
      .gte("recorded_time", fiveMinutesAgoTime)
      .order("recorded_time", { ascending: false })
      .limit(1)
      .returns<RecentRecordRow[]>();

    if (recentRecords && recentRecords.length > 0) {
      const recentTime = recentRecords[0].recorded_time;
      console.log(`[attendance] duplicate detected: ${sanitized.employeeName} already ${sanitized.status} at ${sanitized.storeName} at ${recentTime} (within 5 minutes)`);

      return NextResponse.json(
        {
          ok: false,
          error: `คุณได้ลงเวลา${sanitized.status === "check-in" ? "เข้างาน" : "ออกงาน"}ร้านนี้แล้วเมื่อ ${recentTime} น.\nกรุณารออย่างน้อย 5 นาทีก่อนลงเวลาซ้ำ`
        },
        { status: 400 }
      );
    }

    type AttendanceRecordInsert = Database["public"]["Tables"]["attendance_records"]["Insert"];

    const insertPayload: AttendanceRecordInsert = {
      recorded_date: sanitized.date,
      recorded_time: sanitized.time,
      status: sanitized.status,
      employee_name: sanitized.employeeName,
      store_name: sanitized.storeName,
      note: sanitized.note ?? null,
      latitude: sanitized.location?.latitude ?? null,
      longitude: sanitized.location?.longitude ?? null,
      accuracy: sanitized.location?.accuracy ?? null,
      location_display: locationDisplay,
      subdistrict: addressData.subdistrict,
      district: addressData.district,
      province: addressData.province,
      photo_public_url: photoUpload.publicUrl,
      storage_path: photoUpload.storagePath,
      submitted_at: submittedAt.toISOString(),
    };

    // ✅ Properly typed insert with explicit type annotation
    const { data: insertedRecord, error: insertError } = await supabase
      .from("attendance_records")
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError) {
      console.error("[attendance] insert error", insertError);
      throw new Error("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    }

    // ✅ Queue geocoding job for background processing (prevents timeout)
    if (sanitized.location?.latitude && sanitized.location?.longitude && insertedRecord?.id) {
      try {
        type GeocodingQueueInsert = Database['public']['Tables']['geocoding_queue']['Insert'];
        const queuePayload: GeocodingQueueInsert = {
          attendance_record_id: insertedRecord.id,
          latitude: sanitized.location.latitude,
          longitude: sanitized.location.longitude,
          status: 'pending'
        };
        const { error: queueError } = await supabase
          .from('geocoding_queue')
          .insert(queuePayload);

        if (queueError) {
          // Don't fail attendance recording if geocoding queue fails
          console.error('[attendance] failed to queue geocoding job:', queueError);
          console.warn('[attendance] continuing without geocoding - address will not be populated');
        } else {
          console.log(`[attendance] geocoding job queued for record ${insertedRecord.id}`);
        }
      } catch (error) {
        console.error('[attendance] geocoding queue exception:', error);
        // Continue - don't block attendance recording
      }
    }

    await addLog({
      timestamp: submittedAt.toISOString(),
      scope: "attendance",
      action: "create",
      details: `บันทึกเวลา${sanitized.status === "check-in" ? "เข้า" : "ออก"} - ${sanitized.employeeName}`,
      actorName: sanitized.employeeName,
      metadata: {
        storeName: sanitized.storeName,
        employeeName: sanitized.employeeName,
        status: sanitized.status,
        submittedAt: submittedAt.toISOString(),
        location: sanitized.location,
        locationDisplay,
        distance: geofenceResult.distance,
        radius: geofenceResult.radius,
        warning: geofenceResult.warning,
        storagePath: photoUpload.storagePath,
      },
    });

    // Check for store transfer (check-out at different store than check-in)
    let transferDetected = false;
    let transferData = null;

    if (sanitized.status === "check-out") {
      console.log("[attendance] Checking for store transfer...");
      console.log("[attendance] Employee:", sanitized.employeeName);
      console.log("[attendance] Date:", sanitized.date);
      console.log("[attendance] Current store:", sanitized.storeName);

      // ✅ Properly typed query for transfer detection
      type CheckInRow = Pick<Database['public']['Tables']['attendance_records']['Row'], 'store_name' | 'recorded_time'>;
      const { data: todayCheckIns, error: checkInError } = await supabase
        .from("attendance_records")
        .select("store_name, recorded_time")
        .eq("employee_name", sanitized.employeeName)
        .eq("recorded_date", sanitized.date)
        .eq("status", "check-in")
        .order("recorded_time", { ascending: false })
        .limit(1)
        .returns<CheckInRow[]>();

      console.log("[attendance] Check-in query result:", todayCheckIns);
      console.log("[attendance] Check-in query error:", checkInError);

      if (todayCheckIns && todayCheckIns.length > 0) {
        const lastCheckIn = todayCheckIns[0];
        console.log("[attendance] Last check-in store:", lastCheckIn.store_name);

        // Transfer detected if check-out store differs from last check-in store
        if (lastCheckIn.store_name !== sanitized.storeName) {
          console.log("[attendance] ⚠️ TRANSFER DETECTED! Different stores!");
          transferDetected = true;
          transferData = {
            oldStore: lastCheckIn.store_name,
            newStore: sanitized.storeName,
            checkInTime: lastCheckIn.recorded_time,
            checkInDate: sanitized.date,
          };
          console.log("[attendance] Transfer data:", transferData);
        } else {
          console.log("[attendance] Same store - no transfer");
        }
      } else {
        console.log("[attendance] No check-in found for today");
      }
    }

    return NextResponse.json({
      ok: true,
      warning: geofenceResult.warning,
      transferDetected,
      transferData,
    });
  } catch (error) {
    console.error("[attendance] submit error", error);
    const message =
      error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
    const isClientError = CLIENT_ERROR_MESSAGES.has(message);
    return NextResponse.json(
      { ok: false, message },
      { status: isClientError ? 400 : 500 },
    );
  }
}
