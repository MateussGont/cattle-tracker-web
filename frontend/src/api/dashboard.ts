import { apiRequest } from "./client";
import type { AnimalMapMarker, DashboardSummary, Setting } from "../types";

export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>("/api/dashboard/summary");
}

export function listMapAnimals(): Promise<AnimalMapMarker[]> {
  return apiRequest<AnimalMapMarker[]>("/api/map/animals");
}

export function listSettings(): Promise<Setting[]> {
  return apiRequest<Setting[]>("/api/settings");
}
