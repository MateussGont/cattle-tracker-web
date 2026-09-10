import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { JwtUserPayload } from "../middlewares/authenticate.js";
import { getUserPropertyIds } from "../repositories/usersRepository.js";

const clients = new Map<WebSocket, { propertyIds?: string[] }>();

export type RealtimeEvent =
  | { type: "location_update"; propertyId: string | null; payload: Record<string, unknown> }
  | { type: "alert_created"; propertyId: string | null; payload: Record<string, unknown> };

export function broadcast(event: RealtimeEvent): void {
  const message = JSON.stringify(event);
  for (const [client, access] of clients) {
    const canReceive = access.propertyIds === undefined ||
      (event.propertyId !== null && access.propertyIds.includes(event.propertyId));
    if (!canReceive) {
      continue;
    }
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

export async function registerRealtimeGateway(app: FastifyInstance): Promise<void> {
  // The browser WebSocket API cannot set an Authorization header, so the JWT
  // travels in the query string. Silence request logging for this route to
  // prevent credentials from being written to application logs.
  app.get("/ws", { websocket: true, logLevel: "silent" }, async (socket, request) => {
    const token = (request.query as { token?: string }).token;
    if (!token) {
      socket.close(4401, "missing token");
      return;
    }

    try {
      const user = app.jwt.verify<JwtUserPayload>(token);
      const propertyIds = user.role === "admin" ? undefined : await getUserPropertyIds(user.sub);
      clients.set(socket, { propertyIds });
    } catch {
      socket.close(4401, "invalid token");
      return;
    }

    socket.on("close", () => clients.delete(socket));
  });
}
