import { describe, expect, it } from "vitest";
import { batteryPercentFromMv } from "../src/utils/battery.js";

describe("batteryPercentFromMv", () => {
  it("clamps to 0% at or below the empty threshold", () => {
    expect(batteryPercentFromMv(2900)).toBe(0);
    expect(batteryPercentFromMv(3000)).toBe(0);
  });

  it("clamps to 100% at or above the full threshold", () => {
    expect(batteryPercentFromMv(4200)).toBe(100);
    expect(batteryPercentFromMv(4300)).toBe(100);
  });

  it("interpolates linearly in between", () => {
    expect(batteryPercentFromMv(3600)).toBe(50);
  });
});
