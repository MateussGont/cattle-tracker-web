import type { StyleSpecification } from "maplibre-gl";

/**
 * Free OpenStreetMap raster tiles, no API key required. Fine for
 * development and low-traffic use; OSM's tile usage policy caps volume, so
 * a production deployment with real traffic should switch `tiles` to a
 * dedicated provider (e.g. MapTiler's free tier) — swapping this one file
 * is the only change needed, the rest of the app only depends on MapLibre's
 * style-agnostic API.
 */
export const osmRasterStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};
