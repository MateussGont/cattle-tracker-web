import { findAnimalById } from "../repositories/animalsRepository.js";
import {
  assignDeviceToAnimal,
  unassignDevice,
} from "../repositories/deviceAssignmentsRepository.js";
import { findDeviceById } from "../repositories/devicesRepository.js";

export class NotFoundError extends Error {}

export async function associateDeviceWithAnimal(animalId: string, deviceId: string) {
  const [animal, device] = await Promise.all([findAnimalById(animalId), findDeviceById(deviceId)]);
  if (!animal) {
    throw new NotFoundError(`Animal ${animalId} not found`);
  }
  if (!device) {
    throw new NotFoundError(`Device ${deviceId} not found`);
  }

  return assignDeviceToAnimal(deviceId, animalId);
}

export async function dissociateDeviceFromAnimal(animalId: string, deviceId: string): Promise<void> {
  const animal = await findAnimalById(animalId);
  if (!animal) {
    throw new NotFoundError(`Animal ${animalId} not found`);
  }
  await unassignDevice(deviceId);
}
