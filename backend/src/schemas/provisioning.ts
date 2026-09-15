import { z } from "zod";

export const hardwareUidSchema = z.string().trim().regex(/^[0-9a-fA-F]{12}$/).transform((value) => value.toUpperCase());

export const startProvisioningSchema = z.object({
  idempotencyKey: z.string().uuid(),
  hardwareUid: hardwareUidSchema,
  firmwareVersion: z.string().trim().min(1).max(64),
  deviceIdentifier: z.string().trim().min(1).max(100),
  hardwareModel: z.string().trim().min(1).max(100).optional(),
  gatewayId: z.string().uuid().optional(),
});

export const provisioningProofSchema = z.object({
  hardwareUid: hardwareUidSchema,
  radioDeviceId: z.number().int().min(1).max(65535),
  configRevision: z.number().int().positive(),
  firmwareVersion: z.string().trim().min(1).max(64),
});

export type StartProvisioningInput = z.infer<typeof startProvisioningSchema>;
export type ProvisioningProof = z.infer<typeof provisioningProofSchema>;
