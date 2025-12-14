/**
 * Input Validation Utilities
 *
 * Provides validation functions for common data types to prevent
 * SQL injection, XSS, and other injection attacks.
 */

/**
 * Validate date string in YYYY-MM-DD format
 */
export function validateDateString(date: string): boolean {
  // Must match YYYY-MM-DD format exactly
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  // Must be valid date
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return false;

  // Check that parsed date matches input (prevents dates like 2024-02-30)
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const reconstructed = `${year}-${month}-${day}`;

  return reconstructed === date;
}

/**
 * Validate time string in HH:MM or HH:MM:SS format
 */
export function validateTimeString(time: string): boolean {
  // Match HH:MM or HH:MM:SS format
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
  return timeRegex.test(time);
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (Thai format)
 */
export function validatePhoneNumber(phone: string): boolean {
  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '');

  // Thai phone: 10 digits starting with 0, or mobile starting with 06-09
  const thaiPhoneRegex = /^0[0-9]{9}$/;
  return thaiPhoneRegex.test(cleaned);
}

/**
 * Validate latitude (-90 to 90)
 */
export function validateLatitude(lat: number): boolean {
  return typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validate longitude (-180 to 180)
 */
export function validateLongitude(lng: number): boolean {
  return typeof lng === 'number' && isFinite(lng) && lng >= -180 && lng <= 180;
}

/**
 * Sanitize string to prevent XSS
 * Removes HTML tags and control characters
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') return '';

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  sanitized = sanitized.substring(0, maxLength);

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * Sanitize multiline text
 */
export function sanitizeMultiline(input: string, maxLength: number = 5000): string {
  let sanitized = sanitizeString(input, maxLength);

  // Normalize line breaks
  sanitized = sanitized.replace(/\r\n/g, '\n');

  // Limit consecutive newlines
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

  return sanitized;
}

/**
 * Validate and parse positive integer
 */
export function validatePositiveInteger(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) {
    return null;
  }

  return num;
}

/**
 * Validate and parse positive number (can be decimal)
 */
export function validatePositiveNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }

  return num;
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: string,
  allowedValues: readonly T[]
): value is T {
  return allowedValues.includes(value as T);
}

/**
 * Validate array length
 */
export function validateArrayLength<T>(
  arr: T[],
  min: number,
  max: number
): boolean {
  return Array.isArray(arr) && arr.length >= min && arr.length <= max;
}
