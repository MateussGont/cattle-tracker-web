import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { geofences } from "../db/schema.js";
import { parseGeoJson, polygonToWkt, type LatLng } from "../utils/geo.js";
import type { GeoJsonPolygon } from "../schemas/geoJson.js";

const geofenceGeoJsonSelect = {
  id: geofences.id,
  propertyId: geofences.propertyId,
  name: geofences.name,
  active: geofences.active,
  boundary: sql<string>`ST_AsGeoJSON(${geofences.boundary})`.as("boundary"),
  createdAt: geofences.createdAt,
  updatedAt: geofences.updatedAt,
};

export async function listGeofencesByProperty(propertyId: string) {
  const rows = await db
    .select(geofenceGeoJsonSelect)
    .from(geofences)
    .where(eq(geofences.propertyId, propertyId));
  return rows.map((row) => ({ ...row, boundary: parseGeoJson<GeoJsonPolygon>(row.boundary) }));
}

export interface CreateGeofenceInput {
  propertyId: string;
  name: string;
  boundary: LatLng[];
  active: boolean;
}

export async function createGeofence(input: CreateGeofenceInput) {
  const [geofence] = await db
    .insert(geofences)
    .values({
      propertyId: input.propertyId,
      name: input.name,
      active: input.active,
      boundary: sql`ST_SetSRID(ST_GeomFromText(${polygonToWkt(input.boundary)}), 4326)`,
    })
    .returning({ id: geofences.id });
  return geofence;
}

/**
 * Returns the ids of active geofences of the property that do NOT contain
 * the given point, i.e. the geofences the point currently violates. Used by
 * telemetryService to raise/clear "animal fora da propriedade" alerts.
 */
export async function findViolatedGeofenceIds(
  propertyId: string,
  point: LatLng,
): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT id FROM ${geofences}
    WHERE property_id = ${propertyId}
      AND active = true
      AND NOT ST_Contains(boundary, ST_SetSRID(ST_MakePoint(${point.longitude}, ${point.latitude}), 4326))
  `);
  return rows.rows.map((row) => row.id);
}

export async function deleteGeofence(propertyId: string, geofenceId: string): Promise<boolean> {
  const deleted = await db
    .delete(geofences)
    .where(and(eq(geofences.id, geofenceId), eq(geofences.propertyId, propertyId)))
    .returning({ id: geofences.id });
  return deleted.length > 0;
}

export async function propertyHasActiveGeofences(propertyId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: geofences.id })
    .from(geofences)
    .where(and(eq(geofences.propertyId, propertyId), eq(geofences.active, true)))
    .limit(1);
  return Boolean(row);
}
