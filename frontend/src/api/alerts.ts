import { apiRequest } from "./client";
import type { Alert, AlertStatus } from "../types";

export interface ListAlertsParams {
  propertyId?: string;
  status?: AlertStatus;
  limit?: number;
  offset?: number;
}

export function listAlerts(params: ListAlertsParams = {}): Promise<Alert[]> {
  return apiRequest<Alert[]>("/api/alerts", { query: params });
}

export function updateAlertStatus(id: string, status: AlertStatus): Promise<Alert> {
  return apiRequest<Alert>(`/api/alerts/${id}`, { method: "PUT", body: { status } });
}
