import { useQuery } from "@tanstack/react-query";
import { listGateways } from "../api/gateways";

export function useGateways() {
  return useQuery({ queryKey: ["gateways"], queryFn: listGateways });
}
