import { useState } from "react";
import { LoadingState } from "../components/LoadingState";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { DeviceProvisioningWizard } from "../components/DeviceProvisioningWizard";
import { useDevices, useLinkDeviceToAnimal, useRetireDevice, useUnlinkDeviceFromAnimal } from "../hooks/useDevices";
import { useAnimals } from "../hooks/useAnimals";
import { useGateways } from "../hooks/useGateways";
import { ApiError } from "../api/client";
import type { DeviceStatus } from "../types";

const STATUS_LABELS: Record<DeviceStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  maintenance: "Manutenção",
};

function LinkAnimalControl({ deviceId }: { deviceId: string }) {
  const { data: animals } = useAnimals({ status: "active" });
  const link = useLinkDeviceToAnimal();
  const [animalId, setAnimalId] = useState("");

  return (
    <form
      className="flex items-center justify-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (animalId) {
          link.mutate({ deviceId, animalId });
        }
      }}
    >
      <select
        value={animalId}
        onChange={(event) => setAnimalId(event.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
      >
        <option value="">Vincular a um animal...</option>
        {animals?.map((animal) => (
          <option key={animal.id} value={animal.id}>
            {animal.name ? `${animal.name} (${animal.tagCode})` : animal.tagCode}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!animalId || link.isPending}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
      >
        Vincular
      </button>
    </form>
  );
}

export function DevicesPage() {
  const [status, setStatus] = useState<DeviceStatus | "">("");
  const [showWizard, setShowWizard] = useState(false);
  const { data, isLoading, error } = useDevices({ status: status || undefined });
  const { data: gateways } = useGateways();
  const unlink = useUnlinkDeviceFromAnimal();
  const retire = useRetireDevice();

  const gatewayName = (gatewayId: string | null) =>
    gatewayId ? (gateways?.find((gateway) => gateway.id === gatewayId)?.name ?? "—") : "—";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Dispositivos</h1>
        <button
          type="button"
          onClick={() => setShowWizard((value) => !value)}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showWizard ? "Cancelar" : "Novo dispositivo"}
        </button>
      </div>

      {showWizard && <DeviceProvisioningWizard onClose={() => setShowWizard(false)} />}

      <div className="mt-4 flex gap-3">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as DeviceStatus | "")}
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

      <div className="mt-6">
        {isLoading && <LoadingState label="Carregando dispositivos..." />}
        {error && <ErrorState message={error instanceof ApiError ? error.message : "Erro desconhecido."} />}
        {data && data.length === 0 && (
          <EmptyState title="Nenhum dispositivo encontrado" description="Ajuste os filtros ou cadastre um novo dispositivo." />
        )}
        {data && data.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Comunicação</th>
                  <th className="px-4 py-3">Bateria</th>
                  <th className="px-4 py-3">Última comunicação</th>
                  <th className="px-4 py-3">Gateway</th>
                  <th className="px-4 py-3">Animal vinculado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((device) => (
                  <tr key={device.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{device.deviceIdentifier}</td>
                    <td className="px-4 py-3">
                      {device.communicationStatus && <StatusBadge status={device.communicationStatus} />}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{device.batteryLevel ?? "—"}%</td>
                    <td className="px-4 py-3 text-slate-600">
                      {device.lastSeen ? new Date(device.lastSeen).toLocaleString("pt-BR") : "Nunca"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{gatewayName(device.gatewayId)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {device.animal ? (
                        <div className="flex items-center justify-between gap-2">
                          <span>{device.animal.name ? `${device.animal.name} (${device.animal.tagCode})` : device.animal.tagCode}</span>
                          <button
                            type="button"
                            onClick={() => unlink.mutate(device.animal!.id)}
                            disabled={unlink.isPending}
                            className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            Desvincular
                          </button>
                        </div>
                      ) : (
                        <LinkAnimalControl deviceId={device.id} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {device.status !== "inactive" && (
                        <button
                          type="button"
                          title="Marca o dispositivo como inativo e desvincula de qualquer animal"
                          onClick={() => retire.mutate(device.id)}
                          disabled={retire.isPending}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                        >
                          Remover
                        </button>
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
