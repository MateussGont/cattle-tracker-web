import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  MQTT_URL: z.string().min(1, "MQTT_URL is required"),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_TELEMETRY_TOPIC: z.string().default("cattle-tracker/telemetry"),
  GATEWAY_API_KEY: z.string().min(16, "GATEWAY_API_KEY must be at least 16 characters"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DEVICE_OFFLINE_MINUTES: z.coerce.number().int().positive().default(60),
  DEVICE_ATTENTION_MINUTES: z.coerce.number().int().positive().default(20),
  DEVICE_LOW_BATTERY_PERCENT: z.coerce.number().int().min(0).max(100).default(20),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
