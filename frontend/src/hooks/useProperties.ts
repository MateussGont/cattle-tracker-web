import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createGeofence,
  createProperty,
  deleteGeofence,
  getProperty,
  listGeofences,
  listProperties,
  type CreateGeofenceInput,
  type CreatePropertyInput,
} from "../api/properties";
import {
  createAlertRule,
  deleteAlertRule,
  listAlertRules,
  updateAlertRule,
  type CreateAlertRuleInput,
  type UpdateAlertRuleInput,
} from "../api/alertRules";

export function useProperties() {
  return useQuery({ queryKey: ["properties"], queryFn: listProperties });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePropertyInput) => createProperty(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["properties"] }),
  });
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: ["property", id],
    queryFn: () => getProperty(id as string),
    enabled: Boolean(id),
  });
}

export function useGeofences(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["geofences", propertyId],
    queryFn: () => listGeofences(propertyId as string),
    enabled: Boolean(propertyId),
  });
}

export function useCreateGeofence(propertyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGeofenceInput) => createGeofence(propertyId as string, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["geofences", propertyId] }),
  });
}

export function useDeleteGeofence(propertyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (geofenceId: string) => deleteGeofence(propertyId as string, geofenceId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["geofences", propertyId] }),
  });
}

export function useAlertRules(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["alertRules", propertyId],
    queryFn: () => listAlertRules(propertyId as string),
    enabled: Boolean(propertyId),
  });
}

export function useCreateAlertRule(propertyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAlertRuleInput) => createAlertRule(propertyId as string, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["alertRules", propertyId] }),
  });
}

export function useUpdateAlertRule(propertyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, input }: { ruleId: string; input: UpdateAlertRuleInput }) =>
      updateAlertRule(propertyId as string, ruleId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["alertRules", propertyId] }),
  });
}

export function useDeleteAlertRule(propertyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => deleteAlertRule(propertyId as string, ruleId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["alertRules", propertyId] }),
  });
}
