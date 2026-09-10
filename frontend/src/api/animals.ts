import { ApiError, apiRequest } from "./client";
import type { Animal, AnimalStatus, Device, LocationPoint } from "../types";

export interface ListAnimalsParams {
  propertyId?: string;
  status?: AnimalStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export function listAnimals(params: ListAnimalsParams = {}): Promise<Animal[]> {
  return apiRequest<Animal[]>("/api/animals", { query: params });
}

export function getAnimal(id: string): Promise<Animal & { device: Device | null }> {
  return apiRequest(`/api/animals/${id}`);
}

export interface CreateAnimalInput {
  tagCode: string;
  name?: string;
  sex?: "male" | "female";
  breed?: string;
  birthDate?: string;
  propertyId: string;
}

export function createAnimal(input: CreateAnimalInput): Promise<Animal> {
  return apiRequest<Animal>("/api/animals", { method: "POST", body: input });
}

export function updateAnimal(id: string, patch: Partial<CreateAnimalInput> & { status?: AnimalStatus }): Promise<Animal> {
  return apiRequest<Animal>(`/api/animals/${id}`, { method: "PUT", body: patch });
}

export function deactivateAnimal(id: string): Promise<void> {
  return apiRequest<void>(`/api/animals/${id}`, { method: "DELETE" });
}

export function getAnimalLocation(id: string): Promise<LocationPoint | null> {
  return apiRequest<LocationPoint | null>(`/api/animals/${id}/location`).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  });
}

export interface HistoryParams {
  from?: string;
  to?: string;
  limit?: number;
}

export function getAnimalHistory(id: string, params: HistoryParams = {}): Promise<LocationPoint[]> {
  return apiRequest<LocationPoint[]>(`/api/animals/${id}/history`, { query: params });
}

export function assignDevice(animalId: string, deviceId: string): Promise<void> {
  return apiRequest<void>(`/api/animals/${animalId}/device`, { method: "POST", body: { deviceId } });
}

export function unassignDevice(animalId: string): Promise<void> {
  return apiRequest<void>(`/api/animals/${animalId}/device`, { method: "DELETE" });
}
