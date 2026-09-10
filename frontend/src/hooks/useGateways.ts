import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createGateway, listGateways, type CreateGatewayInput } from "../api/gateways";

export function useGateways() {
  return useQuery({ queryKey: ["gateways"], queryFn: listGateways });
}

export function useCreateGateway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGatewayInput) => createGateway(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["gateways"] }),
  });
}
