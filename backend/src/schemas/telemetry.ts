import { z } from "zod";

/**
 * Wire format published by any gateway (MQTT topic
 * `cattle-tracker/<gatewayId>/telemetry`, and mirrored by POST /api/telemetry
 * for gateways that cannot speak MQTT). radioDeviceId is the compact id
 * carried on the LoRa payload (see firmware/common/protocol.h); it is
 * resolved to a business device via devices.radio_device_id before storage.
 */
export const telemetrySchema = z.object({
  gatewayId: z.string().min(1).max(64),
  radioDeviceId: z.number().int().min(0).max(65535),
  sequence: z.number().int().min(0),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  gnssUnixTime: z.number().int().min(0),
  batteryMv: z.number().int().min(0).max(6000),
  flags: z.number().int().min(0).max(255),
  rssi: z.number().optional(),
  snr: z.number().optional(),
});

export type TelemetryInput = z.infer<typeof telemetrySchema>;

export const TELEMETRY_FLAG_GNSS_FIX = 1 << 0;
export const TELEMETRY_FLAG_GNSS_TIME_VALID = 1 << 1;
export const TELEMETRY_FLAG_BATTERY_VALID = 1 << 2;
