import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";

/**
 * Shared-secret check for the HTTP telemetry fallback (gateways are
 * devices, not users, so JWT/user auth does not apply here). MQTT
 * ingestion is authenticated separately via broker username/password.
 */
export async function authenticateGateway(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const provided = request.headers["x-gateway-key"];
  const expected = env.GATEWAY_API_KEY;

  if (typeof provided !== "string" || provided.length !== expected.length) {
    await reply.code(401).send({ error: "unauthorized", message: "Chave de gateway ausente ou inválida." });
    return;
  }

  const matches = timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!matches) {
    await reply.code(401).send({ error: "unauthorized", message: "Chave de gateway ausente ou inválida." });
  }
}
