import { apiRequest } from "./client";
import type { Geofence, Property } from "../types";

interface LatLng {
  latitude: number;
  longitude: number;
}

export function listProperties(): Promise<Property[]> {
  return apiRequest<Property[]>("/api/properties");
}

export interface CreatePropertyInput {
  name: string;
  location?: { latitude: number; longitude: number };
}

export function createProperty(input: CreatePropertyInput): Promise<Property> {
  return apiRequest<Property>("/api/properties", { method: "POST", body: input });
}

export function getProperty(id: string): Promise<Property> {
  return apiRequest<Property>(`/api/properties/${id}`);
}

export function listGeofences(propertyId: string): Promise<Geofence[]> {
  return apiRequest<Geofence[]>(`/api/properties/${propertyId}/geofences`);
}

export interface CreateGeofenceInput {
  name: string;
  boundary: LatLng[];
  active?: boolean;
}

export function createGeofence(propertyId: string, input: CreateGeofenceInput): Promise<Geofence> {
  return apiRequest<Geofence>(`/api/properties/${propertyId}/geofences`, { method: "POST", body: input });
}

export function deleteGeofence(propertyId: string, geofenceId: string): Promise<void> {
  return apiRequest<void>(`/api/properties/${propertyId}/geofences/${geofenceId}`, { method: "DELETE" });
}
