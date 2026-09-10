import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { osmRasterStyle } from "../lib/mapStyle";
import { mapboxDrawTheme } from "../lib/mapboxDrawTheme";
import type { CommunicationStatus, Geofence } from "../types";

export interface MapMarkerData {
  id: string;
  latitude: number;
  longitude: number;
  status: CommunicationStatus;
  popupHtml: string;
}

export interface LatLngPoint {
  latitude: number;
  longitude: number;
}

interface MapViewProps {
  markers: MapMarkerData[];
  trajectory?: [number, number][];
  fallbackCenter?: [number, number];
  geofences?: Geofence[];
  drawMode?: boolean;
  onGeofenceDrawn?: (points: LatLngPoint[]) => void;
}

const STATUS_COLORS: Record<CommunicationStatus, string> = {
  online: "#16a34a",
  attention: "#d97706",
  offline: "#dc2626",
  never_seen: "#6b7280",
};

const DEFAULT_CENTER: [number, number] = [-44.012345, -19.923456];
const TRAJECTORY_SOURCE_ID = "trajectory";
const GEOFENCES_SOURCE_ID = "geofences";
const GEOFENCE_COLOR = "#7c3aed";

export interface MapViewHandle {
  /** Finishes the polygon currently being drawn, as if the user pressed Enter (mapbox-gl-draw's own shortcut for this). */
  finishDrawing: () => void;
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { markers, trajectory, fallbackCenter = DEFAULT_CENTER, geofences, drawMode = false, onGeofenceDrawn },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerInstancesRef = useRef<maplibregl.Marker[]>([]);
  const drawRef = useRef<MapboxDraw | null>(null);
  const onGeofenceDrawnRef = useRef(onGeofenceDrawn);
  onGeofenceDrawnRef.current = onGeofenceDrawn;

  useImperativeHandle(ref, () => ({
    finishDrawing: () => {
      const map = mapRef.current;
      if (!map || !drawRef.current) return;
      map.getContainer().dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: osmRasterStyle,
      center: fallbackCenter,
      zoom: 13,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markerInstancesRef.current) {
      marker.remove();
    }
    markerInstancesRef.current = [];

    const bounds = new maplibregl.LngLatBounds();
    let hasPoint = false;

    for (const item of markers) {
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.2)";
      el.style.backgroundColor = STATUS_COLORS[item.status];
      el.style.cursor = "pointer";

      const popup = new maplibregl.Popup({ offset: 12 }).setHTML(item.popupHtml);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([item.longitude, item.latitude])
        .setPopup(popup)
        .addTo(map);

      markerInstancesRef.current.push(marker);
      bounds.extend([item.longitude, item.latitude]);
      hasPoint = true;
    }

    if (trajectory && trajectory.length > 0) {
      for (const point of trajectory) {
        bounds.extend(point);
      }
      hasPoint = true;
    }

    if (hasPoint) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 });
    }
  }, [markers, trajectory]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function applyTrajectory(target: maplibregl.Map) {
      if (target.getLayer(TRAJECTORY_SOURCE_ID)) {
        target.removeLayer(TRAJECTORY_SOURCE_ID);
      }
      if (target.getSource(TRAJECTORY_SOURCE_ID)) {
        target.removeSource(TRAJECTORY_SOURCE_ID);
      }

      if (!trajectory || trajectory.length < 2) {
        return;
      }

      target.addSource(TRAJECTORY_SOURCE_ID, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: trajectory } },
      });
      target.addLayer({
        id: TRAJECTORY_SOURCE_ID,
        type: "line",
        source: TRAJECTORY_SOURCE_ID,
        paint: { "line-color": "#2563eb", "line-width": 3 },
      });
    }

    if (map.isStyleLoaded()) {
      applyTrajectory(map);
    } else {
      map.once("load", () => applyTrajectory(map));
    }
  }, [trajectory]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function applyGeofences(target: maplibregl.Map) {
      const fillId = `${GEOFENCES_SOURCE_ID}-fill`;
      const outlineId = `${GEOFENCES_SOURCE_ID}-outline`;
      if (target.getLayer(fillId)) target.removeLayer(fillId);
      if (target.getLayer(outlineId)) target.removeLayer(outlineId);
      if (target.getSource(GEOFENCES_SOURCE_ID)) target.removeSource(GEOFENCES_SOURCE_ID);

      if (!geofences || geofences.length === 0) {
        return;
      }

      target.addSource(GEOFENCES_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: geofences.map((geofence) => ({
            type: "Feature",
            properties: { name: geofence.name },
            geometry: geofence.boundary,
          })),
        },
      });
      target.addLayer({
        id: fillId,
        type: "fill",
        source: GEOFENCES_SOURCE_ID,
        paint: { "fill-color": GEOFENCE_COLOR, "fill-opacity": 0.15 },
      });
      target.addLayer({
        id: outlineId,
        type: "line",
        source: GEOFENCES_SOURCE_ID,
        paint: { "line-color": GEOFENCE_COLOR, "line-width": 2 },
      });
    }

    if (map.isStyleLoaded()) {
      applyGeofences(map);
    } else {
      map.once("load", () => applyGeofences(map));
    }
  }, [geofences]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !drawMode) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: "draw_polygon",
      styles: mapboxDrawTheme,
    });
    drawRef.current = draw;
    map.addControl(draw as unknown as maplibregl.IControl);

    function handleCreate(event: MapboxDraw.DrawCreateEvent) {
      const feature = event.features[0];
      if (!feature || feature.geometry.type !== "Polygon") return;
      const ring = feature.geometry.coordinates[0];
      if (!ring) return;
      const points: LatLngPoint[] = ring.map((coordinate) => ({
        latitude: coordinate[1] as number,
        longitude: coordinate[0] as number,
      }));
      onGeofenceDrawnRef.current?.(points);
      draw.deleteAll();
    }

    map.on("draw.create", handleCreate);

    return () => {
      map.off("draw.create", handleCreate);
      map.removeControl(draw as unknown as maplibregl.IControl);
      drawRef.current = null;
    };
  }, [drawMode]);

  return <div ref={containerRef} className="h-full w-full" />;
});
