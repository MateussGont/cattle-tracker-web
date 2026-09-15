import type { FastifyInstance } from "fastify";
import { authenticate } from "../middlewares/authenticate.js";
import { provisioningProofSchema, startProvisioningSchema } from "../schemas/provisioning.js";
import {
  confirmProvisioning,
  getProvisioningSession,
  markProvisioningConfigured,
  startProvisioning,
} from "../services/provisioningService.js";

export async function provisioningRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", async (request, reply) => {
    if (request.user.role !== "admin") {
      return reply.code(403).send({ error: "forbidden", message: "Apenas administradores podem provisionar dispositivos." });
    }
  });

  app.post("/api/provisioning/sessions", async (request, reply) => {
    const session = await startProvisioning(startProvisioningSchema.parse(request.body), request.user.sub);
    return reply.code(201).send(session);
  });

  app.get("/api/provisioning/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await getProvisioningSession(id);
    return session ? session : reply.code(404).send({ error: "session_not_found" });
  });

  app.post("/api/provisioning/sessions/:id/configured", async (request) => {
    const { id } = request.params as { id: string };
    return markProvisioningConfigured(id, provisioningProofSchema.parse(request.body));
  });

  app.post("/api/provisioning/sessions/:id/confirm", async (request) => {
    const { id } = request.params as { id: string };
    return confirmProvisioning(id, provisioningProofSchema.parse(request.body), request.user.sub);
  });
}
