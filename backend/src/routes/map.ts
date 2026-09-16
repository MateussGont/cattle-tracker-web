import type { FastifyInstance } from "fastify";
import { listDeviceMapMarkers } from "../repositories/mapRepository.js";
import { getStatusThresholds } from "../repositories/settingsRepository.js";
import { accessiblePropertyIds, authenticate } from "../middlewares/authenticate.js";
import { computeCommunicationStatus } from "../services/statusService.js";

/** Minimal bench map: one marker per provisioned collar, independent of animals or geofences. */
export async function mapRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/map/devices", async (request) => {
    const propertyIds = await accessiblePropertyIds(request);
    const [thresholds, markers] = await Promise.all([
      getStatusThresholds(),
      listDeviceMapMarkers(propertyIds),
    ]);

    return markers.map((marker) => ({
      ...marker,
      communicationStatus: computeCommunicationStatus(marker.lastSeen, thresholds),
    }));
  });
}
