import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary, listMapAnimals, listSettings } from "../api/dashboard";

export function useDashboardSummary() {
  return useQuery({ queryKey: ["dashboard-summary"], queryFn: getDashboardSummary, refetchInterval: 60_000 });
}

export function useMapAnimals() {
  return useQuery({ queryKey: ["map-animals"], queryFn: listMapAnimals, refetchInterval: 60_000 });
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: listSettings });
}
