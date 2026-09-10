import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { alertRules, properties } from "../db/schema.js";
import { parseGeoJson, pointToWkt, polygonToWkt, type LatLng } from "../utils/geo.js";
import type { GeoJsonPoint, GeoJsonPolygon } from "../schemas/geoJson.js";

/**
 * Every new property starts with the same 4 basic threshold-based alert
 * rules (matching the backfill applied to pre-existing properties in
 * migration 0002), so a farm owner never has to configure the basics from
 * scratch — they can edit/disable/delete these or add their own.
 */
const DEFAULT_ALERT_RULES = [
  { metric: "battery_level" as const, thresholdValue: 20, name: "Bateria baixa" },
  { metric: "device_offline_minutes" as const, thresholdValue: 60, name: "Dispositivo sem comunicação" },
  { metric: "gps_stale_minutes" as const, thresholdValue: 60, name: "GPS desatualizado" },
  { metric: "gateway_offline_minutes" as const, thresholdValue: 60, name: "Gateway sem comunicação" },
];

const propertyGeoJsonSelect = {
  id: properties.id,
  name: properties.name,
  areaHectares: properties.areaHectares,
  location: sql<string | null>`ST_AsGeoJSON(${properties.location})`.as("location"),
  boundary: sql<string | null>`ST_AsGeoJSON(${properties.boundary})`.as("boundary"),
  createdAt: properties.createdAt,
  updatedAt: properties.updatedAt,
};

function withParsedGeometry<T extends { location: string | null; boundary: string | null }>(row: T) {
  return {
    ...row,
    location: parseGeoJson<GeoJsonPoint>(row.location),
    boundary: parseGeoJson<GeoJsonPolygon>(row.boundary),
  };
}

export async function listProperties(propertyIds?: string[]) {
  const query = db.select(propertyGeoJsonSelect).from(properties);
  if (propertyIds !== undefined && propertyIds.length === 0) {
    return [];
  }
  const rows = propertyIds === undefined
    ? await query
    : await query.where(inArray(properties.id, propertyIds));
  return rows.map(withParsedGeometry);
}

export async function findPropertyById(id: string) {
  const [property] = await db
    .select(propertyGeoJsonSelect)
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);
  return property ? withParsedGeometry(property) : null;
}

export interface CreatePropertyInput {
  name: string;
  location?: LatLng;
  boundary?: LatLng[];
}

export async function createProperty(input: CreatePropertyInput) {
  const [property] = await db
    .insert(properties)
    .values({
      name: input.name,
      location: input.location
        ? sql`ST_SetSRID(ST_GeomFromText(${pointToWkt(input.location)}), 4326)::geography`
        : undefined,
      boundary: input.boundary
        ? sql`ST_SetSRID(ST_GeomFromText(${polygonToWkt(input.boundary)}), 4326)`
        : undefined,
    })
    .returning({ id: properties.id });
  if (!property) {
    throw new Error("Failed to create property");
  }

  await db.insert(alertRules).values(
    DEFAULT_ALERT_RULES.map((rule) => ({
      propertyId: property.id,
      metric: rule.metric,
      thresholdValue: rule.thresholdValue,
      name: rule.name,
    })),
  );

  return property;
}
