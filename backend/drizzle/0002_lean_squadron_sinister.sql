CREATE TYPE "public"."alert_rule_metric" AS ENUM('battery_level', 'device_offline_minutes', 'gps_stale_minutes', 'gateway_offline_minutes');--> statement-breakpoint
ALTER TYPE "public"."alert_type" ADD VALUE 'gateway_offline' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"device_id" uuid,
	"gateway_id" uuid,
	"metric" "alert_rule_metric" NOT NULL,
	"threshold_value" real NOT NULL,
	"severity" "alert_severity" DEFAULT 'warning' NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "gateway_id" uuid;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "rule_id" uuid;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "last_gps_fix_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gateways" ADD COLUMN "last_seen" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_gateway_id_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."gateways"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_rules_property_idx" ON "alert_rules" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "alert_rules_device_idx" ON "alert_rules" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "alert_rules_gateway_idx" ON "alert_rules" USING btree ("gateway_id");--> statement-breakpoint
CREATE INDEX "alert_rules_metric_idx" ON "alert_rules" USING btree ("metric");--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_gateway_id_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."gateways"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_gateway_idx" ON "alerts" USING btree ("gateway_id");--> statement-breakpoint
CREATE INDEX "alerts_rule_idx" ON "alerts" USING btree ("rule_id");--> statement-breakpoint
-- Backfill: every existing property gets the 4 basic alert rules so nobody
-- loses the low-battery coverage they already had via the old global
-- settings-based check, and gains the 3 previously-dead alert types.
INSERT INTO "alert_rules" ("property_id", "metric", "threshold_value", "severity", "name")
SELECT "id", 'battery_level', 20, 'warning', 'Bateria baixa' FROM "properties";--> statement-breakpoint
INSERT INTO "alert_rules" ("property_id", "metric", "threshold_value", "severity", "name")
SELECT "id", 'device_offline_minutes', 60, 'warning', 'Dispositivo sem comunicação' FROM "properties";--> statement-breakpoint
INSERT INTO "alert_rules" ("property_id", "metric", "threshold_value", "severity", "name")
SELECT "id", 'gps_stale_minutes', 60, 'warning', 'GPS desatualizado' FROM "properties";--> statement-breakpoint
INSERT INTO "alert_rules" ("property_id", "metric", "threshold_value", "severity", "name")
SELECT "id", 'gateway_offline_minutes', 60, 'warning', 'Gateway sem comunicação' FROM "properties";