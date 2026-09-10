import { useState } from "react";
import { Link } from "react-router-dom";
import { LoadingState } from "../components/LoadingState";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { useAlerts, useUpdateAlertStatus } from "../hooks/useAlerts";
import { ApiError } from "../api/client";
import type { AlertSeverity, AlertStatus, AlertType } from "../types";

const SEVERITY_CLASSES: Record<AlertSeverity, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<AlertStatus, string> = {
  open: "Aberto",
  acknowledged: "Reconhecido",
  resolved: "Resolvido",
};

const TYPE_LABELS: Record<AlertType, string> = {
  geofence_exit: "Fora da cerca",
  device_offline: "Dispositivo offline",
  low_battery: "Bateria baixa",
  gps_stale: "GPS desatualizado",
  no_communication: "Sem comunicação",
  gateway_offline: "Gateway offline",
  other: "Outro",
};

export function AlertsPage() {
  const [status, setStatus] = useState<AlertStatus | "">("open");
  const { data, isLoading, error } = useAlerts({ status: status || undefined });
  const updateStatus = useUpdateAlertStatus();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Alertas</h1>
        <Link
          to="/alert-rules"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Gerenciar regras
        </Link>
      </div>

      <div className="mt-4">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as AlertStatus | "")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading && <LoadingState label="Carregando alertas..." />}
        {error && <ErrorState message={error instanceof ApiError ? error.message : "Erro desconhecido."} />}
        {data && data.length === 0 && (
          <EmptyState
            title={status === "open" ? "Nenhum alerta em aberto" : "Nenhum alerta encontrado"}
            description="Tudo certo por aqui, ou ajuste o filtro de status."
          />
        )}
        {data?.map((alert) => (
          <div key={alert.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_CLASSES[alert.severity]}`}>
                {alert.severity}
              </span>
              <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {STATUS_LABELS[alert.status]}
              </span>
              <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {TYPE_LABELS[alert.type]}
              </span>
              <p className="mt-1 text-sm text-slate-800">{alert.message}</p>
              <p className="text-xs text-slate-500">{new Date(alert.triggeredAt).toLocaleString("pt-BR")}</p>
            </div>
            {alert.status !== "resolved" && (
              <div className="flex gap-2">
                {alert.status !== "acknowledged" && (
                  <button
                    type="button"
                    onClick={() => updateStatus.mutate({ id: alert.id, status: "acknowledged" })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Reconhecer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => updateStatus.mutate({ id: alert.id, status: "resolved" })}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
                >
                  Resolver
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
