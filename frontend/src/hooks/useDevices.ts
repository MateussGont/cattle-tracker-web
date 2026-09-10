import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignDevice, unassignDevice } from "../api/animals";
import { createDevice, getDevice, listDevices, retireDevice, type CreateDeviceInput, type ListDevicesParams } from "../api/devices";

export function useDevices(params: ListDevicesParams = {}) {
  return useQuery({ queryKey: ["devices", params], queryFn: () => listDevices(params) });
}

export function useDevice(id: string | undefined) {
  return useQuery({
    queryKey: ["device", id],
    queryFn: () => getDevice(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDeviceInput) => createDevice(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
}

export function useRetireDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => retireDevice(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
}

/** Links a device to an animal from the devices list (device-first flow) — the backend swaps out any prior assignment for either side. */
export function useLinkDeviceToAnimal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, animalId }: { deviceId: string; animalId: string }) => assignDevice(animalId, deviceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      void queryClient.invalidateQueries({ queryKey: ["animal"] });
    },
  });
}

export function useUnlinkDeviceFromAnimal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (animalId: string) => unassignDevice(animalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
      void queryClient.invalidateQueries({ queryKey: ["animal"] });
    },
  });
}
