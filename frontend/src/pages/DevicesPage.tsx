import { useState } from "react";
import { ApiError } from "../api/client";
import { DeviceProvisioningWizard } from "../components/DeviceProvisioningWizard";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { StatusBadge } from "../components/StatusBadge";
import { useDevices, useRetireDevice } from "../hooks/useDevices";
import type { DeviceStatus } from "../types";

const STATUS_LABELS: Record<DeviceStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  maintenance: "Em configuração",
};

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("pt-BR") : "Nunca";
}

export function DevicesPage() {
  const [status, setStatus] = useState<DeviceStatus | "">("");
  const [showWizard, setShowWizard] = useState(false);
  const { data, isLoading, error } = useDevices({ status: status || undefined });
  const retire = useRetireDevice();

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Brincos</h1>
          <p className="mt-1 text-sm text-slate-500">Inventário técnico para provisionamento e validação de telemetria.</p>
        </div>
        <button type="button" onClick={() => setShowWizard((value) => !value)} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
          {showWizard ? "Cancelar" : "Registrar brinco"}
        </button>
      </div>

      {showWizard && <DeviceProvisioningWizard onClose={() => setShowWizard(false)} />}

      <div className="mt-4">
        <select value={status} onChange={(event) => setStatus(event.target.value as DeviceStatus | "")} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os estados</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="mt-6">
        {isLoading && <LoadingState label="Carregando brincos..." />}
        {error && <ErrorState message={error instanceof ApiError ? error.message : "Erro desconhecido."} />}
        {data?.length === 0 && <EmptyState title="Nenhum brinco registrado" description="Conecte uma unidade pela USB para iniciar a validação." />}
        {data && data.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Brinco</th>
                  <th className="px-4 py-3">Identidade técnica</th>
                  <th className="px-4 py-3">Comunicação</th>
                  <th className="px-4 py-3">Último dado</th>
                  <th className="px-4 py-3">Firmware</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((device) => (
                  <tr key={device.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{device.deviceIdentifier}</p>
                      <p className="text-xs text-slate-500">{STATUS_LABELS[device.status]}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>LoRa {device.radioDeviceId}</p>
                      <p className="font-mono text-xs">{device.hardwareUid ?? "UID não informado"}</p>
                    </td>
                    <td className="px-4 py-3">{device.communicationStatus && <StatusBadge status={device.communicationStatus} />}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>{formatDateTime(device.lastSeen)}</p>
                      <p className="text-xs">Bateria: {device.batteryLevel ?? "—"}%</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{device.firmwareVersion ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {device.status !== "inactive" && (
                        <button type="button" onClick={() => retire.mutate(device.id)} disabled={retire.isPending} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-60">Desativar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
