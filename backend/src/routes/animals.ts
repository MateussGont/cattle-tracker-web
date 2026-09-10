import type { FastifyInstance } from "fastify";
import {
  createAnimalSchema,
  historyQuerySchema,
  listAnimalsQuerySchema,
  updateAnimalSchema,
} from "../schemas/animal.js";
import { assignDeviceSchema } from "../schemas/device.js";
import {
  createAnimal,
  deactivateAnimal,
  findAnimalById,
  listAnimals,
  updateAnimal,
} from "../repositories/animalsRepository.js";
import {
  findCurrentAnimalForDevice,
  findCurrentDeviceForAnimal,
  listAssignmentHistoryByAnimal,
} from "../repositories/deviceAssignmentsRepository.js";
import { findLatestLocationByAnimal, listLocationHistoryByAnimal } from "../repositories/locationsRepository.js";
import {
  accessiblePropertyIds,
  assertPropertyAccess,
  assertPropertyWriteAccess,
  authenticate,
} from "../middlewares/authenticate.js";
import {
  associateDeviceWithAnimal,
  dissociateDeviceFromAnimal,
} from "../services/deviceAssignmentService.js";
import { findDeviceById } from "../repositories/devicesRepository.js";
import { findGatewayById } from "../repositories/gatewaysRepository.js";

export async function animalRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);

  app.get("/api/animals", async (request, reply) => {
    const query = listAnimalsQuerySchema.parse(request.query);
    const propertyIds = await accessiblePropertyIds(request);
    if (query.propertyId && propertyIds !== undefined && !propertyIds.includes(query.propertyId)) {
      return reply.code(403).send({ error: "forbidden", message: "Sem acesso a esta propriedade." });
    }
    return listAnimals({ ...query, propertyIds });
  });

  app.post("/api/animals", async (request, reply) => {
    const body = createAnimalSchema.parse(request.body);
    if (!(await assertPropertyWriteAccess(request, body.propertyId))) {
      return reply.code(403).send({ error: "forbidden", message: "Sem acesso a esta propriedade." });
    }
    const animal = await createAnimal(body);
    return reply.code(201).send(animal);
  });

  app.get("/api/animals/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const animal = await findAnimalById(id);
    if (!animal) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (!(await assertPropertyAccess(request, animal.propertyId))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const device = await findCurrentDeviceForAnimal(id);
    return { ...animal, device };
  });

  app.put("/api/animals/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const animal = await findAnimalById(id);
    if (!animal) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (!(await assertPropertyWriteAccess(request, animal.propertyId))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const body = updateAnimalSchema.parse(request.body);
    if (body.propertyId && !(await assertPropertyWriteAccess(request, body.propertyId))) {
      return reply.code(403).send({ error: "forbidden", message: "Sem acesso de escrita à propriedade de destino." });
    }
    return updateAnimal(id, body);
  });

  app.delete("/api/animals/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const animal = await findAnimalById(id);
    if (!animal) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (!(await assertPropertyWriteAccess(request, animal.propertyId))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    await deactivateAnimal(id);
    return reply.code(204).send();
  });

  app.get("/api/animals/:id/location", async (request, reply) => {
    const { id } = request.params as { id: string };
    const animal = await findAnimalById(id);
    if (!animal) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (!(await assertPropertyAccess(request, animal.propertyId))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const location = await findLatestLocationByAnimal(id);
    return location ?? reply.code(404).send({ error: "no_location", message: "Nenhuma localização registrada ainda." });
  });

  app.get("/api/animals/:id/history", async (request, reply) => {
    const { id } = request.params as { id: string };
    const animal = await findAnimalById(id);
    if (!animal) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (!(await assertPropertyAccess(request, animal.propertyId))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const query = historyQuerySchema.parse(request.query);
    return listLocationHistoryByAnimal({ animalId: id, ...query });
  });

  app.post("/api/animals/:id/device", async (request, reply) => {
    const { id } = request.params as { id: string };
    const animal = await findAnimalById(id);
    if (!animal) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (!(await assertPropertyWriteAccess(request, animal.propertyId))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const body = assignDeviceSchema.parse(request.body);
    if (request.user.role !== "admin") {
      const device = await findDeviceById(body.deviceId);
      if (!device) {
        return reply.code(404).send({ error: "not_found", message: "Dispositivo não encontrado." });
      }
      const [currentAnimal, gateway] = await Promise.all([
        findCurrentAnimalForDevice(device.id),
        device.gatewayId ? findGatewayById(device.gatewayId) : Promise.resolve(null),
      ]);
      const belongsToProperty =
        currentAnimal?.propertyId === animal.propertyId || gateway?.propertyId === animal.propertyId;
      if (!belongsToProperty) {
        return reply.code(403).send({ error: "forbidden", message: "Dispositivo fora do escopo desta propriedade." });
      }
    }
    const assignment = await associateDeviceWithAnimal(id, body.deviceId);
    return reply.code(201).send(assignment);
  });

  app.delete("/api/animals/:id/device", async (request, reply) => {
    const { id } = request.params as { id: string };
    const animal = await findAnimalById(id);
    if (!animal) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (!(await assertPropertyWriteAccess(request, animal.propertyId))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const device = await findCurrentDeviceForAnimal(id);
    if (!device) {
      return reply.code(404).send({ error: "no_device_assigned" });
    }
    await dissociateDeviceFromAnimal(id, device.id);
    return reply.code(204).send();
  });

  app.get("/api/animals/:id/device-history", async (request, reply) => {
    const { id } = request.params as { id: string };
    const animal = await findAnimalById(id);
    if (!animal) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (!(await assertPropertyAccess(request, animal.propertyId))) {
      return reply.code(403).send({ error: "forbidden" });
    }
    return listAssignmentHistoryByAnimal(id);
  });
}
