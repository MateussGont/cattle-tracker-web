import { apiRequest } from "./client";
import type { AlertRule, AlertRuleMetric, AlertSeverity } from "../types";

export function listAlertRules(propertyId: string): Promise<AlertRule[]> {
  return apiRequest<AlertRule[]>(`/api/properties/${propertyId}/alert-rules`);
}

export interface CreateAlertRuleInput {
  name: string;
  metric: AlertRuleMetric;
  thresholdValue: number;
  severity: AlertSeverity;
  deviceId?: string;
  gatewayId?: string;
  enabled?: boolean;
}

export function createAlertRule(propertyId: string, input: CreateAlertRuleInput): Promise<AlertRule> {
  return apiRequest<AlertRule>(`/api/properties/${propertyId}/alert-rules`, { method: "POST", body: input });
}

export type UpdateAlertRuleInput = Partial<CreateAlertRuleInput>;

export function updateAlertRule(
  propertyId: string,
  ruleId: string,
  input: UpdateAlertRuleInput,
): Promise<AlertRule> {
  return apiRequest<AlertRule>(`/api/properties/${propertyId}/alert-rules/${ruleId}`, {
    method: "PUT",
    body: input,
  });
}

export function deleteAlertRule(propertyId: string, ruleId: string): Promise<void> {
  return apiRequest<void>(`/api/properties/${propertyId}/alert-rules/${ruleId}`, { method: "DELETE" });
}
