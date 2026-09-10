import { z } from "zod";

export const createDeviceSchema = z.object({
  deviceIdentifier: z.string().min(1).max(64),
  radioDeviceId: z.number().int().min(0).max(65535),
  hardwareModel: z.string().max(120).optional(),
  gatewayId: z.string().uuid().optional(),
});

export const updateDeviceSchema = z.object({
  status: z.enum(["active", "inactive", "maintenance"]).optional(),
  hardwareModel: z.string().max(120).optional(),
});

export const assignDeviceSchema = z.object({
  deviceId: z.string().uuid(),
});

export const listDevicesQuerySchema = z.object({
  status: z.enum(["active", "inactive", "maintenance"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
