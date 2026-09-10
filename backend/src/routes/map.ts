import type { FastifyInstance } from "fastify";
import { listAnimalMapMarkers } from "../repositories/mapRepository.js";
import { getStatusThresholds } from "../repositories/settingsRepository.js";
import { accessiblePropertyIds, authenticate } from "../middlewares/authenticate.js";
import { computeCommunicationStatus } from "../services/statusService.js";

/** Feeds the map view (spec section 7): one marker per animal, refreshed by the frontend on each `location_update` WebSocket event. */
export async function mapRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/map/animals", async (request) => {
    const propertyIds = await accessiblePropertyIds(request);
    const [thresholds, markers] = await Promise.all([
      getStatusThresholds(),
      listAnimalMapMarkers(propertyIds),
    ]);

    return markers.map((marker) => ({
      ...marker,
      communicationStatus: computeCommunicationStatus(marker.lastSeen, thresholds),
    }));
  });
}
