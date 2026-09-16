import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3000/ws";

interface RealtimeEvent {
  type: "location_update" | "alert_created";
  propertyId: string | null;
  payload: Record<string, unknown>;
}

/**
 * Keeps the three bench screens current without coupling them to the
 * transport payload. Telemetry events refresh the collar map/list and the
 * gateway's last observed communication.
 */
export function useRealtimeUpdates(): void {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      return;
    }

    const url = new URL(WS_URL);
    url.searchParams.set("token", token);
    const socket = new WebSocket(url);

    socket.onmessage = (event) => {
      let message: RealtimeEvent;
      try {
        message = JSON.parse(event.data as string) as RealtimeEvent;
      } catch {
        return;
      }

      if (message.type === "location_update") {
        void queryClient.invalidateQueries({ queryKey: ["map-devices"] });
        void queryClient.invalidateQueries({ queryKey: ["devices"] });
        void queryClient.invalidateQueries({ queryKey: ["gateways"] });
      }
    };

    return () => socket.close();
  }, [isAuthenticated, token, queryClient]);
}
