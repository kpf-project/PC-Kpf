import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";
import { withTelemetrySpan } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Success response body
 */
interface DeletePhotoResponse {
  success: true;
  message: string;
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
 * Route segment config for dynamic parameters
 */
interface RouteContext {
  params: Promise<{
    id: string;
    photoId: string;
  }>;
}

/**
 * DELETE /api/admin/pc-reports/[id]/photos/[photoId]
 * Delete a shelf photo
 *
 * คำอธิบายการทำงาน (Thai Explanation):
 * 1. รับ report ID และ photo ID จาก URL parameters
 * 2. ตรวจสอบว่ารูปภาพมีอยู่จริงและเป็นของรายงานนี้
 * 3. ลบรูปภาพออกจากฐานข้อมูล
 * 4. ส่งข้อความยืนยันการลบกลับไป
 *
 * หมายเหตุ (Note):
 * - การลบจะเป็นการลบ record จากฐานข้อมูลเท่านั้น
 * - ไฟล์ใน Storage bucket จะยังคงอยู่ (อาจต้องมี cleanup process แยกต่างหาก)
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  return withTelemetrySpan("pc_reports.delete_photo", async (span) => {
    try {
      const { id: reportId, photoId } = await context.params;

      // Validate UUID formats
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

      if (!uuidRegex.test(photoId)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid photo ID format",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      span.setAttribute("report_id", reportId);
      span.setAttribute("photo_id", photoId);

      const client = getSupabaseServiceClient();

      // Check if photo exists and belongs to this report
      const { data: existingPhoto, error: checkError } = await client
        .from("pc_shelf_photos")
        .select("id, report_id")
        .eq("id", photoId)
        .single<{ id: string; report_id: string }>();

      if (checkError || !existingPhoto) {
        span.markError(checkError || new Error("Photo not found"));
        return NextResponse.json(
          {
            success: false,
            error: "Photo not found",
            code: checkError?.code,
          } satisfies ErrorResponse,
          { status: 404 }
        );
      }

      // Verify photo belongs to the specified report
      if (existingPhoto.report_id !== reportId) {
        return NextResponse.json(
          {
            success: false,
            error: "Photo does not belong to this report",
          } satisfies ErrorResponse,
          { status: 400 }
        );
      }

      // Delete photo
      const { error: deleteError } = await client
        .from("pc_shelf_photos")
        .delete()
        .eq("id", photoId);

      if (deleteError) {
        span.markError(deleteError);
        console.error("[pc-reports] Failed to delete photo:", deleteError);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to delete photo",
            code: deleteError.code,
          } satisfies ErrorResponse,
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Photo deleted",
      } satisfies DeletePhotoResponse);
    } catch (error) {
      console.error("[pc-reports] DELETE photo error:", error);
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
