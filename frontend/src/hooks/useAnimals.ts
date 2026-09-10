import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignDevice,
  createAnimal,
  deactivateAnimal,
  getAnimal,
  getAnimalHistory,
  getAnimalLocation,
  listAnimals,
  unassignDevice,
  type CreateAnimalInput,
  type HistoryParams,
  type ListAnimalsParams,
} from "../api/animals";

export function useAnimals(params: ListAnimalsParams = {}) {
  return useQuery({ queryKey: ["animals", params], queryFn: () => listAnimals(params) });
}

export function useAnimal(id: string | undefined) {
  return useQuery({
    queryKey: ["animal", id],
    queryFn: () => getAnimal(id as string),
    enabled: Boolean(id),
  });
}

export function useAnimalLocation(id: string | undefined) {
  return useQuery({
    queryKey: ["animal-location", id],
    queryFn: () => getAnimalLocation(id as string),
    enabled: Boolean(id),
  });
}

export function useAnimalHistory(id: string | undefined, params: HistoryParams) {
  return useQuery({
    queryKey: ["animal-history", id, params],
    queryFn: () => getAnimalHistory(id as string, params),
    enabled: Boolean(id),
  });
}

export function useCreateAnimal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnimalInput) => createAnimal(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["animals"] }),
  });
}

export function useDeactivateAnimal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateAnimal(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["animals"] }),
  });
}

export function useAssignDevice(animalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => assignDevice(animalId, deviceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["animal", animalId] });
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

export function useUnassignDevice(animalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unassignDevice(animalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["animal", animalId] });
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}
