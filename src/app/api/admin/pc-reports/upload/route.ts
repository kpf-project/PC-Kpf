/**
 * PC Report Photo Upload API
 *
 * Endpoint for uploading photos to Supabase Storage
 * Used for shelf photos, competitor promos, and store promos
 */

import { NextRequest, NextResponse } from "next/server";
import { withTelemetrySpan } from "@/lib/observability";
import { uploadReportPhoto, generatePhotoPath } from "@/lib/pcReports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/pc-reports/upload
 *
 * Upload a photo to Supabase Storage
 *
 * Body (multipart/form-data):
 * - file: File (image file)
 * - employee_id: string
 * - report_date: string (YYYY-MM-DD)
 * - store_id: string
 * - photo_type: "shelf" | "competitor" | "store-promo"
 *
 * Or Body (JSON):
 * - photo: string (base64 data URL)
 * - employee_id: string
 * - report_date: string
 * - store_id: string
 * - photo_type: "shelf" | "competitor" | "store-promo"
 */
export async function POST(request: NextRequest) {
  return withTelemetrySpan("pc_reports.upload_photo", async (span) => {
    try {
      const contentType = request.headers.get("content-type") || "";

      let file: File | string;
      let employeeId: string;
      let reportDate: string;
      let storeId: string;
      let photoType: "shelf" | "competitor" | "store-promo";

      if (contentType.includes("multipart/form-data")) {
        // Handle multipart form data (File upload)
        const formData = await request.formData();
        const fileField = formData.get("file");
        employeeId = formData.get("employee_id") as string;
        reportDate = formData.get("report_date") as string;
        storeId = formData.get("store_id") as string;
        photoType = formData.get("photo_type") as "shelf" | "competitor" | "store-promo";

        if (!fileField || typeof fileField === "string") {
          return NextResponse.json(
            { success: false, error: "Missing or invalid file" },
            { status: 400 }
          );
        }

        file = fileField as File;
      } else {
        // Handle JSON (base64 data URL)
        const body = await request.json();
        file = body.photo;
        employeeId = body.employee_id;
        reportDate = body.report_date;
        storeId = body.store_id;
        photoType = body.photo_type;

        if (!file || typeof file !== "string") {
          return NextResponse.json(
            { success: false, error: "Missing or invalid photo (base64 data URL)" },
            { status: 400 }
          );
        }
      }

      // Validate required fields
      if (!employeeId || !reportDate || !storeId || !photoType) {
        return NextResponse.json(
          { success: false, error: "Missing required fields" },
          { status: 400 }
        );
      }

      // Validate photo type
      if (!["shelf", "competitor", "store-promo"].includes(photoType)) {
        return NextResponse.json(
          { success: false, error: "Invalid photo_type (must be 'shelf', 'competitor', or 'store-promo')" },
          { status: 400 }
        );
      }

      span.setAttribute("employee_id", employeeId);
      span.setAttribute("report_date", reportDate);
      span.setAttribute("store_id", storeId);
      span.setAttribute("photo_type", photoType);

      // Generate storage path
      const storagePath = generatePhotoPath(
        employeeId,
        reportDate,
        storeId,
        photoType
      );

      // Upload photo
      const { publicUrl, storagePath: actualPath } = await uploadReportPhoto(
        file,
        storagePath
      );

      span.setAttribute("storage_path", actualPath);

      return NextResponse.json({
        success: true,
        photo_url: publicUrl,
        storage_path: actualPath,
        uploaded_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[PC Reports Upload] Error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to upload photo",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  });
}
