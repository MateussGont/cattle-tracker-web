import { apiRequest } from "./client";
import type { Device, DeviceStatus } from "../types";

export interface ListDevicesParams {
  status?: DeviceStatus;
  limit?: number;
  offset?: number;
}

export function listDevices(params: ListDevicesParams = {}): Promise<Device[]> {
  return apiRequest<Device[]>("/api/devices", { query: params });
}

export function retireDevice(id: string): Promise<void> {
  return apiRequest<void>(`/api/devices/${id}`, { method: "DELETE" });
}
