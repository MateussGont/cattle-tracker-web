import type { FastifyInstance } from "fastify";
import { listAlertsQuerySchema, updateAlertSchema } from "../schemas/alert.js";
import { findAlertById, listAlerts, updateAlertStatus } from "../repositories/alertsRepository.js";
import {
  accessiblePropertyIds,
  assertPropertyWriteAccess,
  authenticate,
} from "../middlewares/authenticate.js";

export async function alertRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/alerts", async (request) => {
    const query = listAlertsQuerySchema.parse(request.query);
    const propertyIds = await accessiblePropertyIds(request);
    if (query.propertyId && propertyIds !== undefined && !propertyIds.includes(query.propertyId)) {
      return [];
    }
    return listAlerts({ ...query, propertyIds });
  });

  app.put("/api/alerts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateAlertSchema.parse(request.body);
    const existing = await findAlertById(id);
    if (!existing) {
      return reply.code(404).send({ error: "not_found" });
    }
    const canUpdate = existing.propertyId
      ? await assertPropertyWriteAccess(request, existing.propertyId)
      : request.user.role === "admin";
    if (!canUpdate) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const alert = await updateAlertStatus(id, body.status);
    return alert ?? reply.code(404).send({ error: "not_found" });
  });
}
