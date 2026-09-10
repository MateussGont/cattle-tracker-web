import { describe, expect, it } from "vitest";
import { pointToWkt, polygonToWkt } from "../src/utils/geo.js";

describe("polygonToWkt", () => {
  it("closes an open ring by repeating the first point", () => {
    const wkt = polygonToWkt([
      { latitude: -19.93, longitude: -44.02 },
      { latitude: -19.93, longitude: -44.0 },
      { latitude: -19.91, longitude: -44.0 },
      { latitude: -19.91, longitude: -44.02 },
    ]);
    expect(wkt).toBe(
      "POLYGON((-44.02 -19.93, -44 -19.93, -44 -19.91, -44.02 -19.91, -44.02 -19.93))",
    );
  });

  it("does not duplicate the closing point when already closed", () => {
    const ring = [
      { latitude: -19.93, longitude: -44.02 },
      { latitude: -19.93, longitude: -44.0 },
      { latitude: -19.91, longitude: -44.0 },
      { latitude: -19.93, longitude: -44.02 },
    ];
    const wkt = polygonToWkt(ring);
    const pointCount = wkt.split(",").length;
    expect(pointCount).toBe(4);
  });
});

describe("pointToWkt", () => {
  it("orders longitude before latitude, as WKT requires", () => {
    expect(pointToWkt({ latitude: -19.923456, longitude: -44.012345 })).toBe(
      "POINT(-44.012345 -19.923456)",
    );
  });
});
