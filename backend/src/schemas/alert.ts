import { z } from "zod";

export const updateAlertSchema = z.object({
  status: z.enum(["open", "acknowledged", "resolved"]),
});

export const listAlertsQuerySchema = z.object({
  propertyId: z.string().uuid().optional(),
  status: z.enum(["open", "acknowledged", "resolved"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
