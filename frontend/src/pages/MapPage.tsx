import { useMemo, useRef, useState } from "react";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/EmptyState";
import { MapView, type LatLngPoint, type MapMarkerData, type MapViewHandle } from "../components/MapView";
import { useMapAnimals } from "../hooks/useDashboard";
import { useCreateGeofence, useDeleteGeofence, useGeofences, useProperties } from "../hooks/useProperties";
import { ApiError } from "../api/client";

function formatDateTime(value: string | null): string {
  if (!value) return "Nunca";
  return new Date(value).toLocaleString("pt-BR");
}

function buildPopupHtml(marker: { animalId: string; tagCode: string; name: string | null; batteryLevel: number | null; latitude: number | null; longitude: number | null; lastSeen: string | null }): string {
  const title = marker.name ? `${marker.name} (${marker.tagCode})` : marker.tagCode;
  return `
    <div style="font-family: system-ui, sans-serif; min-width: 200px;">
      <p style="font-weight: 600; margin: 0 0 4px;">${title}</p>
      <p style="margin: 0; font-size: 12px; color: #475569;">Última localização: ${formatDateTime(marker.lastSeen)}</p>
      <p style="margin: 0; font-size: 12px; color: #475569;">Bateria: ${marker.batteryLevel ?? "—"}%</p>
      <p style="margin: 0; font-size: 12px; color: #475569;">Lat: ${marker.latitude?.toFixed(6) ?? "—"} · Lon: ${marker.longitude?.toFixed(6) ?? "—"}</p>
      <div style="margin-top: 8px; display: flex; gap: 8px;">
        <a href="/animals/${marker.animalId}" style="font-size: 12px; color: #2563eb; font-weight: 600;">VER DETALHES</a>
        <a href="/history?animalId=${marker.animalId}" style="font-size: 12px; color: #2563eb; font-weight: 600;">VER HISTÓRICO</a>
      </div>
    </div>
  `;
}

function NewGeofenceForm({
  propertyId,
  points,
  onDone,
  onCancel,
}: {
  propertyId: string;
  points: LatLngPoint[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const createGeofence = useCreateGeofence(propertyId);
  const [name, setName] = useState("");

  return (
    <form
      className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-white px-6 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        createGeofence.mutate(
          { name: name.trim(), boundary: points },
          { onSuccess: onDone },
        );
      }}
    >
      <div>
        <label className="text-xs font-medium text-slate-500">Nome da cerca</label>
        <input
          type="text"
          required
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-72 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={createGeofence.isPending}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {createGeofence.isPending ? "Salvando..." : "Salvar cerca"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
      >
        Cancelar
      </button>
      {createGeofence.isError && (
        <p className="w-full text-sm text-red-600">
          {createGeofence.error instanceof ApiError ? createGeofence.error.message : "Erro ao salvar cerca."}
        </p>
      )}
    </form>
  );
}

export function MapPage() {
  const { data, isLoading, error } = useMapAnimals();
  const { data: properties } = useProperties();
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [drawMode, setDrawMode] = useState(false);
  const [pendingPoints, setPendingPoints] = useState<LatLngPoint[] | null>(null);

  const propertyId = selectedPropertyId || properties?.[0]?.id;
  const { data: geofences } = useGeofences(propertyId);
  const deleteGeofence = useDeleteGeofence(propertyId);
  const mapViewRef = useRef<MapViewHandle>(null);

  const markers = useMemo<MapMarkerData[]>(() => {
    if (!data) return [];
    return data
      .filter((marker) => marker.latitude !== null && marker.longitude !== null)
      .map((marker) => ({
        id: marker.animalId,
        latitude: marker.latitude as number,
        longitude: marker.longitude as number,
        status: marker.communicationStatus,
        popupHtml: buildPopupHtml(marker),
      }));
  }, [data]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Mapa</h1>
            <p className="text-sm text-slate-500">{markers.length} animal(is) com posição conhecida.</p>
          </div>
          <div className="flex items-center gap-3">
            {properties && properties.length > 1 && (
              <select
                value={propertyId ?? ""}
                onChange={(event) => setSelectedPropertyId(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            )}
            {propertyId && !drawMode && !pendingPoints && (
              <button
                type="button"
                onClick={() => setDrawMode(true)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Nova cerca
              </button>
            )}
            {drawMode && (
              <>
                <button
                  type="button"
                  onClick={() => mapViewRef.current?.finishDrawing()}
                  className="rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800"
                >
                  Concluir cerca
                </button>
                <button
                  type="button"
                  onClick={() => setDrawMode(false)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Cancelar desenho
                </button>
              </>
            )}
          </div>
        </div>
        {drawMode && (
          <p className="mt-2 text-sm text-violet-700">
            Clique no mapa marcando os pontos do perímetro da cerca (pelo menos 3) e depois clique em "Concluir
            cerca".
          </p>
        )}
      </div>

      {pendingPoints && propertyId && (
        <NewGeofenceForm
          propertyId={propertyId}
          points={pendingPoints}
          onDone={() => setPendingPoints(null)}
          onCancel={() => setPendingPoints(null)}
        />
      )}

      <div className="flex-1">
        {isLoading && <LoadingState label="Carregando posições..." />}
        {error && <ErrorState message={error instanceof ApiError ? error.message : "Erro desconhecido."} />}
        {data && (
          <MapView
            ref={mapViewRef}
            markers={markers}
            geofences={geofences}
            drawMode={drawMode}
            onGeofenceDrawn={(points) => {
              setPendingPoints(points);
              setDrawMode(false);
            }}
          />
        )}
      </div>

      {geofences && geofences.length > 0 && (
        <div className="max-h-48 overflow-y-auto border-t border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Cerca</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {geofences.map((geofence) => (
                <tr key={geofence.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{geofence.name}</td>
                  <td className="px-4 py-2 text-slate-600">{geofence.active ? "Ativa" : "Inativa"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => deleteGeofence.mutate(geofence.id)}
                      disabled={deleteGeofence.isPending}
                      className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
