import { relations, sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * PostGIS geometry/geography columns are not modeled natively by drizzle-orm,
 * so we expose thin custom types backed by raw SQL. Values are read/written
 * as GeoJSON via ST_AsGeoJSON / ST_GeomFromGeoJSON at the query layer
 * (see src/repositories/geo.ts), never as plain lat/lng pairs, so every
 * geometry column stays queryable with PostGIS spatial functions.
 */
const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography(Point,4326)";
  },
});

const geometryPolygon = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry(Polygon,4326)";
  },
});

export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "viewer"]);
export const userStatusEnum = pgEnum("user_status", ["active", "inactive"]);
export const animalSexEnum = pgEnum("animal_sex", ["male", "female"]);
export const animalStatusEnum = pgEnum("animal_status", [
  "active",
  "sold",
  "deceased",
  "inactive",
]);
export const deviceStatusEnum = pgEnum("device_status", [
  "active",
  "inactive",
  "maintenance",
]);
export const alertTypeEnum = pgEnum("alert_type", [
  "geofence_exit",
  "device_offline",
  "low_battery",
  "gps_stale",
  "no_communication",
  "gateway_offline",
  "other",
]);
export const alertSeverityEnum = pgEnum("alert_severity", [
  "info",
  "warning",
  "critical",
]);
export const alertStatusEnum = pgEnum("alert_status", [
  "open",
  "acknowledged",
  "resolved",
]);
export const alertRuleMetricEnum = pgEnum("alert_rule_metric", [
  "battery_level",
  "device_offline_minutes",
  "gps_stale_minutes",
  "gateway_offline_minutes",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("viewer"),
  status: userStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailUnique: uniqueIndex("users_email_unique").on(table.email),
}));

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  location: geographyPoint("location"),
  boundary: geometryPolygon("boundary"),
  areaHectares: real("area_hectares"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  boundaryGistIdx: index("properties_boundary_gist_idx").using("gist", table.boundary),
}));

export const userProperties = pgTable("user_properties", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  roleOnProperty: userRoleEnum("role_on_property").notNull().default("viewer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: uniqueIndex("user_properties_pk").on(table.userId, table.propertyId),
  propertyIdx: index("user_properties_property_idx").on(table.propertyId),
}));

export const animals = pgTable("animals", {
  id: uuid("id").primaryKey().defaultRandom(),
  tagCode: text("tag_code").notNull(),
  name: text("name"),
  sex: animalSexEnum("sex"),
  breed: text("breed"),
  birthDate: timestamp("birth_date", { withTimezone: true, mode: "date" }),
  status: animalStatusEnum("status").notNull().default("active"),
  propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tagCodeUnique: uniqueIndex("animals_tag_code_unique").on(table.tagCode),
  propertyIdx: index("animals_property_idx").on(table.propertyId),
  statusIdx: index("animals_status_idx").on(table.status),
}));

/**
 * One row per physical receiver (Heltec gateway). gatewayIdentifier matches
 * the GATEWAY_ID compiled into that receiver's firmware/receiver/secrets.h,
 * so telemetry published by a given receiver can be traced back to it.
 * Purely organizational today (a farm with multiple properties may run one
 * receiver per property); it is not itself provisioned through the app —
 * only referenced when provisioning a collar.
 */
export const gateways = pgTable("gateways", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  gatewayIdentifier: text("gateway_identifier").notNull(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  identifierUnique: uniqueIndex("gateways_identifier_unique").on(table.gatewayIdentifier),
  propertyIdx: index("gateways_property_idx").on(table.propertyId),
}));

/**
 * device_identifier (e.g. BRINCO-0001) is the business-facing id. deviceId
 * (uint16) is the compact id carried on the LoRa radio payload to save
 * airtime; the mapping between them is created at provisioning time
 * (POST /api/devices) and telemetry for an unknown radioDeviceId is
 * rejected/alerted rather than silently accepted.
 */
export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceIdentifier: text("device_identifier").notNull(),
  radioDeviceId: integer("radio_device_id").notNull(),
  hardwareModel: text("hardware_model"),
  gatewayId: uuid("gateway_id").references(() => gateways.id, { onDelete: "set null" }),
  status: deviceStatusEnum("status").notNull().default("active"),
  batteryLevel: smallint("battery_level"),
  lastLatitude: real("last_latitude"),
  lastLongitude: real("last_longitude"),
  lastGpsAccuracy: real("last_gps_accuracy"),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  lastGpsFixAt: timestamp("last_gps_fix_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  deviceIdentifierUnique: uniqueIndex("devices_identifier_unique").on(table.deviceIdentifier),
  radioDeviceIdUnique: uniqueIndex("devices_radio_device_id_unique").on(table.radioDeviceId),
  statusIdx: index("devices_status_idx").on(table.status),
  lastSeenIdx: index("devices_last_seen_idx").on(table.lastSeen),
  gatewayIdx: index("devices_gateway_idx").on(table.gatewayId),
}));

/**
 * History of animal<->device association. The *current* assignment is the
 * row with unassignedAt IS NULL (enforced in the service layer, see
 * src/services/deviceAssignmentService.ts) instead of a redundant FK on
 * both animals and devices, so there is a single source of truth and a
 * full audit trail of collar swaps.
 */
