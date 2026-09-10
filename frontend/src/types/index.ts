export interface GeoJsonPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: [number, number][][];
}

export type UserRole = "admin" | "manager" | "viewer";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type CommunicationStatus = "online" | "attention" | "offline" | "never_seen";

export type AnimalStatus = "active" | "sold" | "deceased" | "inactive";
export type AnimalSex = "male" | "female";

export interface Animal {
  id: string;
  tagCode: string;
  name: string | null;
  sex: AnimalSex | null;
  breed: string | null;
  birthDate: string | null;
  status: AnimalStatus;
  propertyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Gateway {
  id: string;
  name: string;
  gatewayIdentifier: string;
  propertyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DeviceStatus = "active" | "inactive" | "maintenance";

export interface Device {
  id: string;
  deviceIdentifier: string;
  radioDeviceId: number;
  hardwareModel: string | null;
  gatewayId: string | null;
  status: DeviceStatus;
  batteryLevel: number | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastGpsAccuracy: number | null;
  lastSeen: string | null;
  communicationStatus?: CommunicationStatus;
  animal?: { id: string; tagCode: string; name: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  id: string;
  name: string;
  areaHectares: number | null;
  location: GeoJsonPoint | null;
  boundary: GeoJsonPolygon | null;
  createdAt: string;
  updatedAt: string;
}

export interface Geofence {
  id: string;
  propertyId: string;
  name: string;
  active: boolean;
  boundary: GeoJSON.Polygon;
  createdAt: string;
  updatedAt: string;
}

export type AlertType =
  | "geofence_exit"
  | "device_offline"
  | "low_battery"
  | "gps_stale"
  | "no_communication"
  | "gateway_offline"
  | "other";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  animalId: string | null;
  deviceId: string | null;
  gatewayId: string | null;
  propertyId: string | null;
  ruleId: string | null;
  message: string;
  status: AlertStatus;
  metadata: Record<string, unknown> | null;
  triggeredAt: string;
  resolvedAt: string | null;
}

export type AlertRuleMetric =
  | "battery_level"
  | "device_offline_minutes"
  | "gps_stale_minutes"
  | "gateway_offline_minutes";

export interface AlertRule {
  id: string;
  propertyId: string;
  deviceId: string | null;
  gatewayId: string | null;
  metric: AlertRuleMetric;
  thresholdValue: number;
  severity: AlertSeverity;
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnimalMapMarker {
  animalId: string;
  tagCode: string;
  name: string | null;
  animalStatus: AnimalStatus;
  propertyId: string;
  deviceId: string | null;
  deviceIdentifier: string | null;
  latitude: number | null;
  longitude: number | null;
  batteryLevel: number | null;
  lastSeen: string | null;
  communicationStatus: CommunicationStatus;
}

export interface LocationPoint {
  id: string;
  deviceId: string;
  animalId: string | null;
  latitude: number;
  longitude: number;
  gpsAccuracy: number | null;
  batteryLevel: number | null;
  recordedAt: string;
}

export interface DashboardSummary {
  totalAnimals: number;
  online: number;
  attention: number;
  offline: number;
  neverSeen: number;
  lowBattery: number;
}

export interface Setting {
  key: string;
  value: unknown;
  description: string | null;
  updatedAt: string;
}
