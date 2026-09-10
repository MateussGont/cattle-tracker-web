import type { AlertRuleMetric } from "../repositories/alertRulesRepository.js";
import { listApplicableDeviceRules, listApplicableGatewayRules } from "../repositories/alertRulesRepository.js";
import type { AlertType } from "../repositories/alertsRepository.js";
import { clearAlert, raiseAlertOnce } from "./alertService.js";

const METRIC_ALERT_TYPE: Record<AlertRuleMetric, AlertType> = {
  battery_level: "low_battery",
  device_offline_minutes: "device_offline",
  gps_stale_minutes: "gps_stale",
  gateway_offline_minutes: "gateway_offline",
};

const METRIC_UNIT: Record<AlertRuleMetric, string> = {
  battery_level: "%",
  device_offline_minutes: "min",
  gps_stale_minutes: "min",
  gateway_offline_minutes: "min",
};

/**
 * Every metric has a fixed trigger direction: battery is bad when it drops
 * below the threshold, every time-based metric is bad when it climbs above
 * the threshold. This keeps the rule form simple (no operator picker) while
 * still letting a farm owner stack multiple rules on the same metric with
 * different thresholds/severities (e.g. warning at 20% battery, critical at
 * 10%).
 */
function isTriggered(metric: AlertRuleMetric, currentValue: number, thresholdValue: number): boolean {
  return metric === "battery_level" ? currentValue < thresholdValue : currentValue > thresholdValue;
}

function formatValue(value: number, unit: string): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${unit}`;
}

export async function evaluateDeviceMetric(
  propertyId: string,
  deviceId: string,
  animalId: string | null,
  metric: AlertRuleMetric,
  currentValue: number | null,
): Promise<void> {
  const rules = await listApplicableDeviceRules(propertyId, metric, deviceId);
  const type = METRIC_ALERT_TYPE[metric];
  const unit = METRIC_UNIT[metric];

  for (const rule of rules) {
    const triggered = currentValue !== null && isTriggered(metric, currentValue, rule.thresholdValue);
    if (triggered) {
      await raiseAlertOnce({
        type,
        severity: rule.severity,
        deviceId,
        animalId,
        propertyId,
        ruleId: rule.id,
        message: `${rule.name}: ${formatValue(currentValue as number, unit)} (limite: ${formatValue(rule.thresholdValue, unit)}).`,
        metadata: { value: currentValue, thresholdValue: rule.thresholdValue },
      });
    } else {
      await clearAlert({ type, deviceId, ruleId: rule.id });
    }
  }
}

export async function evaluateGatewayMetric(
  propertyId: string,
  gatewayId: string,
  currentValue: number | null,
): Promise<void> {
  const rules = await listApplicableGatewayRules(propertyId, gatewayId);

  for (const rule of rules) {
    const triggered = currentValue !== null && isTriggered("gateway_offline_minutes", currentValue, rule.thresholdValue);
    if (triggered) {
      await raiseAlertOnce({
        type: "gateway_offline",
        severity: rule.severity,
        gatewayId,
        propertyId,
        ruleId: rule.id,
        message: `${rule.name}: ${formatValue(currentValue as number, "min")} sem comunicação (limite: ${formatValue(rule.thresholdValue, "min")}).`,
        metadata: { value: currentValue, thresholdValue: rule.thresholdValue },
      });
    } else {
      await clearAlert({ type: "gateway_offline", gatewayId, ruleId: rule.id });
    }
  }
}
