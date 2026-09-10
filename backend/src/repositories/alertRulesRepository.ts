import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { alertRules } from "../db/schema.js";

export type AlertRuleMetric =
  | "battery_level"
  | "device_offline_minutes"
  | "gps_stale_minutes"
  | "gateway_offline_minutes";

export async function listAlertRulesByProperty(propertyId: string) {
  return db
    .select()
    .from(alertRules)
    .where(eq(alertRules.propertyId, propertyId))
    .orderBy(alertRules.metric, alertRules.thresholdValue);
}

export async function findAlertRuleById(propertyId: string, ruleId: string) {
  const [rule] = await db
    .select()
    .from(alertRules)
    .where(and(eq(alertRules.id, ruleId), eq(alertRules.propertyId, propertyId)))
    .limit(1);
  return rule ?? null;
}

export interface CreateAlertRuleInput {
  propertyId: string;
  deviceId?: string | null;
  gatewayId?: string | null;
  metric: AlertRuleMetric;
  thresholdValue: number;
  severity: "info" | "warning" | "critical";
  name: string;
  enabled?: boolean;
}

export async function createAlertRule(input: CreateAlertRuleInput) {
  const [rule] = await db
    .insert(alertRules)
    .values({
      propertyId: input.propertyId,
      deviceId: input.deviceId ?? null,
      gatewayId: input.gatewayId ?? null,
      metric: input.metric,
      thresholdValue: input.thresholdValue,
      severity: input.severity,
      name: input.name,
      enabled: input.enabled ?? true,
    })
    .returning();
  return rule;
}

export interface UpdateAlertRuleInput {
  deviceId?: string | null;
  gatewayId?: string | null;
  metric?: AlertRuleMetric;
  thresholdValue?: number;
  severity?: "info" | "warning" | "critical";
  name?: string;
  enabled?: boolean;
}

export async function updateAlertRule(propertyId: string, ruleId: string, patch: UpdateAlertRuleInput) {
  const [rule] = await db
    .update(alertRules)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(alertRules.id, ruleId), eq(alertRules.propertyId, propertyId)))
    .returning();
  return rule ?? null;
}

export async function deleteAlertRule(propertyId: string, ruleId: string): Promise<boolean> {
  const deleted = await db
    .delete(alertRules)
    .where(and(eq(alertRules.id, ruleId), eq(alertRules.propertyId, propertyId)))
    .returning({ id: alertRules.id });
  return deleted.length > 0;
}

export async function listApplicableDeviceRules(propertyId: string, metric: AlertRuleMetric, deviceId: string) {
  return db
    .select()
    .from(alertRules)
    .where(
      and(
        eq(alertRules.enabled, true),
        eq(alertRules.metric, metric),
        eq(alertRules.propertyId, propertyId),
        or(isNull(alertRules.deviceId), eq(alertRules.deviceId, deviceId)),
      ),
    );
}

export async function listApplicableGatewayRules(propertyId: string, gatewayId: string) {
  return db
    .select()
    .from(alertRules)
    .where(
      and(
        eq(alertRules.enabled, true),
        eq(alertRules.metric, "gateway_offline_minutes"),
        eq(alertRules.propertyId, propertyId),
        or(isNull(alertRules.gatewayId), eq(alertRules.gatewayId, gatewayId)),
      ),
    );
}

export interface DeviceMetricSnapshot {
  deviceId: string;
  animalId: string | null;
  propertyId: string | null;
  lastSeen: Date | null;
  lastGpsFixAt: Date | null;
}

/**
 * One row per device with the property context needed to evaluate
 * time-based rules (device_offline_minutes, gps_stale_minutes). A device's
 * property is derived from its currently-assigned animal, same as the rest
 * of the app (devices have no propertyId of their own) — a device with no
 * current assignment has no property context and is skipped by the
 * scheduler.
 */
export async function listDeviceMetricSnapshots(): Promise<DeviceMetricSnapshot[]> {
  const result = await db.execute<{
    device_id: string;
    animal_id: string | null;
    property_id: string | null;
    last_seen: Date | null;
    last_gps_fix_at: Date | null;
  }>(sql`
    SELECT d.id AS device_id, a.id AS animal_id, a.property_id, d.last_seen, d.last_gps_fix_at
    FROM devices d
    LEFT JOIN device_assignments da ON da.device_id = d.id AND da.unassigned_at IS NULL
    LEFT JOIN animals a ON a.id = da.animal_id
  `);

  return result.rows.map((row) => ({
    deviceId: row.device_id,
    animalId: row.animal_id,
    propertyId: row.property_id,
    lastSeen: row.last_seen ? new Date(row.last_seen) : null,
    lastGpsFixAt: row.last_gps_fix_at ? new Date(row.last_gps_fix_at) : null,
  }));
}

export interface GatewayMetricSnapshot {
  gatewayId: string;
  propertyId: string;
  lastSeen: Date | null;
}

export async function listGatewayMetricSnapshots(): Promise<GatewayMetricSnapshot[]> {
  const result = await db.execute<{
    id: string;
    property_id: string;
    last_seen: Date | null;
  }>(sql`
    SELECT id, property_id, last_seen FROM gateways WHERE property_id IS NOT NULL
  `);

  return result.rows.map((row) => ({
    gatewayId: row.id,
    propertyId: row.property_id,
    lastSeen: row.last_seen ? new Date(row.last_seen) : null,
  }));
}
