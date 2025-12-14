/**
 * File Validation Utilities
 *
 * Provides validation functions for uploaded files to prevent
 * malicious file uploads and ensure file safety.
 */

/**
 * Allowed image MIME types
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
] as const;

/**
 * Max file sizes
 */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFilename?: string;
  mimeType?: string;
  size?: number;
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): FileValidationResult {
  // Check file size
  if (file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `ไฟล์ใหญ่เกินไป (สูงสุด ${MAX_IMAGE_SIZE / 1024 / 1024}MB แต่ได้รับ ${(file.size / 1024 / 1024).toFixed(2)}MB)`
    };
  }

  // Check if file is empty
  if (file.size === 0) {
    return {
      valid: false,
      error: 'ไฟล์ว่างเปล่า'
    };
  }

  // Check MIME type using type guard
  const isAllowedType = (type: string): type is typeof ALLOWED_IMAGE_TYPES[number] =>
    ALLOWED_IMAGE_TYPES.includes(type as typeof ALLOWED_IMAGE_TYPES[number]);

  if (!isAllowedType(file.type)) {
    return {
      valid: false,
      error: `รองรับเฉพาะไฟล์ภาพ (JPG, PNG, WebP, GIF) ได้รับ: ${file.type || 'unknown'}`
    };
  }

  // Sanitize filename (remove special chars, prevent path traversal)
  const sanitized = sanitizeFilename(file.name);

  // Verify file extension matches MIME type
  const ext = sanitized.split('.').pop()?.toLowerCase();
  const mimeExt = file.type.split('/')[1];

  if (ext && mimeExt) {
    // jpg and jpeg are equivalent
    const isJpeg = (ext === 'jpg' || ext === 'jpeg') && (mimeExt === 'jpg' || mimeExt === 'jpeg');
    const isMatch = ext === mimeExt || isJpeg;

    if (!isMatch) {
      return {
        valid: false,
        error: `นามสกุลไฟล์ (${ext}) ไม่ตรงกับประเภทไฟล์ (${mimeExt})`
      };
    }
  }

  return {
    valid: true,
    sanitizedFilename: sanitized,
    mimeType: file.type,
    size: file.size
  };
}

/**
 * Validate image content by checking magic bytes
 */
export async function validateImageContent(file: File): Promise<boolean> {
  try {
    // Read first 12 bytes to check magic bytes
    const arrayBuffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // JPEG magic bytes: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return true;
    }

    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    if (bytes[0] === 0x89 && bytes[1] === 0x50 &&
        bytes[2] === 0x4E && bytes[3] === 0x47 &&
        bytes[4] === 0x0D && bytes[5] === 0x0A &&
        bytes[6] === 0x1A && bytes[7] === 0x0A) {
      return true;
    }

    // WebP magic bytes: 52 49 46 46 ... 57 45 42 50
    if (bytes[0] === 0x52 && bytes[1] === 0x49 &&
        bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 &&
        bytes[10] === 0x42 && bytes[11] === 0x50) {
      return true;
    }

    // GIF magic bytes: 47 49 46 38 (37 61 or 39 61)
    if (bytes[0] === 0x47 && bytes[1] === 0x49 &&
        bytes[2] === 0x46 && bytes[3] === 0x38 &&
        (bytes[4] === 0x37 || bytes[4] === 0x39) &&
        bytes[5] === 0x61) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error validating image content:', error);
    return false;
  }
}

/**
 * Sanitize filename
 * - Remove path traversal characters
 * - Remove special characters
 * - Limit length
 * - Preserve extension
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unknown';

  // Get extension
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop() : '';
  const basename = parts.join('.');

  // Clean basename
  let clean = basename
    .replace(/[^a-zA-Z0-9\u0E00-\u0E7F_-]/g, '_') // Allow Thai, alphanumeric, underscore, dash
    .replace(/\.{2,}/g, '_')                       // Prevent ../
    .replace(/^\.+/, '')                            // Remove leading dots
    .replace(/_+/g, '_')                            // Collapse multiple underscores
    .substring(0, 100);                             // Limit length

  // If basename is empty after cleaning, use timestamp
  if (!clean) {
    clean = `file_${Date.now()}`;
  }

  // Clean extension
  const cleanExt = ext
    ? ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 10)
    : '';

  return cleanExt ? `${clean}.${cleanExt}` : clean;
}

/**
 * Validate data URL (base64 image)
 */
export function validateDataUrl(dataUrl: string): {
  valid: boolean;
  error?: string;
  mimeType?: string;
  buffer?: Buffer;
} {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return { valid: false, error: 'ข้อมูลรูปภาพไม่ถูกต้อง' };
  }

  // Check format: data:image/jpeg;base64,/9j/4AAQ...
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    return { valid: false, error: 'รูปแบบ Data URL ไม่ถูกต้อง' };
  }

  const mimeType = match[1];
  const base64Data = match[2];

  // Check MIME type using type guard
  const isAllowedMimeType = (type: string): type is typeof ALLOWED_IMAGE_TYPES[number] =>
    ALLOWED_IMAGE_TYPES.includes(type as typeof ALLOWED_IMAGE_TYPES[number]);

  if (!isAllowedMimeType(mimeType)) {
    return {
      valid: false,
      error: `รองรับเฉพาะไฟล์ภาพ (JPG, PNG, WebP, GIF) ได้รับ: ${mimeType}`
    };
  }

  // Decode base64
  try {
    const buffer = Buffer.from(base64Data, 'base64');

    // Check size
    if (buffer.length === 0) {
      return { valid: false, error: 'ไฟล์ว่างเปล่า' };
    }

    if (buffer.length > MAX_IMAGE_SIZE) {
      return {
        valid: false,
        error: `ไฟล์ใหญ่เกินไป (สูงสุด ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`
      };
    }

    return {
      valid: true,
      mimeType,
      buffer
    };
  } catch (error) {
    return { valid: false, error: 'ไม่สามารถถอดรหัส Base64 ได้' };
  }
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };

  return map[mimeType] || 'bin';
}
