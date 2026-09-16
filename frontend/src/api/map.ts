import { apiRequest } from "./client";
import type { DeviceMapMarker } from "../types";

export function listDeviceMapMarkers(): Promise<DeviceMapMarker[]> {
  return apiRequest<DeviceMapMarker[]>("/api/map/devices");
}
