import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import { withTelemetrySpan } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PCShelfPhoto = {
  id: string;
  report_id: string;
  photo_url: string;
  storage_path: string;
  caption: string | null;
  uploaded_at: string;
  created_at: string;
};

/**
 * Request body for adding shelf photos
 */
interface AddPhotosRequest {
  photos: Array<{
    photo_url: string;
    storage_path: string;
    caption?: string;
    uploaded_at?: string;
  }>;
}

/**
 * Response body for successful photo addition
 */
interface AddPhotosResponse {
  success: true;
  photos: PCShelfPhoto[];
}

/**
 * Error response body
 */
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

/**
 * Route segment config for dynamic parameter
 */
interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

const MAX_PHOTOS_PER_REPORT = 10;

/**
 * POST /api/admin/pc-reports/[id]/photos
 * Add shelf photos to a report
 *
 * คำอธิบายการทำงาน (Thai Explanation):
 * 1. รับ report ID จาก URL parameter
 * 2. ตรวจสอบว่ารายงานมีอยู่จริง
 * 3. ตรวจสอบจำนวนรูปที่มีอยู่แล้ว (ห้ามเกิน 10 รูปต่อรายงาน)
 * 4. ตรวจสอบความถูกต้องของข้อมูลรูปภาพแต่ละรูป
 * 5. Insert รูปภาพทั้งหมดลงในตาราง pc_shelf_photos
 * 6. ส่งข้อมูลรูปที่เพิ่มสำเร็จกลับไป
 *
 * ข้อควรระวัง (Important Notes):
 * - จำกัดจำนวนรูปไม่เกิน 10 รูปต่อรายงาน
 * - ต้องมี photo_url และ storage_path สำหรับทุกรูป
 * - uploaded_at จะใช้เวลาปัจจุบันถ้าไม่ได้ส่งมา
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  return withTelemetrySpan("pc_reports.add_photos", async (span) => {
    try {
      const { id: reportId } = await context.params;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(reportId)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid report ID format",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      span.setAttribute("report_id", reportId);

      const body = (await request.json()) as AddPhotosRequest;

      // Validate request body
      if (!body.photos || !Array.isArray(body.photos) || body.photos.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Photos array is required and must not be empty",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      // Validate each photo
      for (let i = 0; i < body.photos.length; i++) {
        const photo = body.photos[i];
        if (!photo.photo_url || !photo.storage_path) {
          return NextResponse.json(
            {
              success: false,
              error: `Photo at index ${i} is missing required fields: photo_url, storage_path`,
            } satisfies ErrorResponse,
            { status: 400 }
          );
        }
      }

      span.setAttribute("photos_to_add", body.photos.length);

      const client = getSupabaseServiceClient();

      // Check if report exists
      const { data: existingReport, error: checkError } = await client
        .from("pc_daily_reports")
        .select("id")
        .eq("id", reportId)
        .single();

      if (checkError || !existingReport) {
        span.markError(checkError || new Error("Report not found"));
        return NextResponse.json(
          {
            success: false,
            error: "Report not found",
            code: checkError?.code,
          } satisfies ErrorResponse,
          { status: 404 }
        );
      }

      // Count existing photos
      const { count: existingCount, error: countError } = await client
        .from("pc_shelf_photos")
        .select("*", { count: "exact", head: true })
        .eq("report_id", reportId);

      if (countError) {
        span.markError(countError);
        console.error("[pc-reports] Failed to count existing photos:", countError);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to check existing photos",
            code: countError.code,
          } satisfies ErrorResponse,
          { status: 500 }
        );
      }

      const currentPhotoCount = existingCount || 0;
      const newTotalCount = currentPhotoCount + body.photos.length;

      // Check if adding these photos would exceed the limit
      if (newTotalCount > MAX_PHOTOS_PER_REPORT) {
        const remainingSlots = MAX_PHOTOS_PER_REPORT - currentPhotoCount;
        return NextResponse.json(
          {
            success: false,
            error: `Cannot add ${body.photos.length} photos. Report has ${currentPhotoCount} photos and can only add ${remainingSlots} more (max ${MAX_PHOTOS_PER_REPORT} per report)`,
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      // Prepare photo records for insertion
      const photoRecords = body.photos.map((photo) => ({
        report_id: reportId,
        photo_url: photo.photo_url,
        storage_path: photo.storage_path,
        caption: photo.caption || null,
        uploaded_at: photo.uploaded_at || new Date().toISOString(),
      }));

      // Insert photos
      type SupabaseError = { message: string; code?: string } | null;
      type InsertResult = { data: PCShelfPhoto[] | null; error: SupabaseError };

      // Insert photos into pc_shelf_photos table
      const insertResult = await client
        .from("pc_shelf_photos")
        .insert(photoRecords)
        .select();

      const { data: insertedPhotos, error: insertError } = insertResult as unknown as InsertResult;

      if (insertError || !insertedPhotos) {
        span.markError(insertError || new Error("Insert failed"));
        console.error("[pc-reports] Failed to insert photos:", insertError);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to add photos",
            code: insertError?.code,
          } satisfies ErrorResponse,
          { status: 500 }
        );
      }

      span.setAttribute("photos_added", insertedPhotos.length);

      return NextResponse.json(
        {
          success: true,
          photos: insertedPhotos,
        } satisfies AddPhotosResponse,
        { status: 201 }
      );
    } catch (error) {
      console.error("[pc-reports] POST photos error:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      return NextResponse.json(
        {
          success: false,
          error: message,
        } satisfies ErrorResponse,
        { status: 500 }
      );
    }
  });
}
