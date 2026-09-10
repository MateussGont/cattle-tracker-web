import type { FastifyInstance } from "fastify";
import { createAlertRuleSchema, updateAlertRuleSchema } from "../schemas/alertRule.js";
import { createGeofenceSchema, createPropertySchema } from "../schemas/property.js";
import {
  createProperty,
  findPropertyById,
  listProperties,
} from "../repositories/propertiesRepository.js";
import { createGeofence, deleteGeofence, listGeofencesByProperty } from "../repositories/geofencesRepository.js";
import {
  createAlertRule,
  deleteAlertRule,
  listAlertRulesByProperty,
  updateAlertRule,
} from "../repositories/alertRulesRepository.js";
import {
  accessiblePropertyIds,
  assertPropertyAccess,
  assertPropertyWriteAccess,
  authenticate,
} from "../middlewares/authenticate.js";

export async function propertyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/properties", async (request) => {
    const propertyIds = await accessiblePropertyIds(request);
    return listProperties(propertyIds);
  });

  app.post("/api/properties", async (request, reply) => {
    if (request.user.role !== "admin") {
      return reply.code(403).send({ error: "forbidden" });
    }
    const body = createPropertySchema.parse(request.body);
    const property = await createProperty(body);
    return reply.code(201).send(property);
  });

  app.get("/api/properties/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await assertPropertyAccess(request, id))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const property = await findPropertyById(id);
    return property ?? reply.code(404).send({ error: "not_found" });
  });

  app.get("/api/properties/:id/geofences", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await assertPropertyAccess(request, id))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    return listGeofencesByProperty(id);
  });

  app.post("/api/properties/:id/geofences", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await assertPropertyWriteAccess(request, id))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const body = createGeofenceSchema.parse(request.body);
    const geofence = await createGeofence({ ...body, propertyId: id });
    return reply.code(201).send(geofence);
  });

  app.delete("/api/properties/:id/geofences/:geofenceId", async (request, reply) => {
    const { id, geofenceId } = request.params as { id: string; geofenceId: string };
    if (!(await assertPropertyWriteAccess(request, id))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const deleted = await deleteGeofence(id, geofenceId);
    if (!deleted) return reply.code(404).send({ error: "not_found" });
    return reply.code(204).send();
  });

  app.get("/api/properties/:id/alert-rules", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await assertPropertyAccess(request, id))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    return listAlertRulesByProperty(id);
  });

  app.post("/api/properties/:id/alert-rules", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await assertPropertyWriteAccess(request, id))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const body = createAlertRuleSchema.parse(request.body);
    const rule = await createAlertRule({ ...body, propertyId: id });
    return reply.code(201).send(rule);
  });

  app.put("/api/properties/:id/alert-rules/:ruleId", async (request, reply) => {
    const { id, ruleId } = request.params as { id: string; ruleId: string };
    if (!(await assertPropertyWriteAccess(request, id))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const body = updateAlertRuleSchema.parse(request.body);
    const rule = await updateAlertRule(id, ruleId, body);
    if (!rule) return reply.code(404).send({ error: "not_found" });
    return rule;
  });

  app.delete("/api/properties/:id/alert-rules/:ruleId", async (request, reply) => {
    const { id, ruleId } = request.params as { id: string; ruleId: string };
    if (!(await assertPropertyWriteAccess(request, id))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const deleted = await deleteAlertRule(id, ruleId);
    if (!deleted) return reply.code(404).send({ error: "not_found" });
    return reply.code(204).send();
  });
}
