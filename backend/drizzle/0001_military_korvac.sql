CREATE TABLE "gateways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"gateway_identifier" text NOT NULL,
	"property_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "gateway_id" uuid;--> statement-breakpoint
ALTER TABLE "gateways" ADD CONSTRAINT "gateways_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gateways_identifier_unique" ON "gateways" USING btree ("gateway_identifier");--> statement-breakpoint
CREATE INDEX "gateways_property_idx" ON "gateways" USING btree ("property_id");--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_gateway_id_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."gateways"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devices_gateway_idx" ON "devices" USING btree ("gateway_id");