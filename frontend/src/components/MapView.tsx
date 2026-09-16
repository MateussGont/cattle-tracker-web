import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { osmRasterStyle } from "../lib/mapStyle";
import { createMapPopupContent } from "../lib/mapPopup";
import type { CommunicationStatus } from "../types";

export interface MapMarkerData {
  id: string;
  latitude: number;
  longitude: number;
  status: CommunicationStatus;
  title: string;
  details: string[];
}

interface MapViewProps {
  markers: MapMarkerData[];
  fallbackCenter?: [number, number];
}

const STATUS_COLORS: Record<CommunicationStatus, string> = {
  online: "#16a34a",
  attention: "#d97706",
  offline: "#dc2626",
  never_seen: "#6b7280",
};

const DEFAULT_CENTER: [number, number] = [-44.012345, -19.923456];

export function MapView({ markers, fallbackCenter = DEFAULT_CENTER }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerInstancesRef = useRef<maplibregl.Marker[]>([]);

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
    // The map is intentionally created once; later data only updates markers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const marker of markerInstancesRef.current) marker.remove();
    markerInstancesRef.current = [];

    const bounds = new maplibregl.LngLatBounds();
    for (const item of markers) {
      const element = document.createElement("div");
      element.setAttribute("aria-label", item.title);
      element.style.width = "16px";
      element.style.height = "16px";
      element.style.borderRadius = "50%";
      element.style.border = "2px solid white";
      element.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.2)";
      element.style.backgroundColor = STATUS_COLORS[item.status];
      element.style.cursor = "pointer";

      const marker = new maplibregl.Marker({ element })
        .setLngLat([item.longitude, item.latitude])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setDOMContent(createMapPopupContent(item)))
        .addTo(map);
      markerInstancesRef.current.push(marker);
      bounds.extend([item.longitude, item.latitude]);
    }
    if (markers.length > 0) map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 });
  }, [markers]);

  return <div ref={containerRef} className="h-full w-full" />;
}
