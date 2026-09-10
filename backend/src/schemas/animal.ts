import { z } from "zod";

export const createAnimalSchema = z.object({
  tagCode: z.string().min(1).max(32),
  name: z.string().min(1).max(120).optional(),
  sex: z.enum(["male", "female"]).optional(),
  breed: z.string().max(120).optional(),
  birthDate: z.coerce.date().optional(),
  propertyId: z.string().uuid(),
});

export const updateAnimalSchema = createAnimalSchema.partial().extend({
  status: z.enum(["active", "sold", "deceased", "inactive"]).optional(),
});

export const listAnimalsQuerySchema = z.object({
  propertyId: z.string().uuid().optional(),
  status: z.enum(["active", "sold", "deceased", "inactive"]).optional(),
  search: z.string().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const historyQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(500),
});
