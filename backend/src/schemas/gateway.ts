import { z } from "zod";

export const createGatewaySchema = z.object({
  name: z.string().min(1).max(160),
  gatewayIdentifier: z.string().min(1).max(64),
  propertyId: z.string().uuid().optional(),
});
