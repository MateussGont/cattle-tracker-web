import type { StatusThresholds } from "../repositories/settingsRepository.js";

export type CommunicationStatus = "online" | "attention" | "offline" | "never_seen";

/**
 * Pure function: derives ONLINE/ATENÇÃO/OFFLINE from the last time a device
 * communicated. Thresholds always come from the settings table (never
 * hardcoded in the frontend, per spec section 8).
 */
export function computeCommunicationStatus(
  lastSeen: Date | null,
  thresholds: StatusThresholds,
  now: Date = new Date(),
): CommunicationStatus {
  if (!lastSeen) {
    return "never_seen";
  }

  const minutesSinceLastSeen = (now.getTime() - lastSeen.getTime()) / 60_000;

  if (minutesSinceLastSeen <= thresholds.attentionMinutes) {
    return "online";
  }
  if (minutesSinceLastSeen <= thresholds.offlineMinutes) {
    return "attention";
  }
  return "offline";
}

export function isLowBattery(batteryPercent: number | null, thresholds: StatusThresholds): boolean {
  return batteryPercent !== null && batteryPercent <= thresholds.lowBatteryPercent;
}
