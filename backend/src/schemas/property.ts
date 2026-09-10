import { z } from "zod";

const positionSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const polygonSchema = z
  .array(positionSchema)
  .min(4, "Um polígono precisa de ao menos 4 pontos (o primeiro e o último devem coincidir)");

export const createPropertySchema = z.object({
  name: z.string().min(1).max(160),
  location: positionSchema.optional(),
  boundary: polygonSchema.optional(),
});

export const updatePropertySchema = createPropertySchema.partial();

export const createGeofenceSchema = z.object({
  name: z.string().min(1).max(160),
  boundary: polygonSchema,
  active: z.boolean().default(true),
});
