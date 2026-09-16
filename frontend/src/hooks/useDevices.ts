import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listDevices, retireDevice, type ListDevicesParams } from "../api/devices";

export function useDevices(params: ListDevicesParams = {}) {
  return useQuery({ queryKey: ["devices", params], queryFn: () => listDevices(params) });
}

export function useRetireDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => retireDevice(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
}
