export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Builds an `ST_GeomFromText` compatible WKT POLYGON, closing the ring if needed. */
export function polygonToWkt(points: LatLng[]): string {
  const ring = [...points];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first.latitude !== last.latitude || first.longitude !== last.longitude)) {
    ring.push(first);
  }
  const coordinates = ring.map((point) => `${point.longitude} ${point.latitude}`).join(", ");
  return `POLYGON((${coordinates}))`;
}

export function pointToWkt(point: LatLng): string {
  return `POINT(${point.longitude} ${point.latitude})`;
}

/** Parses the string produced by `ST_AsGeoJSON(...)` into a GeoJSON object, or null if the column was null. */
export function parseGeoJson<T>(raw: string | null): T | null {
  return raw === null ? null : (JSON.parse(raw) as T);
}
