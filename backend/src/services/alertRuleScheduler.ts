import {
  listDeviceMetricSnapshots,
  listGatewayMetricSnapshots,
} from "../repositories/alertRulesRepository.js";
import { logger } from "../utils/logger.js";
import { evaluateDeviceMetric, evaluateGatewayMetric } from "./alertRuleEvaluator.js";

const DEFAULT_INTERVAL_MS = 5 * 60_000;

function minutesSince(timestamp: Date, now: Date): number {
  return (now.getTime() - timestamp.getTime()) / 60_000;
}

/**
 * Time-based metrics (device offline, GPS stale, gateway offline) can't be
 * detected from a telemetry event — the condition is the *absence* of an
 * event over time, so nothing else in the app re-evaluates them. This is
 * the only periodic job in the backend.
 */
export async function evaluateTimeBasedRules(): Promise<void> {
  const now = new Date();

  const deviceSnapshots = await listDeviceMetricSnapshots();
  for (const snapshot of deviceSnapshots) {
    if (!snapshot.propertyId) continue;

    if (snapshot.lastSeen) {
      await evaluateDeviceMetric(
        snapshot.propertyId,
        snapshot.deviceId,
        snapshot.animalId,
        "device_offline_minutes",
        minutesSince(snapshot.lastSeen, now),
      );
    }

    if (snapshot.lastGpsFixAt) {
      await evaluateDeviceMetric(
        snapshot.propertyId,
        snapshot.deviceId,
        snapshot.animalId,
        "gps_stale_minutes",
        minutesSince(snapshot.lastGpsFixAt, now),
      );
    }
  }

  const gatewaySnapshots = await listGatewayMetricSnapshots();
  for (const snapshot of gatewaySnapshots) {
    if (!snapshot.lastSeen) continue;
    await evaluateGatewayMetric(snapshot.propertyId, snapshot.gatewayId, minutesSince(snapshot.lastSeen, now));
  }
}

export function startAlertRuleScheduler(intervalMs: number = DEFAULT_INTERVAL_MS): () => void {
  const timer = setInterval(() => {
    evaluateTimeBasedRules().catch((error) => {
      logger.error({ err: error }, "alert rule scheduler tick failed");
    });
  }, intervalMs);

  return () => clearInterval(timer);
}
