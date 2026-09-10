import type { FastifyInstance } from "fastify";
import { getAnimalDeviceSnapshot } from "../repositories/dashboardRepository.js";
import { getStatusThresholds } from "../repositories/settingsRepository.js";
import { accessiblePropertyIds, authenticate } from "../middlewares/authenticate.js";
import { computeCommunicationStatus, isLowBattery } from "../services/statusService.js";

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/dashboard/summary", async (request) => {
    const propertyIds = await accessiblePropertyIds(request);
    const [thresholds, snapshot] = await Promise.all([
      getStatusThresholds(),
      getAnimalDeviceSnapshot(propertyIds),
    ]);

    const summary = {
      totalAnimals: snapshot.length,
      online: 0,
      attention: 0,
      offline: 0,
      neverSeen: 0,
      lowBattery: 0,
    };

    for (const row of snapshot) {
      const status = computeCommunicationStatus(row.lastSeen, thresholds);
      summary[status === "never_seen" ? "neverSeen" : status] += 1;
      if (isLowBattery(row.batteryLevel, thresholds)) {
        summary.lowBattery += 1;
      }
    }

    return summary;
  });
}
