import { describe, expect, it } from "vitest";
import { pathDistanceMeters } from "./distance";

describe("pathDistanceMeters", () => {
  it("returns 0 for a single point or empty path", () => {
    expect(pathDistanceMeters([])).toBe(0);
    expect(pathDistanceMeters([[-44.0, -19.9]])).toBe(0);
  });

  it("matches a known great-circle distance within tolerance", () => {
    // Roughly 1 degree of latitude ≈ 111.19 km at the equator.
    const distance = pathDistanceMeters([
      [0, 0],
      [0, 1],
    ]);
    expect(distance).toBeGreaterThan(110_500);
    expect(distance).toBeLessThan(111_500);
  });

  it("sums consecutive legs of a multi-point path", () => {
    const twoLegs = pathDistanceMeters([
      [-44.02, -19.93],
      [-44.0, -19.93],
      [-44.0, -19.91],
    ]);
    const legOne = pathDistanceMeters([
      [-44.02, -19.93],
      [-44.0, -19.93],
    ]);
    const legTwo = pathDistanceMeters([
      [-44.0, -19.93],
      [-44.0, -19.91],
    ]);
    expect(twoLegs).toBeCloseTo(legOne + legTwo, 6);
  });
});
