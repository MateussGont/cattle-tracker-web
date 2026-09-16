import { apiRequest } from "./client";

export interface ProvisioningSession {
  id: string;
  idempotencyKey: string;
  hardwareUid: string;
  deviceId: string;
  radioDeviceId: number;
  configRevision: number;
  firmwareVersion: string;
  status: "pending" | "configured" | "confirmed" | "failed";
  expiresAt: string;
}

export interface ProvisioningProof {
  hardwareUid: string;
  radioDeviceId: number;
  configRevision: number;
  firmwareVersion: string;
}

export function startProvisioning(input: {
  idempotencyKey: string;
  hardwareUid: string;
  firmwareVersion: string;
  deviceIdentifier: string;
  hardwareModel?: string;
  gatewayId?: string;
}): Promise<ProvisioningSession> {
  return apiRequest("/api/provisioning/sessions", { method: "POST", body: input });
}

export function markProvisioningConfigured(id: string, proof: ProvisioningProof): Promise<ProvisioningSession> {
  return apiRequest(`/api/provisioning/sessions/${id}/configured`, { method: "POST", body: proof });
}

export function confirmProvisioning(id: string, proof: ProvisioningProof): Promise<ProvisioningSession> {
  return apiRequest(`/api/provisioning/sessions/${id}/confirm`, { method: "POST", body: proof });
}
