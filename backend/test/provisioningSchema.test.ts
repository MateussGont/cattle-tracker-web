import { describe, expect, it } from "vitest";
import { provisioningProofSchema, startProvisioningSchema } from "../src/schemas/provisioning.js";

describe("provisioning schemas", () => {
  it("normalizes the immutable hardware UID", () => {
    const input = startProvisioningSchema.parse({
      idempotencyKey: "b4f08a9d-dce1-41cc-9714-8dc73c454207",
      hardwareUid: "a1b2c3d4e5f6",
      firmwareVersion: "0.2.0",
      deviceIdentifier: "BRINCO-0001",
    });
    expect(input.hardwareUid).toBe("A1B2C3D4E5F6");
  });

  it("reserves radio ID zero and rejects mismatched UID formats", () => {
    expect(() => provisioningProofSchema.parse({
      hardwareUid: "not-a-uid",
      radioDeviceId: 0,
      configRevision: 0,
      firmwareVersion: "0.2.0",
    })).toThrow();
  });
});
