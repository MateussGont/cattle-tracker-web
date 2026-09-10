import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAlerts, updateAlertStatus, type ListAlertsParams } from "../api/alerts";
import type { AlertStatus } from "../types";

export function useAlerts(params: ListAlertsParams = {}) {
  return useQuery({ queryKey: ["alerts", params], queryFn: () => listAlerts(params), refetchInterval: 60_000 });
}

export function useUpdateAlertStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AlertStatus }) => updateAlertStatus(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
}
