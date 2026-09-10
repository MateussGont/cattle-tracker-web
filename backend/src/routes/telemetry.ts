import type { FastifyInstance } from "fastify";
import { authenticateGateway } from "../middlewares/authenticateGateway.js";
import { telemetrySchema } from "../schemas/telemetry.js";
import { ingestTelemetry } from "../services/telemetryService.js";
import { broadcast } from "../websocket/realtime.js";

/**
 * HTTP fallback for gateways that cannot speak MQTT. The MQTT path
 * (integrations/mqtt/telemetrySubscriber.ts) is the primary ingestion
 * route; this shares the same service so both paths apply identical
 * validation and business rules.
 */
export async function telemetryRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/telemetry", { preHandler: authenticateGateway }, async (request, reply) => {
    const body = telemetrySchema.parse(request.body);
    const result = await ingestTelemetry(body);
    broadcast({
      type: "location_update",
      propertyId: result.propertyId,
      payload: { ...result, gatewayId: body.gatewayId },
    });
    return reply.code(201).send(result);
  });
}
