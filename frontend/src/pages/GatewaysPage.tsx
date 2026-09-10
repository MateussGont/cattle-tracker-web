import { useState } from "react";
import { LoadingState } from "../components/LoadingState";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { useCreateGateway, useGateways } from "../hooks/useGateways";
import { useProperties } from "../hooks/useProperties";
import { ApiError } from "../api/client";

function NewGatewayForm({ onDone }: { onDone: () => void }) {
  const createGateway = useCreateGateway();
  const { data: properties } = useProperties();
  const [name, setName] = useState("");
  const [gatewayIdentifier, setGatewayIdentifier] = useState("");
  const [propertyId, setPropertyId] = useState("");

  return (
    <form
      className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || !gatewayIdentifier.trim()) return;
        createGateway.mutate(
          { name: name.trim(), gatewayIdentifier: gatewayIdentifier.trim(), propertyId: propertyId || undefined },
          {
            onSuccess: () => {
              setName("");
              setGatewayIdentifier("");
              setPropertyId("");
              onDone();
            },
          },
        );
      }}
    >
      <div>
        <label className="text-xs font-medium text-slate-500">Nome</label>
        <input
          type="text"
          required
          placeholder="Receptor - Sede"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Identificador (GATEWAY_ID no secrets.h)</label>
        <input
          type="text"
          required
          placeholder="GATEWAY-0001"
          value={gatewayIdentifier}
          onChange={(event) => setGatewayIdentifier(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Propriedade (opcional)</label>
        <select
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">—</option>
          {properties?.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={createGateway.isPending}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {createGateway.isPending ? "Salvando..." : "Cadastrar"}
        </button>
      </div>
      {createGateway.isError && (
        <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-4">
          {createGateway.error instanceof ApiError ? createGateway.error.message : "Erro ao cadastrar gateway."}
        </p>
      )}
    </form>
  );
}

export function GatewaysPage() {
  const { data, isLoading, error } = useGateways();
  const { data: properties } = useProperties();
  const [showForm, setShowForm] = useState(false);

  const propertyName = (propertyId: string | null) =>
    propertyId ? (properties?.find((property) => property.id === propertyId)?.name ?? "—") : "—";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Gateways</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cada receptor LoRa físico cadastrado aqui — usado para escolher a quem um novo dispositivo pertence ao provisionar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "Cancelar" : "Novo gateway"}
        </button>
      </div>

      {showForm && <NewGatewayForm onDone={() => setShowForm(false)} />}

      <div className="mt-6">
        {isLoading && <LoadingState label="Carregando gateways..." />}
        {error && <ErrorState message={error instanceof ApiError ? error.message : "Erro desconhecido."} />}
        {data && data.length === 0 && (
          <EmptyState title="Nenhum gateway cadastrado" description="Cadastre o receptor antes de provisionar novos dispositivos." />
        )}
        {data && data.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Identificador</th>
                  <th className="px-4 py-3">Propriedade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((gateway) => (
                  <tr key={gateway.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{gateway.name}</td>
                    <td className="px-4 py-3 text-slate-600">{gateway.gatewayIdentifier}</td>
                    <td className="px-4 py-3 text-slate-600">{propertyName(gateway.propertyId)}</td>
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