export const deviceAssignments = pgTable("device_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  animalId: uuid("animal_id").notNull().references(() => animals.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  unassignedAt: timestamp("unassigned_at", { withTimezone: true }),
}, (table) => ({
  deviceIdx: index("device_assignments_device_idx").on(table.deviceId, table.assignedAt),
  animalIdx: index("device_assignments_animal_idx").on(table.animalId, table.assignedAt),
  currentByDeviceIdx: uniqueIndex("device_assignments_current_by_device")
    .on(table.deviceId)
    .where(sql`unassigned_at IS NULL`),
}));

/**
 * The high-volume telemetry table. recordedAt is the event time reported by
 * the device/GNSS (falls back to ingestion time when GNSS has no fix, see
 * telemetryService); createdAt is ingestion time, kept separately to reason
 * about pipeline latency and out-of-order delivery.
 */
export const locations = pgTable("locations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  animalId: uuid("animal_id").references(() => animals.id, { onDelete: "set null" }),
  position: geographyPoint("position").notNull(),
  gpsAccuracy: real("gps_accuracy"),
  batteryLevel: smallint("battery_level"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  positionGistIdx: index("locations_position_gist_idx").using("gist", table.position),
  deviceRecordedIdx: index("locations_device_recorded_idx").on(table.deviceId, table.recordedAt.desc()),
  animalRecordedIdx: index("locations_animal_recorded_idx").on(table.animalId, table.recordedAt.desc()),
  recordedAtIdx: index("locations_recorded_at_idx").on(table.recordedAt),
}));

export const geofences = pgTable("geofences", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  boundary: geometryPolygon("boundary").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  boundaryGistIdx: index("geofences_boundary_gist_idx").using("gist", table.boundary),
  propertyIdx: index("geofences_property_idx").on(table.propertyId),
}));

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: alertTypeEnum("type").notNull(),
  severity: alertSeverityEnum("severity").notNull().default("warning"),
  animalId: uuid("animal_id").references(() => animals.id, { onDelete: "set null" }),
  deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
  gatewayId: uuid("gateway_id").references(() => gateways.id, { onDelete: "set null" }),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
  ruleId: uuid("rule_id").references(() => alertRules.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  status: alertStatusEnum("status").notNull().default("open"),
  metadata: jsonb("metadata"),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("alerts_status_idx").on(table.status),
  animalIdx: index("alerts_animal_idx").on(table.animalId),
  deviceIdx: index("alerts_device_idx").on(table.deviceId),
  gatewayIdx: index("alerts_gateway_idx").on(table.gatewayId),
  propertyIdx: index("alerts_property_idx").on(table.propertyId),
  ruleIdx: index("alerts_rule_idx").on(table.ruleId),
  triggeredAtIdx: index("alerts_triggered_at_idx").on(table.triggeredAt),
}));

/**
 * User-configurable threshold rules that drive non-spatial alerts (battery,
 * device/gateway communication gaps, GPS staleness). Geofence alerts are
 * spatial and stay driven by the geofences table + ST_Contains, not by this
 * generic engine. deviceId/gatewayId are mutually exclusive depending on
 * metric: device-scoped metrics (battery_level, device_offline_minutes,
 * gps_stale_minutes) use deviceId (null = every device in the property);
 * gateway_offline_minutes uses gatewayId (null = every gateway in the
 * property). Comparison direction is fixed per metric in the evaluator, not
 * stored here (battery_level triggers below threshold, the time-based
 * metrics trigger above threshold).
 */
export const alertRules = pgTable("alert_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
  gatewayId: uuid("gateway_id").references(() => gateways.id, { onDelete: "set null" }),
  metric: alertRuleMetricEnum("metric").notNull(),
  thresholdValue: real("threshold_value").notNull(),
  severity: alertSeverityEnum("severity").notNull().default("warning"),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  propertyIdx: index("alert_rules_property_idx").on(table.propertyId),
  deviceIdx: index("alert_rules_device_idx").on(table.deviceId),
  gatewayIdx: index("alert_rules_gateway_idx").on(table.gatewayId),
  metricIdx: index("alert_rules_metric_idx").on(table.metric),
}));

/**
 * Key/value runtime configuration (online/attention/offline thresholds,
 * low battery %, etc). Read by the backend and exposed via GET /api/settings
 * so the frontend never hardcodes these values (spec section 8).
 */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  properties: many(userProperties),
}));

export const propertiesRelations = relations(properties, ({ many }) => ({
  users: many(userProperties),
  animals: many(animals),
  geofences: many(geofences),
  gateways: many(gateways),
}));

export const gatewaysRelations = relations(gateways, ({ one, many }) => ({
  property: one(properties, { fields: [gateways.propertyId], references: [properties.id] }),
  devices: many(devices),
}));

export const animalsRelations = relations(animals, ({ one, many }) => ({
  property: one(properties, { fields: [animals.propertyId], references: [properties.id] }),
  assignments: many(deviceAssignments),
  locations: many(locations),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  assignments: many(deviceAssignments),
  locations: many(locations),
  gateway: one(gateways, { fields: [devices.gatewayId], references: [gateways.id] }),
}));

export const deviceAssignmentsRelations = relations(deviceAssignments, ({ one }) => ({
  device: one(devices, { fields: [deviceAssignments.deviceId], references: [devices.id] }),
  animal: one(animals, { fields: [deviceAssignments.animalId], references: [animals.id] }),
}));

export const locationsRelations = relations(locations, ({ one }) => ({
  device: one(devices, { fields: [locations.deviceId], references: [devices.id] }),
  animal: one(animals, { fields: [locations.animalId], references: [animals.id] }),
}));
