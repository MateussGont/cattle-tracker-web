CREATE TYPE "public"."device_provisioning_status" AS ENUM('pending', 'active', 'failed');--> statement-breakpoint
CREATE TYPE "public"."provisioning_session_status" AS ENUM('pending', 'configured', 'confirmed', 'failed');--> statement-breakpoint
CREATE TABLE "provisioning_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"hardware_uid" text NOT NULL,
	"device_id" uuid NOT NULL,
	"radio_device_id" integer NOT NULL,
	"config_revision" integer NOT NULL,
	"firmware_version" text NOT NULL,
	"status" "provisioning_session_status" DEFAULT 'pending' NOT NULL,
	"created_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "hardware_uid" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "firmware_version" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "provisioning_status" "device_provisioning_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "config_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "provisioned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "last_provisioned_by" uuid;--> statement-breakpoint
ALTER TABLE "provisioning_sessions" ADD CONSTRAINT "provisioning_sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provisioning_sessions" ADD CONSTRAINT "provisioning_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provisioning_sessions_idempotency_key_unique" ON "provisioning_sessions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "provisioning_sessions_hardware_uid_idx" ON "provisioning_sessions" USING btree ("hardware_uid");--> statement-breakpoint
CREATE INDEX "provisioning_sessions_status_expires_idx" ON "provisioning_sessions" USING btree ("status","expires_at");--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_last_provisioned_by_users_id_fk" FOREIGN KEY ("last_provisioned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "devices_hardware_uid_unique" ON "devices" USING btree ("hardware_uid") WHERE hardware_uid IS NOT NULL;