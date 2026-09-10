import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

export interface AnimalMapMarker {
  animalId: string;
  tagCode: string;
  name: string | null;
  animalStatus: "active" | "sold" | "deceased" | "inactive";
  propertyId: string;
  deviceId: string | null;
  deviceIdentifier: string | null;
  latitude: number | null;
  longitude: number | null;
  batteryLevel: number | null;
  lastSeen: Date | null;
}

/**
 * One marker per active animal, using the last-known position cached on
 * `devices` (updated on every heartbeat) rather than querying the
 * high-volume `locations` table — the map overview only needs "where is
 * everyone right now", not history.
 */
export async function listAnimalMapMarkers(propertyIds?: string[]): Promise<AnimalMapMarker[]> {
  if (propertyIds !== undefined && propertyIds.length === 0) {
    return [];
  }
  const propertyFilter = propertyIds === undefined
    ? sql``
    : sql`AND a.property_id IN (${sql.join(propertyIds.map((id) => sql`${id}`), sql`, `)})`;

  const result = await db.execute<{
    animal_id: string;
    tag_code: string;
    name: string | null;
    animal_status: AnimalMapMarker["animalStatus"];
    property_id: string;
    device_id: string | null;
    device_identifier: string | null;
    last_latitude: number | null;
    last_longitude: number | null;
    battery_level: number | null;
    last_seen: Date | null;
  }>(sql`
    SELECT
      a.id AS animal_id,
      a.tag_code,
      a.name,
      a.status AS animal_status,
      a.property_id,
      d.id AS device_id,
      d.device_identifier,
      d.last_latitude,
      d.last_longitude,
      d.battery_level,
      d.last_seen
    FROM animals a
    LEFT JOIN device_assignments da ON da.animal_id = a.id AND da.unassigned_at IS NULL
    LEFT JOIN devices d ON d.id = da.device_id
    WHERE a.status = 'active' ${propertyFilter}
  `);

  return result.rows.map((row) => ({
    animalId: row.animal_id,
    tagCode: row.tag_code,
    name: row.name,
    animalStatus: row.animal_status,
    propertyId: row.property_id,
    deviceId: row.device_id,
    deviceIdentifier: row.device_identifier,
    latitude: row.last_latitude,
    longitude: row.last_longitude,
    batteryLevel: row.battery_level,
    lastSeen: row.last_seen ? new Date(row.last_seen) : null,
  }));
}
