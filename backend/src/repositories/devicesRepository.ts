import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { animals, deviceAssignments, devices, gateways } from "../db/schema.js";

export async function findDeviceByRadioId(radioDeviceId: number) {
  const [device] = await db
    .select()
    .from(devices)
    .where(eq(devices.radioDeviceId, radioDeviceId))
    .limit(1);
  return device ?? null;
}

export async function findDeviceById(id: string) {
  const [device] = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
  return device ?? null;
}

export interface ListDevicesFilter {
  status?: "active" | "inactive" | "maintenance";
  propertyIds?: string[];
  limit: number;
  offset: number;
}

export async function listDevices(filter: ListDevicesFilter) {
  if (filter.propertyIds !== undefined && filter.propertyIds.length === 0) {
    return [];
  }
  const conditions = filter.status ? [eq(devices.status, filter.status)] : [];
  if (filter.propertyIds !== undefined) {
    const assignedDeviceIds = db
      .select({ id: deviceAssignments.deviceId })
      .from(deviceAssignments)
      .innerJoin(animals, eq(animals.id, deviceAssignments.animalId))
      .where(and(isNull(deviceAssignments.unassignedAt), inArray(animals.propertyId, filter.propertyIds)));
    const accessibleGatewayIds = db
      .select({ id: gateways.id })
      .from(gateways)
      .where(inArray(gateways.propertyId, filter.propertyIds));
    conditions.push(
      or(
        inArray(devices.id, assignedDeviceIds),
        inArray(devices.gatewayId, accessibleGatewayIds),
      )!,
    );
  }
  return db
    .select()
    .from(devices)
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(filter.limit)
    .offset(filter.offset)
    .orderBy(devices.createdAt);
}

export interface CreateDeviceInput {
  deviceIdentifier: string;
  radioDeviceId: number;
  hardwareModel?: string;
  gatewayId?: string;
}

export async function createDevice(input: CreateDeviceInput) {
  const [device] = await db.insert(devices).values(input).returning();
  return device;
}

export async function updateDeviceStatus(
  id: string,
  patch: { status?: "active" | "inactive" | "maintenance"; hardwareModel?: string },
) {
  const [device] = await db
    .update(devices)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(devices.id, id))
    .returning();
  return device ?? null;
}

export interface HeartbeatInput {
  deviceId: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  batteryLevel?: number;
  seenAt: Date;
  gpsFixAt?: Date;
}

export async function recordHeartbeat(input: HeartbeatInput): Promise<void> {
  await db
    .update(devices)
    .set({
      lastLatitude: input.latitude ?? sql`${devices.lastLatitude}`,
      lastLongitude: input.longitude ?? sql`${devices.lastLongitude}`,
      lastGpsAccuracy: input.gpsAccuracy ?? sql`${devices.lastGpsAccuracy}`,
      batteryLevel: input.batteryLevel ?? sql`${devices.batteryLevel}`,
      lastSeen: input.seenAt,
      lastGpsFixAt: input.gpsFixAt ?? sql`${devices.lastGpsFixAt}`,
      updatedAt: new Date(),
    })
    .where(eq(devices.id, input.deviceId));
}
