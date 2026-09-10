import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDb } from "./db/client.js";
import { createMqttClient } from "./integrations/mqtt/client.js";
import { subscribeTelemetry } from "./integrations/mqtt/telemetrySubscriber.js";
import { startAlertRuleScheduler } from "./services/alertRuleScheduler.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const app = await buildApp();
  const mqttClient = createMqttClient();
  subscribeTelemetry(mqttClient);
  const stopAlertRuleScheduler = startAlertRuleScheduler();

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info({ port: env.PORT }, "backend listening");

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "shutting down");
    stopAlertRuleScheduler();
    mqttClient.end();
    await app.close();
    await closeDb();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.error({ err: error }, "failed to start backend");
  process.exit(1);
});
