/**
 * Supabase Branding Operations
 *
 * This module handles branding settings via Supabase branding_settings table and Storage
 * Replaces filesystem-based storage from data/app-data.json and public/branding/
 */

import { getSupabaseServiceClient } from "./supabaseClient";


export interface BrandingSettings {
  logoPath: string | null;
  updatedAt: string;
}

/**
 * Get branding settings (single row table)
 */
export async function getBranding(): Promise<BrandingSettings> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("branding_settings")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    console.error("[supabaseBranding] Failed to fetch branding:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    // Return default if not found or on error
    return {
      logoPath: null,
      updatedAt: new Date(0).toISOString(),
    };
  }

  return {
    logoPath: data.logo_path,
    updatedAt: data.updated_at,
  };
}

/**
 * Update branding settings
 */
export async function updateBranding(input: {
  logoPath?: string | null;
}): Promise<BrandingSettings> {
  const supabase = getSupabaseServiceClient();

  // Get existing record or use first row
  const { data: existing } = await supabase
    .from("branding_settings")
    .select("id")
    .limit(1)
    .single();

  if (!existing) {
    // Create initial record if doesn't exist
    const { data: newRecord, error: insertError } = await supabase
      .from("branding_settings")
      .insert({
        logo_path: input.logoPath ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[supabaseBranding] Failed to create branding:", insertError);
      throw new Error(`ไม่สามารถสร้างการตั้งค่า branding ได้: ${insertError.message}`);
    }

    return {
      logoPath: newRecord.logo_path,
      updatedAt: newRecord.updated_at,
    };
  }

  // Update existing record
  const { data, error } = await supabase
    .from("branding_settings")
    .update({
      logo_path: input.logoPath ?? null,
    })
    .eq("id", existing.id)
    .select()
    .single();

  if (error) {
    console.error("[supabaseBranding] Failed to update branding:", error);
    throw new Error(`ไม่สามารถอัปเดตการตั้งค่า branding ได้: ${error.message}`);
  }

  return {
    logoPath: data.logo_path,
    updatedAt: data.updated_at,
  };
}

/**
 * Upload logo to Supabase Storage
 * @param file File object or Buffer
 * @param fileName File name for storage
 * @returns Public URL of uploaded file
 */
export async function uploadLogo(
  file: Buffer | File | Blob,
  fileName: string
): Promise<string> {
  const supabase = getSupabaseServiceClient();
  const bucketName = process.env.SUPABASE_ATTENDANCE_BUCKET;

  if (!bucketName) {
    throw new Error("SUPABASE_ATTENDANCE_BUCKET environment variable not set");
  }

  // Generate unique path for logo
  const timestamp = Date.now();
  const storagePath = `branding/logo-${timestamp}-${fileName}`;

  // Upload file
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, file, {
      contentType: "image/*",
      upsert: true,
    });

  if (uploadError) {
    console.error("[supabaseBranding] Failed to upload logo:", uploadError);
    throw new Error(`ไม่สามารถอัปโหลดโลโก้ได้: ${uploadError.message}`);
  }

  // Get public URL
  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

/**
 * Delete old logo from storage (cleanup)
 */
export async function deleteOldLogo(logoPath: string): Promise<void> {
  if (!logoPath) return;

  const supabase = getSupabaseServiceClient();
  const bucketName = process.env.SUPABASE_ATTENDANCE_BUCKET;

  if (!bucketName) return;

  // Extract storage path from public URL
  // Public URL format: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
  const pathMatch = logoPath.match(/\/public\/[^/]+\/(.+)$/);
  if (!pathMatch) return;

  const storagePath = pathMatch[1];

  const { error } = await supabase.storage
    .from(bucketName)
    .remove([storagePath]);

  if (error) {
    console.error("[supabaseBranding] Failed to delete old logo:", error);
    // Don't throw - this is cleanup, not critical
  }
}
