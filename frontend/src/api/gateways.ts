import { apiRequest } from "./client";
import type { Gateway } from "../types";

export function listGateways(): Promise<Gateway[]> {
  return apiRequest<Gateway[]>("/api/gateways");
}
