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
 * Keeps the map, dashboard and alerts screens live without polling: the
 * backend pushes one WebSocket message per ingested telemetry point or new
 * alert (see backend/src/websocket/realtime.ts), and this hook just
 * invalidates the affected TanStack Query caches so the next render
 * refetches fresh data.
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
        void queryClient.invalidateQueries({ queryKey: ["map-animals"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      } else if (message.type === "alert_created") {
        void queryClient.invalidateQueries({ queryKey: ["alerts"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      }
    };

    return () => socket.close();
  }, [isAuthenticated, token, queryClient]);
}
