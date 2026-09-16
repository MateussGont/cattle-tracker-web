import { and, desc, eq, inArray, max, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { devices, provisioningSessions } from "../db/schema.js";
import type { ProvisioningProof, StartProvisioningInput } from "../schemas/provisioning.js";

const SESSION_TTL_MS = 30 * 60 * 1000;
const ALLOCATION_LOCK_ID = 274981;

export class ProvisioningError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ProvisioningError";
  }
}

export function nextRadioDeviceId(currentMaximum: number | null): number {
  const next = Math.max(0, currentMaximum ?? 0) + 1;
  if (next > 65535) {
    throw new ProvisioningError("radio_id_pool_exhausted", 409, "Não há IDs de rádio disponíveis.");
  }
  return next;
}

type SessionRow = typeof provisioningSessions.$inferSelect;

export function assertProofMatches(session: SessionRow, proof: ProvisioningProof): void {
  if (
    session.hardwareUid !== proof.hardwareUid ||
    session.radioDeviceId !== proof.radioDeviceId ||
    session.configRevision !== proof.configRevision ||
    session.firmwareVersion !== proof.firmwareVersion
  ) {
    throw new ProvisioningError(
      "provisioning_proof_mismatch",
      409,
      "A confirmação não corresponde exatamente à identidade reservada.",
    );
  }
}

export async function startProvisioning(input: StartProvisioningInput, userId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${ALLOCATION_LOCK_ID})`);

    const [idempotent] = await tx
      .select()
      .from(provisioningSessions)
      .where(eq(provisioningSessions.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (idempotent) {
      if (idempotent.hardwareUid !== input.hardwareUid) {
        throw new ProvisioningError("idempotency_conflict", 409, "A chave de idempotência já foi usada para outro hardware.");
      }
      return idempotent;
    }

    const now = new Date();
    const [existingDevice] = await tx
      .select()
      .from(devices)
      .where(eq(devices.hardwareUid, input.hardwareUid))
      .limit(1);

    if (existingDevice?.provisioningStatus === "active") {
      throw new ProvisioningError("device_already_provisioned", 409, "Este hardware já está provisionado.");
    }

    if (existingDevice) {
      const [resumable] = await tx
        .select()
        .from(provisioningSessions)
        .where(and(
          eq(provisioningSessions.deviceId, existingDevice.id),
          inArray(provisioningSessions.status, ["pending", "configured"]),
        ))
        .orderBy(desc(provisioningSessions.createdAt))
        .limit(1);
      if (resumable && resumable.expiresAt > now) {
        return resumable;
      }
      if (resumable) {
        await tx.update(provisioningSessions).set({ status: "failed", updatedAt: now }).where(eq(provisioningSessions.id, resumable.id));
      }

      // Reuse the identity already reserved for this physical device. This
      // makes a retry safe whether the previous interruption happened before
      // or after NVS was written; the firmware will apply or acknowledge the
      // exact same tuple idempotently.
      const nextRevision = Math.max(1, existingDevice.configRevision);
      await tx.update(devices).set({
        deviceIdentifier: input.deviceIdentifier,
        hardwareModel: input.hardwareModel,
        gatewayId: input.gatewayId,
        firmwareVersion: input.firmwareVersion,
        configRevision: nextRevision,
        provisioningStatus: "pending",
        status: "maintenance",
        updatedAt: now,
      }).where(eq(devices.id, existingDevice.id));
      const [session] = await tx.insert(provisioningSessions).values({
        idempotencyKey: input.idempotencyKey,
        hardwareUid: input.hardwareUid,
        deviceId: existingDevice.id,
        radioDeviceId: existingDevice.radioDeviceId,
        configRevision: nextRevision,
        firmwareVersion: input.firmwareVersion,
        createdBy: userId,
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      }).returning();
      return session!;
    }

    const [maximum] = await tx.select({ value: max(devices.radioDeviceId) }).from(devices);
    const radioDeviceId = nextRadioDeviceId(maximum?.value == null ? null : Number(maximum.value));
    const [device] = await tx.insert(devices).values({
      deviceIdentifier: input.deviceIdentifier,
      radioDeviceId,
      hardwareUid: input.hardwareUid,
      hardwareModel: input.hardwareModel,
      firmwareVersion: input.firmwareVersion,
      gatewayId: input.gatewayId,
      provisioningStatus: "pending",
      configRevision: 1,
      status: "maintenance",
    }).returning();
    const [session] = await tx.insert(provisioningSessions).values({
      idempotencyKey: input.idempotencyKey,
      hardwareUid: input.hardwareUid,
      deviceId: device!.id,
      radioDeviceId,
      configRevision: 1,
      firmwareVersion: input.firmwareVersion,
      createdBy: userId,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    }).returning();
    return session!;
  });
}

export async function getProvisioningSession(id: string) {
  const [session] = await db.select().from(provisioningSessions).where(eq(provisioningSessions.id, id)).limit(1);
  return session ?? null;
}

async function requireSession(id: string): Promise<SessionRow> {
  const session = await getProvisioningSession(id);
  if (!session) {
    throw new ProvisioningError("session_not_found", 404, "Sessão de provisionamento não encontrada.");
  }
  if (session.expiresAt <= new Date() && session.status !== "confirmed") {
    throw new ProvisioningError("session_expired", 409, "A sessão de provisionamento expirou.");
  }
  return session;
}

export async function markProvisioningConfigured(id: string, proof: ProvisioningProof) {
  const session = await requireSession(id);
  assertProofMatches(session, proof);
  if (session.status === "confirmed" || session.status === "configured") {
    return session;
  }
  if (session.status !== "pending") {
    throw new ProvisioningError("invalid_session_state", 409, "A sessão não pode mais ser configurada.");
  }
  const [updated] = await db.update(provisioningSessions).set({ status: "configured", updatedAt: new Date() }).where(eq(provisioningSessions.id, id)).returning();
  return updated!;
}

export async function confirmProvisioning(id: string, proof: ProvisioningProof, userId: string) {
  return db.transaction(async (tx) => {
    const [session] = await tx.select().from(provisioningSessions).where(eq(provisioningSessions.id, id)).limit(1);
    if (!session) {
      throw new ProvisioningError("session_not_found", 404, "Sessão de provisionamento não encontrada.");
    }
    assertProofMatches(session, proof);
    if (session.status === "confirmed") {
      return session;
    }
    if (session.expiresAt <= new Date()) {
      throw new ProvisioningError("session_expired", 409, "A sessão de provisionamento expirou.");
    }
    if (session.status !== "configured") {
      throw new ProvisioningError("device_not_configured", 409, "Confirme primeiro a gravação no hardware.");
    }

    const now = new Date();
    await tx.update(devices).set({
      provisioningStatus: "active",
      status: "active",
      provisionedAt: now,
      lastProvisionedBy: userId,
      firmwareVersion: proof.firmwareVersion,
      updatedAt: now,
    }).where(eq(devices.id, session.deviceId));
    const [confirmed] = await tx.update(provisioningSessions).set({ status: "confirmed", updatedAt: now }).where(eq(provisioningSessions.id, id)).returning();
    return confirmed!;
  });
}
