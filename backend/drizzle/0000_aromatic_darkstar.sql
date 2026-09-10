CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('open', 'acknowledged', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('geofence_exit', 'device_offline', 'low_battery', 'gps_stale', 'no_communication', 'other');--> statement-breakpoint
CREATE TYPE "public"."animal_sex" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."animal_status" AS ENUM('active', 'sold', 'deceased', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('active', 'inactive', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "alert_type" NOT NULL,
	"severity" "alert_severity" DEFAULT 'warning' NOT NULL,
	"animal_id" uuid,
	"device_id" uuid,
	"property_id" uuid,
	"message" text NOT NULL,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"metadata" jsonb,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_code" text NOT NULL,
	"name" text,
	"sex" "animal_sex",
	"breed" text,
	"birth_date" timestamp with time zone,
	"status" "animal_status" DEFAULT 'active' NOT NULL,
	"property_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"animal_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unassigned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_identifier" text NOT NULL,
	"radio_device_id" smallint NOT NULL,
	"hardware_model" text,
	"status" "device_status" DEFAULT 'active' NOT NULL,
	"battery_level" smallint,
	"last_latitude" real,
	"last_longitude" real,
	"last_gps_accuracy" real,
	"last_seen" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geofences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"boundary" geometry(Polygon,4326) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"device_id" uuid NOT NULL,
	"animal_id" uuid,
	"position" geography(Point,4326) NOT NULL,
	"gps_accuracy" real,
	"battery_level" smallint,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location" geography(Point,4326),
	"boundary" geometry(Polygon,4326),
	"area_hectares" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_properties" (
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"role_on_property" "user_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_animal_id_animals_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_properties" ADD CONSTRAINT "user_properties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_properties" ADD CONSTRAINT "user_properties_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_status_idx" ON "alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alerts_animal_idx" ON "alerts" USING btree ("animal_id");--> statement-breakpoint
CREATE INDEX "alerts_device_idx" ON "alerts" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "alerts_property_idx" ON "alerts" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "alerts_triggered_at_idx" ON "alerts" USING btree ("triggered_at");--> statement-breakpoint
CREATE UNIQUE INDEX "animals_tag_code_unique" ON "animals" USING btree ("tag_code");--> statement-breakpoint
CREATE INDEX "animals_property_idx" ON "animals" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "animals_status_idx" ON "animals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "device_assignments_device_idx" ON "device_assignments" USING btree ("device_id","assigned_at");--> statement-breakpoint
CREATE INDEX "device_assignments_animal_idx" ON "device_assignments" USING btree ("animal_id","assigned_at");--> statement-breakpoint
CREATE UNIQUE INDEX "device_assignments_current_by_device" ON "device_assignments" USING btree ("device_id") WHERE unassigned_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "devices_identifier_unique" ON "devices" USING btree ("device_identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_radio_device_id_unique" ON "devices" USING btree ("radio_device_id");--> statement-breakpoint
CREATE INDEX "devices_status_idx" ON "devices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "devices_last_seen_idx" ON "devices" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "geofences_boundary_gist_idx" ON "geofences" USING gist ("boundary");--> statement-breakpoint
CREATE INDEX "geofences_property_idx" ON "geofences" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "locations_position_gist_idx" ON "locations" USING gist ("position");--> statement-breakpoint
CREATE INDEX "locations_device_recorded_idx" ON "locations" USING btree ("device_id","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "locations_animal_recorded_idx" ON "locations" USING btree ("animal_id","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "locations_recorded_at_idx" ON "locations" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "properties_boundary_gist_idx" ON "properties" USING gist ("boundary");--> statement-breakpoint
CREATE UNIQUE INDEX "user_properties_pk" ON "user_properties" USING btree ("user_id","property_id");--> statement-breakpoint
CREATE INDEX "user_properties_property_idx" ON "user_properties" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");