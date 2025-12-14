import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getBranding, updateBranding } from "@/lib/supabaseBranding";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const BUCKET_NAME = process.env.SUPABASE_ATTENDANCE_BUCKET || "attendance-photos";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

// Type for file-like object from FormData (works in both browser and Node.js)
type FileFromFormData = Blob & { name: string; type: string };

function resolveExtension(file: FileFromFormData) {
  const mimeType = file.type || "";
  const mimeExt = MIME_EXTENSION_MAP[mimeType];
  if (mimeExt) return mimeExt;

  const nameExt = file.name?.split('.').pop()?.toLowerCase();
  if (nameExt && Object.values(MIME_EXTENSION_MAP).includes(`.${nameExt}`)) {
    return `.${nameExt}`;
  }

  return ".png";
}

async function deleteFromStorage(logoPath: string | null) {
  if (!logoPath) return;

  // Extract storage path from public URL
  // Format: https://xxx.supabase.co/storage/v1/object/public/bucket-name/branding/xxx.png
  const match = logoPath.match(/\/object\/public\/[^/]+\/(.+)$/);
  if (!match) return;

  const storagePath = match[1];
  const supabase = getSupabaseServiceClient();

  try {
    await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
  } catch (error) {
    console.warn("[branding] remove from storage failed", error);
  }
}

export async function GET() {
  const branding = await getBranding();
  return NextResponse.json(branding);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("logo");
    // Check if file exists and is a Blob-like object with required properties
    // Note: In Node.js environment, File is not available, but FormData returns Blob-like objects
    if (!file || typeof file === "string" || !("name" in file) || !("arrayBuffer" in file)) {
      return NextResponse.json(
        { error: "ไม่พบไฟล์โลโก้ กรุณาแนบไฟล์ก่อนบันทึก" },
        { status: 400 },
      );
    }

    // Type assertion after validation
    const logoFile = file as FileFromFormData;
    const size = logoFile.size;
    if (size === 0) {
      return NextResponse.json(
        { error: "ไฟล์ว่างเปล่า กรุณาเลือกไฟล์อื่น" },
        { status: 400 },
      );
    }
    if (size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "ไฟล์ใหญ่เกินกำหนด (สูงสุด 2MB)" },
        { status: 400 },
      );
    }
    if (logoFile.type && !logoFile.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "รองรับเฉพาะไฟล์ภาพเท่านั้น" },
        { status: 400 },
      );
    }

    const extension = resolveExtension(logoFile);
    const filename = `branding-logo-${Date.now()}-${randomUUID()}${extension}`;
    const storagePath = `branding/${filename}`;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await logoFile.arrayBuffer());
    const supabase = getSupabaseServiceClient();

    const uploadResult = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: logoFile.type,
        upsert: false,
      });

    if (uploadResult.error) {
      console.error("[branding] upload error", uploadResult.error);
      throw new Error("ไม่สามารถอัปโหลดโลโก้ได้");
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    const publicUrl = publicData?.publicUrl;
    if (!publicUrl) {
      throw new Error("ไม่สามารถสร้างลิงก์โลโก้ได้");
    }

    // Update branding in database
    const previousBranding = await getBranding();
    const branding = await updateBranding({ logoPath: publicUrl });

    // Delete old logo from storage if it exists
    if (previousBranding.logoPath && previousBranding.logoPath !== publicUrl) {
      await deleteFromStorage(previousBranding.logoPath);
    }

    return NextResponse.json(branding);
  } catch (error) {
    console.error("[branding] upload failed", error);
    return NextResponse.json(
      { error: "ไม่สามารถอัปโหลดโลโก้ได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const previousBranding = await getBranding();
    if (previousBranding.logoPath) {
      await deleteFromStorage(previousBranding.logoPath);
    }
    const branding = await updateBranding({ logoPath: null });
    return NextResponse.json(branding);
  } catch (error) {
    console.error("[branding] reset failed", error);
    return NextResponse.json(
      { error: "ไม่สามารถรีเซ็ตโลโก้ได้ กรุณาลองอีกครั้ง" },
      { status: 500 },
    );
  }
}
