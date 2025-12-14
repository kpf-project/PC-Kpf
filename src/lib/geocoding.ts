/**
 * Reverse Geocoding Utilities
 * Convert GPS coordinates to address (subdistrict, district, province)
 */

interface GeocodingResult {
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  fullAddress: string | null;
}

/**
 * Get address from coordinates using OpenStreetMap Nominatim API
 * Free service with rate limit (1 request/second)
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodingResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=th&zoom=18&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "AttendanceTrackerPWA/1.0",
      },
    });

    if (!response.ok) {
      console.error("[Geocoding] API error:", response.status);
      return {
        subdistrict: null,
        district: null,
        province: null,
        fullAddress: null,
      };
    }

    const data = await response.json();
    const address = data.address || {};

    // Extract Thai administrative divisions
    // Note: OpenStreetMap uses different terms for Thailand
    const subdistrict =
      address.suburb || // ตำบล/แขวง
      address.neighbourhood ||
      address.village ||
      null;

    const district =
      address.county || // อำเภอ/เขต
      address.city_district ||
      address.municipality ||
      null;

    const province =
      address.state || // จังหวัด
      address.province ||
      null;

    const fullAddress = data.display_name || null;

    return {
      subdistrict,
      district,
      province,
      fullAddress,
    };
  } catch (error) {
    console.error("[Geocoding] Error:", error);
    return {
      subdistrict: null,
      district: null,
      province: null,
      fullAddress: null,
    };
  }
}

/**
 * Format address for display
 */
export function formatAddress(result: GeocodingResult): string {
  const parts: string[] = [];

  if (result.subdistrict) {
    parts.push(`ต.${result.subdistrict}`);
  }

  if (result.district) {
    parts.push(`อ.${result.district}`);
  }

  if (result.province) {
    parts.push(`จ.${result.province}`);
  }

  return parts.length > 0 ? parts.join(" ") : "ไม่สามารถระบุที่อยู่";
}

/**
 * Get short address (district + province only)
 */
export function formatShortAddress(result: GeocodingResult): string {
  const parts: string[] = [];

  if (result.district) {
    parts.push(result.district);
  }

  if (result.province) {
    parts.push(result.province);
  }

  return parts.length > 0 ? parts.join(", ") : "ไม่ระบุ";
}
