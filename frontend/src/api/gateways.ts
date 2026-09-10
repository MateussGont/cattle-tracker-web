import { apiRequest } from "./client";
import type { Gateway } from "../types";

export function listGateways(): Promise<Gateway[]> {
  return apiRequest<Gateway[]>("/api/gateways");
}

export interface CreateGatewayInput {
  name: string;
  gatewayIdentifier: string;
  propertyId?: string;
}

export function createGateway(input: CreateGatewayInput): Promise<Gateway> {
  return apiRequest<Gateway>("/api/gateways", { method: "POST", body: input });
}
