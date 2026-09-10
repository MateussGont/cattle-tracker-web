import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LoadingState } from "../components/LoadingState";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { MapView } from "../components/MapView";
import { useAnimalHistory, useAnimals } from "../hooks/useAnimals";
import { ApiError } from "../api/client";
import { pathDistanceMeters } from "../utils/distance";

type Period = "today" | "24h" | "7d" | "30d";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoje",
  "24h": "Últimas 24 horas",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
};

function periodToFrom(period: Period): string {
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  const hours = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 }[period];
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

export function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const animalId = searchParams.get("animalId") ?? undefined;
  const [period, setPeriod] = useState<Period>("7d");

  const { data: animals } = useAnimals();
  // periodToFrom(period) uses `new Date()`, so it must be memoized on `period`
  // alone — recomputing it inline on every render produced a new `from`
  // string (and therefore a new React Query cache key) each time, which
  // triggered an immediate refetch -> re-render -> new `from` value again,
  // an infinite request loop that flooded the backend's rate limiter.
  const from = useMemo(() => periodToFrom(period), [period]);
  const { data: history, isLoading, error } = useAnimalHistory(animalId, { from, limit: 2000 });

  const trajectory = useMemo<[number, number][]>(() => {
    if (!history) return [];
    return [...history].reverse().map((point) => [point.longitude, point.latitude] as [number, number]);
  }, [history]);

  const distanceKm = useMemo(() => pathDistanceMeters(trajectory) / 1000, [trajectory]);
  const first = history?.[history.length - 1];
  const last = history?.[0];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-slate-900">Histórico de localização</h1>
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            value={animalId ?? ""}
            onChange={(event) => setSearchParams(event.target.value ? { animalId: event.target.value } : {})}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Selecione um animal</option>
            {animals?.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.name ? `${animal.name} (${animal.tagCode})` : animal.tagCode}
              </option>
            ))}
          </select>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {Object.entries(PERIOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!animalId && <EmptyState title="Selecione um animal" description="Escolha um animal para ver o histórico de localização." />}
      {animalId && isLoading && <LoadingState label="Carregando histórico..." />}
      {animalId && error && <ErrorState message={error instanceof ApiError ? error.message : "Erro desconhecido."} />}
      {animalId && history && history.length === 0 && (
        <EmptyState title="Sem registros no período" description="Tente um período maior." />
      )}

      {animalId && history && history.length > 0 && (
        <div className="flex flex-1 flex-col lg:flex-row">
          <div className="flex-1">
            <MapView markers={[]} trajectory={trajectory} />
          </div>
          <aside className="w-full space-y-3 border-t border-slate-200 bg-white p-4 lg:w-72 lg:border-l lg:border-t-0">
            <div>
              <p className="text-xs uppercase text-slate-500">Distância percorrida</p>
              <p className="text-lg font-semibold text-slate-900">{distanceKm.toFixed(2)} km</p>
            </div>
            {first && (
              <div>
                <p className="text-xs uppercase text-slate-500">Primeira posição</p>
                <p className="text-sm text-slate-700">{new Date(first.recordedAt).toLocaleString("pt-BR")}</p>
              </div>
            )}
            {last && (
              <div>
                <p className="text-xs uppercase text-slate-500">Última posição</p>
                <p className="text-sm text-slate-700">{new Date(last.recordedAt).toLocaleString("pt-BR")}</p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase text-slate-500">Pontos registrados</p>
              <p className="text-sm text-slate-700">{history.length}</p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
