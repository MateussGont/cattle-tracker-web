import { useQuery } from "@tanstack/react-query";
import { listDeviceMapMarkers } from "../api/map";

export function useDeviceMapMarkers() {
  return useQuery({ queryKey: ["map-devices"], queryFn: listDeviceMapMarkers });
}
