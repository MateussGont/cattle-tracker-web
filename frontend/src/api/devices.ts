import { apiRequest } from "./client";
import type { Animal, Device, DeviceStatus } from "../types";

export interface ListDevicesParams {
  status?: DeviceStatus;
  limit?: number;
  offset?: number;
}

export function listDevices(params: ListDevicesParams = {}): Promise<Device[]> {
  return apiRequest<Device[]>("/api/devices", { query: params });
}

export function getDevice(id: string): Promise<Device & { animal: Animal | null }> {
  return apiRequest(`/api/devices/${id}`);
}

export interface CreateDeviceInput {
  deviceIdentifier: string;
  radioDeviceId: number;
  hardwareModel?: string;
  gatewayId?: string;
}

export function createDevice(input: CreateDeviceInput): Promise<Device> {
  return apiRequest<Device>("/api/devices", { method: "POST", body: input });
}

export function retireDevice(id: string): Promise<void> {
  return apiRequest<void>(`/api/devices/${id}`, { method: "DELETE" });
}
