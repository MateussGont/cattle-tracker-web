import { db } from "../db/client.js";
import { settings } from "../db/schema.js";

export async function listSettings() {
  return db.select().from(settings);
}

export interface StatusThresholds {
  attentionMinutes: number;
  offlineMinutes: number;
  lowBatteryPercent: number;
}

const DEFAULTS: StatusThresholds = {
  attentionMinutes: 20,
  offlineMinutes: 60,
  lowBatteryPercent: 20,
};

export async function getStatusThresholds(): Promise<StatusThresholds> {
  const rows = await listSettings();
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  return {
    attentionMinutes: Number(byKey.get("device_attention_minutes") ?? DEFAULTS.attentionMinutes),
    offlineMinutes: Number(byKey.get("device_offline_minutes") ?? DEFAULTS.offlineMinutes),
    lowBatteryPercent: Number(byKey.get("device_low_battery_percent") ?? DEFAULTS.lowBatteryPercent),
  };
}
