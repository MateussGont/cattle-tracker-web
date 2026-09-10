import { z } from "zod";

const alertRuleMetricSchema = z.enum([
  "battery_level",
  "device_offline_minutes",
  "gps_stale_minutes",
  "gateway_offline_minutes",
]);

const alertRuleSeveritySchema = z.enum(["info", "warning", "critical"]);

export const createAlertRuleSchema = z
  .object({
    name: z.string().min(1).max(160),
    metric: alertRuleMetricSchema,
    thresholdValue: z.number().positive(),
    severity: alertRuleSeveritySchema,
    deviceId: z.string().uuid().optional(),
    gatewayId: z.string().uuid().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((data) => data.gatewayId === undefined || data.metric === "gateway_offline_minutes", {
    message: "gatewayId only applies to the gateway_offline_minutes metric",
    path: ["gatewayId"],
  })
  .refine((data) => data.deviceId === undefined || data.metric !== "gateway_offline_minutes", {
    message: "deviceId does not apply to the gateway_offline_minutes metric",
    path: ["deviceId"],
  });

export const updateAlertRuleSchema = z
  .object({
    name: z.string().min(1).max(160).optional(),
    metric: alertRuleMetricSchema.optional(),
    thresholdValue: z.number().positive().optional(),
    severity: alertRuleSeveritySchema.optional(),
    deviceId: z.string().uuid().nullable().optional(),
    gatewayId: z.string().uuid().nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((data) => !data.gatewayId || data.metric === undefined || data.metric === "gateway_offline_minutes", {
    message: "gatewayId only applies to the gateway_offline_minutes metric",
    path: ["gatewayId"],
  })
  .refine((data) => !data.deviceId || data.metric !== "gateway_offline_minutes", {
    message: "deviceId does not apply to the gateway_offline_minutes metric",
    path: ["deviceId"],
  });
