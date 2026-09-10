const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const [lonA, latA] = a;
  const [lonB, latB] = b;
  const dLat = toRadians(latB - latA);
  const dLon = toRadians(lonB - lonA);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Sum of consecutive great-circle distances along an ordered [lon, lat] path, in meters. */
export function pathDistanceMeters(points: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    if (previous && current) {
      total += haversineMeters(previous, current);
    }
  }
  return total;
}
