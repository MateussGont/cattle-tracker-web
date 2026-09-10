import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { alerts } from "../db/schema.js";

export type AlertType =
  | "geofence_exit"
  | "device_offline"
  | "low_battery"
  | "gps_stale"
  | "no_communication"
  | "gateway_offline"
  | "other";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface CreateAlertInput {
  type: AlertType;
  severity: AlertSeverity;
  animalId?: string | null;
  deviceId?: string | null;
  gatewayId?: string | null;
  propertyId?: string | null;
  ruleId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AlertMatchKey {
  type: AlertType;
  deviceId?: string | null;
  animalId?: string | null;
  gatewayId?: string | null;
  ruleId?: string | null;
}

/**
 * Finds an already-open alert matching the given key, so callers can avoid
 * spamming a new row every evaluation cycle while the underlying condition
 * (e.g. low battery) persists. When ruleId is present it is the most
 * precise match (needed for property-wide rules with no deviceId/gatewayId
 * of their own); otherwise falls back to type + entity id, as used by the
 * hardcoded geofence check which has no rule behind it.
 */
export async function findOpenAlert(key: AlertMatchKey) {
  const conditions = [eq(alerts.type, key.type), eq(alerts.status, "open")];
  if (key.deviceId) conditions.push(eq(alerts.deviceId, key.deviceId));
  if (key.animalId) conditions.push(eq(alerts.animalId, key.animalId));
  if (key.gatewayId) conditions.push(eq(alerts.gatewayId, key.gatewayId));
  if (key.ruleId) conditions.push(eq(alerts.ruleId, key.ruleId));

  const [alert] = await db.select().from(alerts).where(and(...conditions)).limit(1);
  return alert ?? null;
}

export async function createAlert(input: CreateAlertInput) {
  const [alert] = await db
    .insert(alerts)
    .values({
      type: input.type,
      severity: input.severity,
      animalId: input.animalId ?? null,
      deviceId: input.deviceId ?? null,
      gatewayId: input.gatewayId ?? null,
      propertyId: input.propertyId ?? null,
      ruleId: input.ruleId ?? null,
      message: input.message,
      metadata: input.metadata ?? null,
    })
    .returning();
  return alert;
}

export async function resolveOpenAlerts(key: AlertMatchKey) {
  const conditions = [eq(alerts.type, key.type), eq(alerts.status, "open")];
  if (key.deviceId) conditions.push(eq(alerts.deviceId, key.deviceId));
  if (key.animalId) conditions.push(eq(alerts.animalId, key.animalId));
  if (key.gatewayId) conditions.push(eq(alerts.gatewayId, key.gatewayId));
  if (key.ruleId) conditions.push(eq(alerts.ruleId, key.ruleId));

  await db
    .update(alerts)
    .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
    .where(and(...conditions));
}

export interface ListAlertsFilter {
  propertyIds?: string[];
  propertyId?: string;
  status?: AlertStatus;
  limit: number;
  offset: number;
}

export async function listAlerts(filter: ListAlertsFilter) {
  if (filter.propertyIds !== undefined && filter.propertyIds.length === 0) {
    return [];
  }
  const conditions = [];
  if (filter.propertyId) {
    conditions.push(eq(alerts.propertyId, filter.propertyId));
  }
  if (filter.propertyIds !== undefined) {
    conditions.push(inArray(alerts.propertyId, filter.propertyIds));
  }
  if (filter.status) {
    conditions.push(eq(alerts.status, filter.status));
  }

  return db
    .select()
    .from(alerts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(alerts.triggeredAt))
    .limit(filter.limit)
    .offset(filter.offset);
}

export async function updateAlertStatus(id: string, status: AlertStatus) {
  const [alert] = await db
    .update(alerts)
    .set({
      status,
      resolvedAt: status === "resolved" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(alerts.id, id))
    .returning();
  return alert ?? null;
}

export async function findAlertById(id: string) {
  const [alert] = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
  return alert ?? null;
}
