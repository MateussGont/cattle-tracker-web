import { describe, expect, it } from "vitest";
import { computeCommunicationStatus, isLowBattery } from "../src/services/statusService.js";

const thresholds = { attentionMinutes: 20, offlineMinutes: 60, lowBatteryPercent: 20 };
const now = new Date("2026-08-10T22:00:00Z");

describe("computeCommunicationStatus", () => {
  it("returns never_seen when the device has no heartbeat yet", () => {
    expect(computeCommunicationStatus(null, thresholds, now)).toBe("never_seen");
  });

  it("returns online within the attention window", () => {
    const lastSeen = new Date("2026-08-10T21:45:00Z");
    expect(computeCommunicationStatus(lastSeen, thresholds, now)).toBe("online");
  });

  it("returns attention between the attention and offline windows", () => {
    const lastSeen = new Date("2026-08-10T21:30:00Z");
    expect(computeCommunicationStatus(lastSeen, thresholds, now)).toBe("attention");
  });

  it("returns offline beyond the offline window", () => {
    const lastSeen = new Date("2026-08-10T20:00:00Z");
    expect(computeCommunicationStatus(lastSeen, thresholds, now)).toBe("offline");
  });

  it("treats the exact attention boundary as still online", () => {
    const lastSeen = new Date(now.getTime() - thresholds.attentionMinutes * 60_000);
    expect(computeCommunicationStatus(lastSeen, thresholds, now)).toBe("online");
  });
});

describe("isLowBattery", () => {
  it("is false when battery is unknown", () => {
    expect(isLowBattery(null, thresholds)).toBe(false);
  });

  it("is true at or below the configured threshold", () => {
    expect(isLowBattery(20, thresholds)).toBe(true);
    expect(isLowBattery(5, thresholds)).toBe(true);
  });

  it("is false above the configured threshold", () => {
    expect(isLowBattery(21, thresholds)).toBe(false);
  });
});
