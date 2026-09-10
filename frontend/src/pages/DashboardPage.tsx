import { StatCard } from "../components/StatCard";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/EmptyState";
import { useDashboardSummary } from "../hooks/useDashboard";
import { ApiError } from "../api/client";

export function DashboardPage() {
  const { data, isLoading, error } = useDashboardSummary();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Visão geral do rebanho</h1>
      <p className="mt-1 text-sm text-slate-500">Atualizado automaticamente conforme os dispositivos comunicam.</p>

      <div className="mt-6">
        {isLoading && <LoadingState label="Carregando resumo..." />}
        {error && <ErrorState message={error instanceof ApiError ? error.message : "Erro desconhecido."} />}
        {data && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total de animais" value={data.totalAnimals} />
            <StatCard label="Online" value={data.online} tone="online" />
            <StatCard label="Atenção" value={data.attention} tone="attention" />
            <StatCard label="Offline" value={data.offline} tone="offline" />
            <StatCard label="Bateria baixa" value={data.lowBattery} tone="attention" />
          </div>
        )}
      </div>
    </div>
  );
}
