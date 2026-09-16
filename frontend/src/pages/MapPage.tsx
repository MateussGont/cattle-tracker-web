import { useMemo } from "react";
import { ApiError } from "../api/client";
import { ErrorState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { MapView, type MapMarkerData } from "../components/MapView";
import { useDeviceMapMarkers } from "../hooks/useMap";

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("pt-BR") : "Nunca";
}

export function MapPage() {
  const { data, isLoading, error } = useDeviceMapMarkers();
  const markers = useMemo<MapMarkerData[]>(() => (data ?? [])
    .filter((device) => device.latitude !== null && device.longitude !== null)
    .map((device) => ({
      id: device.deviceId,
      latitude: device.latitude as number,
      longitude: device.longitude as number,
      status: device.communicationStatus,
      title: device.deviceIdentifier,
      details: [
        `ID LoRa: ${device.radioDeviceId}`,
        `Última comunicação: ${formatDateTime(device.lastSeen)}`,
        `Bateria: ${device.batteryLevel ?? "—"}%`,
      ],
    })), [data]);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-slate-900">Mapa dos brincos</h1>
        <p className="text-sm text-slate-500">
          {markers.length} brinco(s) com posição GNSS conhecida. Sem animais ou cercas virtuais neste MVP.
        </p>
      </header>
      <div className="flex-1">
        {isLoading && <LoadingState label="Carregando posições dos brincos..." />}
        {error && <ErrorState message={error instanceof ApiError ? error.message : "Erro desconhecido."} />}
        {data && <MapView markers={markers} />}
      </div>
    </div>
  );
}
