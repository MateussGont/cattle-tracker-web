import type { FastifyInstance } from "fastify";
import { createGatewaySchema } from "../schemas/gateway.js";
import { createGateway, listGateways } from "../repositories/gatewaysRepository.js";
import { accessiblePropertyIds, authenticate } from "../middlewares/authenticate.js";

export async function gatewayRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/gateways", async (request) => {
    const propertyIds = await accessiblePropertyIds(request);
    return listGateways(propertyIds);
  });

  app.post("/api/gateways", async (request, reply) => {
    if (request.user.role !== "admin") {
      return reply.code(403).send({ error: "forbidden" });
    }
    const body = createGatewaySchema.parse(request.body);
    const gateway = await createGateway(body);
    return reply.code(201).send(gateway);
  });
}
