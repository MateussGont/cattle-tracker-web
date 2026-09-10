import { describe, expect, it } from "vitest";
import { telemetrySchema } from "../src/schemas/telemetry.js";

const validPayload = {
  gatewayId: "GATEWAY-0001",
  radioDeviceId: 1,
  sequence: 12,
  latitude: -19.9231234,
  longitude: -43.9401234,
  gnssUnixTime: 1784635200,
  batteryMv: 3890,
  flags: 3,
  rssi: -87.0,
  snr: 8.5,
};

describe("telemetrySchema", () => {
  it("accepts a well-formed payload", () => {
    expect(telemetrySchema.safeParse(validPayload).success).toBe(true);
  });

  it("rejects out-of-range latitude", () => {
    const result = telemetrySchema.safeParse({ ...validPayload, latitude: 200 });
    expect(result.success).toBe(false);
  });

  it("rejects out-of-range longitude", () => {
    const result = telemetrySchema.safeParse({ ...validPayload, longitude: -200 });
    expect(result.success).toBe(false);
  });

  it("rejects a radioDeviceId outside the uint16 range", () => {
    const result = telemetrySchema.safeParse({ ...validPayload, radioDeviceId: 70000 });
    expect(result.success).toBe(false);
  });

  it("rejects a missing gatewayId", () => {
    const { gatewayId: _gatewayId, ...withoutGatewayId } = validPayload;
    const result = telemetrySchema.safeParse(withoutGatewayId);
    expect(result.success).toBe(false);
  });

  it("accepts rssi/snr as optional", () => {
    const { rssi: _rssi, snr: _snr, ...withoutRadioMetrics } = validPayload;
    expect(telemetrySchema.safeParse(withoutRadioMetrics).success).toBe(true);
  });
});
