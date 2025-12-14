/**
 * Timestamp formatting utilities with address support
 */

export interface TimestampData {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS or HH:MM
  subdistrict?: string | null;
  district?: string | null;
  province?: string | null;
}

/**
 * Format timestamp with address for photo overlay
 * Returns: "วันที่ เวลา\nตำบล อำเภอ จังหวัด"
 */
export function formatTimestampWithAddress(data: TimestampData): string {
  // Format date and time
  const dateObj = new Date(`${data.date}T${data.time}`);
  const dateStr = dateObj.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });

  const timeStr = data.time.substring(0, 5); // HH:MM

  // Format address
  const addressParts: string[] = [];
  if (data.subdistrict) addressParts.push(`ต.${data.subdistrict}`);
  if (data.district) addressParts.push(`อ.${data.district}`);
  if (data.province) addressParts.push(`จ.${data.province}`);

  const addressStr = addressParts.length > 0 ? addressParts.join(" ") : "";

  // Combine
  if (addressStr) {
    return `${dateStr} ${timeStr}\n${addressStr}`;
  }

  return `${dateStr} ${timeStr}`;
}

/**
 * Format short timestamp with district and province only
 * Returns: "วันที่ เวลา\nอำเภอ จังหวัด"
 */
export function formatShortTimestamp(data: TimestampData): string {
  const dateObj = new Date(`${data.date}T${data.time}`);
  const dateStr = dateObj.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });

  const timeStr = data.time.substring(0, 5); // HH:MM

  const addressParts: string[] = [];
  if (data.district) addressParts.push(data.district);
  if (data.province) addressParts.push(data.province);

  const addressStr = addressParts.length > 0 ? addressParts.join(", ") : "";

  if (addressStr) {
    return `${dateStr} ${timeStr}\n${addressStr}`;
  }

  return `${dateStr} ${timeStr}`;
}

/**
 * Get address string only (without date/time)
 */
export function formatAddressOnly(data: TimestampData): string {
  const parts: string[] = [];
  if (data.subdistrict) parts.push(`ต.${data.subdistrict}`);
  if (data.district) parts.push(`อ.${data.district}`);
  if (data.province) parts.push(`จ.${data.province}`);
  return parts.length > 0 ? parts.join(" ") : "ไม่มีข้อมูลที่อยู่";
}
