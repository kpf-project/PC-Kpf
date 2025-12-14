const EARTH_RADIUS_METERS = 6371000;

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineDistance(a: Coordinates, b: Coordinates) {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const aa = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return EARTH_RADIUS_METERS * c;
}

export function bearingBetween(a: Coordinates, b: Coordinates) {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = Math.atan2(y, x);
  const degrees = ((brng * 180) / Math.PI + 360) % 360;
  return degrees;
}

const DIRECTIONS = [
  "เหนือ",
  "ตะวันออกเฉียงเหนือ",
  "ตะวันออก",
  "ตะวันออกเฉียงใต้",
  "ใต้",
  "ตะวันตกเฉียงใต้",
  "ตะวันตก",
  "ตะวันตกเฉียงเหนือ",
] as const;

export function bearingToCompass(degrees: number) {
  const index = Math.round(degrees / 45) % DIRECTIONS.length;
  return DIRECTIONS[index];
}
