import type { MqttClient } from "mqtt";
import { env } from "../../config/env.js";
import { telemetrySchema } from "../../schemas/telemetry.js";
import { ingestTelemetry, UnknownDeviceError } from "../../services/telemetryService.js";
import { logger } from "../../utils/logger.js";
import { broadcast } from "../../websocket/realtime.js";

export function subscribeTelemetry(client: MqttClient): void {
  client.on("connect", () => {
    client.subscribe(env.MQTT_TELEMETRY_TOPIC, { qos: 1 }, (error) => {
      if (error) {
        logger.error({ err: error, topic: env.MQTT_TELEMETRY_TOPIC }, "failed to subscribe to telemetry topic");
      } else {
        logger.info({ topic: env.MQTT_TELEMETRY_TOPIC }, "subscribed to telemetry topic");
      }
    });
  });

  client.on("message", (topic, payload) => {
    void handleMessage(topic, payload);
  });
}

async function handleMessage(topic: string, payload: Buffer): Promise<void> {
  let json: unknown;
  try {
    json = JSON.parse(payload.toString("utf8"));
  } catch {
    logger.warn({ topic }, "discarding non-JSON telemetry message");
    return;
  }

  const parsed = telemetrySchema.safeParse(json);
  if (!parsed.success) {
    logger.warn({ topic, issues: parsed.error.flatten() }, "discarding invalid telemetry message");
    return;
  }

  try {
    const result = await ingestTelemetry(parsed.data);
    broadcast({
      type: "location_update",
      propertyId: result.propertyId,
      payload: { ...result, gatewayId: parsed.data.gatewayId },
    });
  } catch (error) {
    if (error instanceof UnknownDeviceError) {
      logger.warn({ radioDeviceId: parsed.data.radioDeviceId }, error.message);
      return;
    }
    logger.error({ err: error }, "failed to ingest telemetry from mqtt");
  }
}
