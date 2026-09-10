import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/EmptyState";
import { useAnimal, useAnimalLocation, useAssignDevice, useUnassignDevice } from "../hooks/useAnimals";
import { useDevices } from "../hooks/useDevices";
import { ApiError } from "../api/client";

export function AnimalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: animal, isLoading, error } = useAnimal(id);
  const { data: location } = useAnimalLocation(id);
  const { data: devices } = useDevices({ status: "active" });
  const assignDevice = useAssignDevice(id ?? "");
  const unassignDevice = useUnassignDevice(id ?? "");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  if (isLoading) return <LoadingState label="Carregando animal..." />;
  if (error) return <ErrorState message={error instanceof ApiError ? error.message : "Erro desconhecido."} />;
  if (!animal) return null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{animal.name ?? animal.tagCode}</h1>
          <p className="text-sm text-slate-500">{animal.tagCode}</p>
        </div>
        <Link to={`/history?animalId=${animal.id}`} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Ver histórico
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium text-slate-900">Dados do animal</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Sexo</dt><dd>{animal.sex ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Raça</dt><dd>{animal.breed ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd>{animal.status}</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium text-slate-900">Localização mais recente</h2>
          {location ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Data/hora</dt><dd>{new Date(location.recordedAt).toLocaleString("pt-BR")}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Latitude</dt><dd>{location.latitude.toFixed(6)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Longitude</dt><dd>{location.longitude.toFixed(6)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Bateria</dt><dd>{location.batteryLevel ?? "—"}%</dd></div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Nenhuma localização registrada ainda.</p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="font-medium text-slate-900">Dispositivo</h2>
          {animal.device ? (
            <div className="mt-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-slate-900">{animal.device.deviceIdentifier}</p>
                <p className="text-slate-500">Status: {animal.device.status}</p>
              </div>
              <button
                type="button"
                onClick={() => unassignDevice.mutate()}
                disabled={unassignDevice.isPending}
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Desassociar
              </button>
            </div>
          ) : (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (selectedDeviceId) {
                  assignDevice.mutate(selectedDeviceId);
                  setSelectedDeviceId("");
                }
              }}
            >
              <select
                required
                value={selectedDeviceId}
                onChange={(event) => setSelectedDeviceId(event.target.value)}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Selecione um dispositivo...</option>
                {devices?.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.deviceIdentifier}
                    {device.animal ? ` (vinculado a ${device.animal.tagCode} — será transferido)` : ""}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={assignDevice.isPending || !selectedDeviceId}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                Associar
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
