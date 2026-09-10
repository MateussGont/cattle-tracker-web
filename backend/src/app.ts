import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import fastify, { type FastifyInstance } from "fastify";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { alertRoutes } from "./routes/alerts.js";
import { animalRoutes } from "./routes/animals.js";
import { authRoutes } from "./routes/auth.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { deviceRoutes } from "./routes/devices.js";
import { gatewayRoutes } from "./routes/gateways.js";
import { mapRoutes } from "./routes/map.js";
import { propertyRoutes } from "./routes/properties.js";
import { settingsRoutes } from "./routes/settings.js";
import { telemetryRoutes } from "./routes/telemetry.js";
import { registerRealtimeGateway } from "./websocket/realtime.js";

/**
 * Fastify gets its own request-scoped logger via the `logger` option
 * (available on routes/hooks as `request.log` / `app.log`). The standalone
 * pino instance in utils/logger.ts is for background work with no request
 * context (MQTT ingestion, startup/shutdown) — the two are intentionally
 * separate to avoid a pino<->FastifyBaseLogger type mismatch.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger:
      env.NODE_ENV === "production"
        ? { level: "info" }
        : { level: "debug", transport: { target: "pino-pretty" } },
  });

  await app.register(cors, { origin: env.CORS_ORIGIN });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: env.JWT_EXPIRES_IN } });
  await app.register(websocket);

  app.setErrorHandler(errorHandler);

  app.get("/healthz", async () => ({ status: "ok" }));

  await app.register(authRoutes);
  await app.register(telemetryRoutes);
  await app.register(animalRoutes);
  await app.register(deviceRoutes);
  await app.register(gatewayRoutes);
  await app.register(mapRoutes);
  await app.register(propertyRoutes);
  await app.register(alertRoutes);
  await app.register(settingsRoutes);
  await app.register(dashboardRoutes);
  await registerRealtimeGateway(app);

  return app;
}
