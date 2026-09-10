import type { FastifyInstance } from "fastify";
import { listSettings } from "../repositories/settingsRepository.js";
import { authenticate } from "../middlewares/authenticate.js";

/**
 * Exposes the configurable thresholds (ONLINE/ATENÇÃO/OFFLINE, bateria
 * baixa) so the frontend never hardcodes them (spec section 8).
 */
export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/settings", async () => listSettings());
}
