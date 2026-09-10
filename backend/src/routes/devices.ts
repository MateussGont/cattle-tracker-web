import type { FastifyInstance } from "fastify";
import { createDeviceSchema, listDevicesQuerySchema, updateDeviceSchema } from "../schemas/device.js";
import {
  createDevice,
  findDeviceById,
  listDevices,
  updateDeviceStatus,
} from "../repositories/devicesRepository.js";
import {
  findCurrentAnimalForDevice,
  listCurrentAssignmentsForDevices,
  unassignDevice,
} from "../repositories/deviceAssignmentsRepository.js";
import { getStatusThresholds } from "../repositories/settingsRepository.js";
import { accessiblePropertyIds, authenticate } from "../middlewares/authenticate.js";
import { findGatewayById } from "../repositories/gatewaysRepository.js";
import { computeCommunicationStatus } from "../services/statusService.js";

export async function deviceRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/devices", async (request) => {
    const query = listDevicesQuerySchema.parse(request.query);
    const propertyIds = await accessiblePropertyIds(request);
    const [thresholds, devices] = await Promise.all([
      getStatusThresholds(),
      listDevices({ ...query, propertyIds }),
    ]);
    const assignments = await listCurrentAssignmentsForDevices(devices.map((device) => device.id));
    const animalByDevice = new Map(assignments.map((row) => [row.deviceId, row]));
    return devices.map((device) => {
      const assignment = animalByDevice.get(device.id);
      return {
        ...device,
        communicationStatus: computeCommunicationStatus(device.lastSeen, thresholds),
        animal: assignment
          ? { id: assignment.animalId, tagCode: assignment.animalTagCode, name: assignment.animalName }
          : null,
      };
    });
  });

  app.post("/api/devices", async (request, reply) => {
    if (request.user.role !== "admin") {
      return reply.code(403).send({ error: "forbidden", message: "Apenas administradores podem provisionar dispositivos." });
    }
    const body = createDeviceSchema.parse(request.body);
    const device = await createDevice(body);
    return reply.code(201).send(device);
  });

  app.get("/api/devices/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const device = await findDeviceById(id);
    if (!device) {
      return reply.code(404).send({ error: "not_found" });
    }
    const [thresholds, animal] = await Promise.all([getStatusThresholds(), findCurrentAnimalForDevice(id)]);
    if (request.user.role !== "admin") {
      const [propertyIds, gateway] = await Promise.all([
        accessiblePropertyIds(request),
        device.gatewayId ? findGatewayById(device.gatewayId) : Promise.resolve(null),
      ]);
      const canAccess = Boolean(
        (animal && propertyIds?.includes(animal.propertyId)) ||
        (gateway?.propertyId && propertyIds?.includes(gateway.propertyId)),
      );
      if (!canAccess) {
        return reply.code(403).send({ error: "forbidden" });
      }
    }
    return {
      ...device,
      communicationStatus: computeCommunicationStatus(device.lastSeen, thresholds),
      animal,
    };
  });

  app.put("/api/devices/:id", async (request, reply) => {
    if (request.user.role !== "admin") {
      return reply.code(403).send({ error: "forbidden" });
    }
    const { id } = request.params as { id: string };
    const body = updateDeviceSchema.parse(request.body);
    const device = await updateDeviceStatus(id, body);
    if (!device) {
      return reply.code(404).send({ error: "not_found" });
    }
    return device;
  });

  /**
   * Devices are never hard-deleted (locations/device_assignments reference
   * them for the audit trail) — "remover" retires the device (status
   * inactive) and closes any open animal assignment, mirroring how animals
   * are soft-deactivated in DELETE /api/animals/:id.
   */
  app.delete("/api/devices/:id", async (request, reply) => {
    if (request.user.role !== "admin") {
      return reply.code(403).send({ error: "forbidden" });
    }
    const { id } = request.params as { id: string };
    const device = await findDeviceById(id);
    if (!device) {
      return reply.code(404).send({ error: "not_found" });
    }
    await unassignDevice(id);
    await updateDeviceStatus(id, { status: "inactive" });
    return reply.code(204).send();
  });
}
