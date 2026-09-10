import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

export interface AnimalDeviceSnapshot {
  animalId: string;
  lastSeen: Date | null;
  batteryLevel: number | null;
}

/**
 * One row per active animal with its currently-assigned device's heartbeat,
 * scoped to the properties the caller can see. Kept as a single query so
 * the dashboard summary (section 9) is O(1) round trips regardless of herd
 * size; if this ever needs to scale past tens of thousands of animals,
 * consider a materialized view refreshed on a schedule instead of live
 * aggregation.
 */
export async function getAnimalDeviceSnapshot(propertyIds?: string[]): Promise<AnimalDeviceSnapshot[]> {
  if (propertyIds !== undefined && propertyIds.length === 0) {
    return [];
  }
  const propertyFilter = propertyIds === undefined
    ? sql``
    : sql`AND a.property_id IN (${sql.join(propertyIds.map((id) => sql`${id}`), sql`, `)})`;

  const result = await db.execute<{
    animal_id: string;
    last_seen: Date | null;
    battery_level: number | null;
  }>(sql`
    SELECT a.id AS animal_id, d.last_seen, d.battery_level
    FROM animals a
    LEFT JOIN device_assignments da ON da.animal_id = a.id AND da.unassigned_at IS NULL
    LEFT JOIN devices d ON d.id = da.device_id
    WHERE a.status = 'active' ${propertyFilter}
  `);

  return result.rows.map((row) => ({
    animalId: row.animal_id,
    lastSeen: row.last_seen ? new Date(row.last_seen) : null,
    batteryLevel: row.battery_level,
  }));
}
