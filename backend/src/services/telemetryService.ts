import { findCurrentAnimalForDevice } from "../repositories/deviceAssignmentsRepository.js";
import { findDeviceByRadioId, recordHeartbeat } from "../repositories/devicesRepository.js";
import { touchGatewayLastSeen } from "../repositories/gatewaysRepository.js";
import { findViolatedGeofenceIds, propertyHasActiveGeofences } from "../repositories/geofencesRepository.js";
import { insertLocation } from "../repositories/locationsRepository.js";
import {
  TELEMETRY_FLAG_BATTERY_VALID,
  TELEMETRY_FLAG_GNSS_FIX,
  TELEMETRY_FLAG_GNSS_TIME_VALID,
  type TelemetryInput,
} from "../schemas/telemetry.js";
import { batteryPercentFromMv } from "../utils/battery.js";
import { evaluateDeviceMetric } from "./alertRuleEvaluator.js";
import { clearAlert, raiseAlertOnce } from "./alertService.js";

export class UnknownDeviceError extends Error {
  constructor(radioDeviceId: number) {
    super(`No device is provisioned with radioDeviceId=${radioDeviceId}`);
    this.name = "UnknownDeviceError";
  }
}

export interface TelemetryResult {
  deviceId: string;
  deviceIdentifier: string;
  animalId: string | null;
  propertyId: string | null;
  hasFix: boolean;
  latitude: number | null;
  longitude: number | null;
  batteryPercent: number | null;
  recordedAt: Date;
}

function hasFlag(flags: number, flag: number): boolean {
  return (flags & flag) === flag;
}

export async function ingestTelemetry(input: TelemetryInput): Promise<TelemetryResult> {
  const device = await findDeviceByRadioId(input.radioDeviceId);
  if (!device) {
    throw new UnknownDeviceError(input.radioDeviceId);
  }

  const hasFix = hasFlag(input.flags, TELEMETRY_FLAG_GNSS_FIX);
  const hasValidTime = hasFlag(input.flags, TELEMETRY_FLAG_GNSS_TIME_VALID);
  const hasValidBattery = hasFlag(input.flags, TELEMETRY_FLAG_BATTERY_VALID);

  const recordedAt = hasValidTime ? new Date(input.gnssUnixTime * 1000) : new Date();
  const batteryPercent = hasValidBattery ? batteryPercentFromMv(input.batteryMv) : null;

  const animal = await findCurrentAnimalForDevice(device.id);

  await touchGatewayLastSeen(input.gatewayId);

  await recordHeartbeat({
    deviceId: device.id,
    latitude: hasFix ? input.latitude : undefined,
    longitude: hasFix ? input.longitude : undefined,
    batteryLevel: batteryPercent ?? undefined,
    seenAt: recordedAt,
    gpsFixAt: hasFix ? recordedAt : undefined,
  });

  if (hasFix) {
    await insertLocation({
      deviceId: device.id,
      animalId: animal?.id ?? null,
      position: { latitude: input.latitude, longitude: input.longitude },
      batteryLevel: batteryPercent ?? undefined,
      recordedAt,
    });
  }

  if (animal) {
    if (hasFix) {
      await checkGeofences(animal.id, animal.propertyId, { latitude: input.latitude, longitude: input.longitude });
    }
    await evaluateDeviceMetric(animal.propertyId, device.id, animal.id, "battery_level", batteryPercent);
  }

  return {
    deviceId: device.id,
    deviceIdentifier: device.deviceIdentifier,
    animalId: animal?.id ?? null,
    propertyId: animal?.propertyId ?? null,
    hasFix,
    latitude: hasFix ? input.latitude : null,
    longitude: hasFix ? input.longitude : null,
    batteryPercent,
    recordedAt,
  };
}

async function checkGeofences(
  animalId: string,
  propertyId: string,
  point: { latitude: number; longitude: number },
): Promise<void> {
  const hasGeofences = await propertyHasActiveGeofences(propertyId);
  if (!hasGeofences) {
    return;
  }

  const violatedGeofenceIds = await findViolatedGeofenceIds(propertyId, point);
  if (violatedGeofenceIds.length > 0) {
    await raiseAlertOnce({
      type: "geofence_exit",
      severity: "critical",
      animalId,
      propertyId,
      message: "O animal saiu da área delimitada da propriedade.",
      metadata: { geofenceIds: violatedGeofenceIds },
    });
  } else {
    await clearAlert({ type: "geofence_exit", animalId });
  }
}
