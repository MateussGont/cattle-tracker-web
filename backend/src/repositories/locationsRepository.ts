import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { locations } from "../db/schema.js";
import type { LatLng } from "../utils/geo.js";

export interface InsertLocationInput {
  deviceId: string;
  animalId: string | null;
  position: LatLng;
  gpsAccuracy?: number;
  batteryLevel?: number;
  recordedAt: Date;
}

export async function insertLocation(input: InsertLocationInput) {
  const [location] = await db
    .insert(locations)
    .values({
      deviceId: input.deviceId,
      animalId: input.animalId,
      position: sql`ST_SetSRID(ST_MakePoint(${input.position.longitude}, ${input.position.latitude}), 4326)::geography`,
      gpsAccuracy: input.gpsAccuracy,
      batteryLevel: input.batteryLevel,
      recordedAt: input.recordedAt,
    })
    .returning({ id: locations.id, recordedAt: locations.recordedAt });
  return location;
}

const locationGeoJsonSelect = {
  id: locations.id,
  deviceId: locations.deviceId,
  animalId: locations.animalId,
  latitude: sql<number>`ST_Y(${locations.position}::geometry)`.as("latitude"),
  longitude: sql<number>`ST_X(${locations.position}::geometry)`.as("longitude"),
  gpsAccuracy: locations.gpsAccuracy,
  batteryLevel: locations.batteryLevel,
  recordedAt: locations.recordedAt,
};

export async function findLatestLocationByAnimal(animalId: string) {
  const [location] = await db
    .select(locationGeoJsonSelect)
    .from(locations)
    .where(eq(locations.animalId, animalId))
    .orderBy(desc(locations.recordedAt))
    .limit(1);
  return location ?? null;
}

export interface LocationHistoryFilter {
  animalId: string;
  from?: Date;
  to?: Date;
  limit: number;
}

export async function listLocationHistoryByAnimal(filter: LocationHistoryFilter) {
  const conditions = [eq(locations.animalId, filter.animalId)];
  if (filter.from) {
    conditions.push(gte(locations.recordedAt, filter.from));
  }
  if (filter.to) {
    conditions.push(lte(locations.recordedAt, filter.to));
  }

  return db
    .select(locationGeoJsonSelect)
    .from(locations)
    .where(and(...conditions))
    .orderBy(desc(locations.recordedAt))
    .limit(filter.limit);
}
