import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { deviceAssignments, devices, animals } from "../db/schema.js";

export async function findCurrentAssignmentByDevice(deviceId: string) {
  const [assignment] = await db
    .select()
    .from(deviceAssignments)
    .where(and(eq(deviceAssignments.deviceId, deviceId), isNull(deviceAssignments.unassignedAt)))
    .limit(1);
  return assignment ?? null;
}

export async function findCurrentAssignmentByAnimal(animalId: string) {
  const [assignment] = await db
    .select()
    .from(deviceAssignments)
    .where(and(eq(deviceAssignments.animalId, animalId), isNull(deviceAssignments.unassignedAt)))
    .limit(1);
  return assignment ?? null;
}

export async function findCurrentDeviceForAnimal(animalId: string) {
  const [row] = await db
    .select({ device: devices })
    .from(deviceAssignments)
    .innerJoin(devices, eq(devices.id, deviceAssignments.deviceId))
    .where(and(eq(deviceAssignments.animalId, animalId), isNull(deviceAssignments.unassignedAt)))
    .limit(1);
  return row?.device ?? null;
}

export async function findCurrentAnimalForDevice(deviceId: string) {
  const [row] = await db
    .select({ animal: animals })
    .from(deviceAssignments)
    .innerJoin(animals, eq(animals.id, deviceAssignments.animalId))
    .where(and(eq(deviceAssignments.deviceId, deviceId), isNull(deviceAssignments.unassignedAt)))
    .limit(1);
  return row?.animal ?? null;
}

/**
 * Bulk lookup of the current animal (if any) assigned to each device, for
 * list views (e.g. GET /api/devices) that need to show/filter on assignment
 * without an N+1 query per row.
 */
export async function listCurrentAssignmentsForDevices(deviceIds: string[]) {
  if (deviceIds.length === 0) {
    return [];
  }
  return db
    .select({
      deviceId: deviceAssignments.deviceId,
      animalId: animals.id,
      animalTagCode: animals.tagCode,
      animalName: animals.name,
    })
    .from(deviceAssignments)
    .innerJoin(animals, eq(animals.id, deviceAssignments.animalId))
    .where(and(inArray(deviceAssignments.deviceId, deviceIds), isNull(deviceAssignments.unassignedAt)));
}

export async function listAssignmentHistoryByAnimal(animalId: string) {
  return db
    .select()
    .from(deviceAssignments)
    .where(eq(deviceAssignments.animalId, animalId))
    .orderBy(desc(deviceAssignments.assignedAt));
}

/**
 * Closes any open assignment for the device and/or the animal, then opens a
 * new one. Runs in a transaction so a device or animal is never left with
 * two concurrently "current" assignments.
 */
export async function assignDeviceToAnimal(deviceId: string, animalId: string) {
  return db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .update(deviceAssignments)
      .set({ unassignedAt: now })
      .where(and(eq(deviceAssignments.deviceId, deviceId), isNull(deviceAssignments.unassignedAt)));
    await tx
      .update(deviceAssignments)
      .set({ unassignedAt: now })
      .where(and(eq(deviceAssignments.animalId, animalId), isNull(deviceAssignments.unassignedAt)));

    const [assignment] = await tx
      .insert(deviceAssignments)
      .values({ deviceId, animalId })
      .returning();
    return assignment;
  });
}

export async function unassignDevice(deviceId: string): Promise<void> {
  await db
    .update(deviceAssignments)
    .set({ unassignedAt: new Date() })
    .where(and(eq(deviceAssignments.deviceId, deviceId), isNull(deviceAssignments.unassignedAt)));
}
