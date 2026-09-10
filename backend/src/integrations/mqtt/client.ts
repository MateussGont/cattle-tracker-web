import mqtt, { type MqttClient } from "mqtt";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

/**
 * Thin wrapper around the MQTT connection. Kept isolated in
 * integrations/mqtt so the gateway/broker/protocol can be swapped later
 * (e.g. a LoRaWAN network server webhook, or a different broker) without
 * touching telemetryService or the routes that consume its results.
 */
export function createMqttClient(): MqttClient {
  const client = mqtt.connect(env.MQTT_URL, {
    username: env.MQTT_USERNAME,
    password: env.MQTT_PASSWORD,
    reconnectPeriod: 5000,
    clientId: `cattle-tracker-backend-${Math.random().toString(16).slice(2)}`,
  });

  client.on("connect", () => logger.info({ url: env.MQTT_URL }, "mqtt connected"));
  client.on("reconnect", () => logger.warn("mqtt reconnecting"));
  client.on("error", (error) => logger.error({ err: error }, "mqtt error"));
  client.on("close", () => logger.warn("mqtt connection closed"));

  return client;
}
