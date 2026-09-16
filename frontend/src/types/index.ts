export type UserRole = "admin" | "manager" | "viewer";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type CommunicationStatus = "online" | "attention" | "offline" | "never_seen";
export type DeviceStatus = "active" | "inactive" | "maintenance";

export interface Device {
  id: string;
  deviceIdentifier: string;
  radioDeviceId: number;
  hardwareUid: string | null;
  hardwareModel: string | null;
  firmwareVersion: string | null;
  provisioningStatus: "pending" | "active" | "failed";
  configRevision: number;
  provisionedAt: string | null;
  gatewayId: string | null;
  status: DeviceStatus;
  batteryLevel: number | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastSeen: string | null;
  communicationStatus?: CommunicationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceMapMarker {
  deviceId: string;
  deviceIdentifier: string;
  radioDeviceId: number;
  firmwareVersion: string | null;
  gatewayId: string | null;
  latitude: number | null;
  longitude: number | null;
  batteryLevel: number | null;
  lastSeen: string | null;
  communicationStatus: CommunicationStatus;
}

export interface Gateway {
  id: string;
  name: string;
  gatewayIdentifier: string;
  propertyId: string | null;
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
}
