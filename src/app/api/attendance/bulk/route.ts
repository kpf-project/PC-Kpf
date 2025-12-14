/**
 * Bulk Attendance API - Create Multiple Records Atomically
 * Used for auto-generating missing check-out/check-in records during store transfers
 */

import { NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';
import * as supabaseLogs from '@/lib/supabaseLogs';

interface BulkAttendanceRequest {
  employeeName: string;

  // Original check-in record (already exists)
  checkInDate: string;
  checkInTime: string;
  oldStoreName: string;

  // Check-out from old store (auto-generated)
  checkOutTime: string;
  checkOutPhoto: string; // base64

  // Check-in to new store (auto-generated)
  newCheckInTime: string;
  newStoreName: string;
  newCheckInPhoto: string; // base64

  // Current check-out from new store (actual submission)
  currentCheckOutTime: string;
  currentCheckOutStore: string;
  currentCheckOutPhoto: string; // base64
  currentLatitude: number;
  currentLongitude: number;
  currentSubdistrict?: string;
  currentDistrict?: string;
  currentProvince?: string;
}

/**
 * Upload photo to Supabase Storage
 */
async function uploadPhoto(
  photoBase64: string,
  employeeId: string,
  timestamp: string
): Promise<{ publicUrl: string; storagePath: string }> {
  const supabase = getSupabaseServiceClient();
  const bucket = process.env.SUPABASE_ATTENDANCE_BUCKET || 'attendance-photos';

  // Convert base64 to buffer
  const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Generate unique filename
  const filename = `${employeeId}_${timestamp.replace(/[:\s]/g, '-')}_${Date.now()}.jpg`;
  const storagePath = `${employeeId}/${filename}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload photo: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(storagePath);

  return {
    publicUrl: urlData.publicUrl,
    storagePath,
  };
}

/**
 * Fetch GPS coordinates from existing attendance record
 */
async function fetchGPSFromRecord(
  employeeName: string,
  date: string,
  time: string,
  storeName: string
): Promise<{
  latitude: number;
  longitude: number;
  subdistrict?: string;
  district?: string;
  province?: string;
} | null> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from('attendance_records')
    .select('latitude, longitude, subdistrict, district, province')
    .eq('employee_name', employeeName)
    .eq('recorded_date', date)
    .eq('recorded_time', time)
    .eq('store_name', storeName)
    .maybeSingle();

  if (error || !data || data.latitude === null || data.longitude === null) {
    console.warn('[BulkAttendance] Could not fetch GPS from existing record:', error);
    return null;
  }

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    subdistrict: data.subdistrict || undefined,
    district: data.district || undefined,
    province: data.province || undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as BulkAttendanceRequest;
    const supabase = getSupabaseServiceClient();

    console.log('[BulkAttendance] Request body:', {
      employeeName: body.employeeName,
      oldStore: body.oldStoreName,
      newStore: body.newStoreName,
      checkInTime: body.checkInTime,
      checkOutTime: body.checkOutTime,
      newCheckInTime: body.newCheckInTime,
      currentCheckOutTime: body.currentCheckOutTime,
      currentCheckOutStore: body.currentCheckOutStore,
    });

    // Validate input
    if (
      !body.employeeName ||
      !body.checkInDate ||
      !body.checkOutTime ||
      !body.checkOutPhoto ||
      !body.newCheckInTime ||
      !body.newStoreName ||
      !body.newCheckInPhoto ||
      !body.currentCheckOutTime ||
      !body.currentCheckOutStore ||
      !body.currentCheckOutPhoto
    ) {
      return Response.json(
        { success: false, error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // Fetch GPS from original check-in record (for check-out from old store)
    // If GPS is disabled, this will return null and we'll use null coordinates
    const oldStoreGPS = await fetchGPSFromRecord(
      body.employeeName,
      body.checkInDate,
      body.checkInTime,
      body.oldStoreName
    );

    // Use provided GPS if available, otherwise use null
    const currentLat = typeof body.currentLatitude === 'number' ? body.currentLatitude : null;
    const currentLng = typeof body.currentLongitude === 'number' ? body.currentLongitude : null;

    // Upload all photos (use employeeName as folder name)
    const employeeFolder = body.employeeName.replace(/\s+/g, '_');
    const [checkOutPhotoData, newCheckInPhotoData, currentCheckOutPhotoData] = await Promise.all([
      uploadPhoto(body.checkOutPhoto, employeeFolder, `${body.checkInDate}_${body.checkOutTime}`),
      uploadPhoto(body.newCheckInPhoto, employeeFolder, `${body.checkInDate}_${body.newCheckInTime}`),
      uploadPhoto(body.currentCheckOutPhoto, employeeFolder, `${body.checkInDate}_${body.currentCheckOutTime}`),
    ]);

    // Prepare records with proper type casting
    const records = [
      // 1. Check-out from old store (auto-generated)
      {
        employee_name: body.employeeName,
        recorded_date: body.checkInDate,
        recorded_time: body.checkOutTime,
        status: 'check-out' as const,
        store_name: body.oldStoreName,
        photo_public_url: checkOutPhotoData.publicUrl,
        storage_path: checkOutPhotoData.storagePath,
        latitude: oldStoreGPS?.latitude || null,
        longitude: oldStoreGPS?.longitude || null,
        subdistrict: oldStoreGPS?.subdistrict || null,
        district: oldStoreGPS?.district || null,
        province: oldStoreGPS?.province || null,
        is_auto_generated: true,
      },
      // 2. Check-in to new store (auto-generated)
      {
        employee_name: body.employeeName,
        recorded_date: body.checkInDate,
        recorded_time: body.newCheckInTime,
        status: 'check-in' as const,
        store_name: body.newStoreName,
        photo_public_url: newCheckInPhotoData.publicUrl,
        storage_path: newCheckInPhotoData.storagePath,
        latitude: currentLat,
        longitude: currentLng,
        subdistrict: body.currentSubdistrict || null,
        district: body.currentDistrict || null,
        province: body.currentProvince || null,
        is_auto_generated: true,
      },
      // 3. Check-out from new store (current submission)
      {
        employee_name: body.employeeName,
        recorded_date: body.checkInDate,
        recorded_time: body.currentCheckOutTime,
        status: 'check-out' as const,
        store_name: body.currentCheckOutStore,
        photo_public_url: currentCheckOutPhotoData.publicUrl,
        storage_path: currentCheckOutPhotoData.storagePath,
        latitude: currentLat,
        longitude: currentLng,
        subdistrict: body.currentSubdistrict || null,
        district: body.currentDistrict || null,
        province: body.currentProvince || null,
        is_auto_generated: false,
      },
    ];

    console.log('[BulkAttendance] Creating 3 records:');
    records.forEach((record, idx) => {
      console.log(`  ${idx + 1}. ${record.status} at ${record.store_name} @ ${record.recorded_time} (auto: ${record.is_auto_generated})`);
    });

    // Insert all records atomically
    const { data: insertedRecords, error: insertError } = await supabase
      .from('attendance_records')
      .insert(records)
      .select();

    if (insertError) {
      console.error('[BulkAttendance] Insert error:', insertError);
      throw insertError;
    }

    console.log('[BulkAttendance] Successfully inserted records:', insertedRecords?.length);
    if (insertedRecords) {
      insertedRecords.forEach((rec) => {
        console.log(`  - ${rec.status} at ${rec.store_name} @ ${rec.recorded_time} (ID: ${rec.id})`);
      });
    }

    // Log the action
    await supabaseLogs.addLog({
      timestamp: new Date().toISOString(),
      scope: 'attendance',
      action: 'bulk_create',
      details: `สร้างบันทึกอัตโนมัติ 3 รายการ: ${body.employeeName} เปลี่ยนจาก ${body.oldStoreName} ไป ${body.newStoreName}`,
      metadata: {
        employeeName: body.employeeName,
        oldStore: body.oldStoreName,
        newStore: body.newStoreName,
        recordCount: 3,
        recordIds: insertedRecords?.map((r) => r.id),
      },
    });

    return Response.json({
      success: true,
      data: {
        recordsCreated: insertedRecords?.length || 0,
        records: insertedRecords,
      },
    });
  } catch (error) {
    console.error('[BulkAttendance] Error:', error);

    // Log error
    await supabaseLogs.addLog({
      timestamp: new Date().toISOString(),
      scope: 'attendance',
      action: 'bulk_create_error',
      details: `เกิดข้อผิดพลาดในการสร้างบันทึกอัตโนมัติ: ${error instanceof Error ? error.message : String(error)}`,
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
      },
      { status: 500 }
    );
  }
}
