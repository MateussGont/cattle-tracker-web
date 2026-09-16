import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { devices, gateways } from "../db/schema.js";

export async function listDeviceMapMarkers(propertyIds?: string[]) {
  if (propertyIds !== undefined && propertyIds.length === 0) return [];

  const conditions = [
    eq(devices.provisioningStatus, "active"),
    eq(devices.status, "active"),
  ];
  if (propertyIds !== undefined) {
    const gatewayIds = db
      .select({ id: gateways.id })
      .from(gateways)
      .where(inArray(gateways.propertyId, propertyIds));
    conditions.push(inArray(devices.gatewayId, gatewayIds));
  }

  return db
    .select({
      deviceId: devices.id,
      deviceIdentifier: devices.deviceIdentifier,
      radioDeviceId: devices.radioDeviceId,
      firmwareVersion: devices.firmwareVersion,
      gatewayId: devices.gatewayId,
      latitude: devices.lastLatitude,
      longitude: devices.lastLongitude,
      batteryLevel: devices.batteryLevel,
      lastSeen: devices.lastSeen,
    })
    .from(devices)
    .where(and(...conditions))
    .orderBy(devices.deviceIdentifier);
}
