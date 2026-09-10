import { useState } from "react";
import { LoadingState } from "../components/LoadingState";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { useCreateProperty, useProperties } from "../hooks/useProperties";
import { ApiError } from "../api/client";

function NewPropertyForm({ onDone }: { onDone: () => void }) {
  const createProperty = useCreateProperty();
  const [name, setName] = useState("");

  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        createProperty.mutate(
          { name: name.trim() },
          { onSuccess: () => { setName(""); onDone(); } },
        );
      }}
    >
      <div>
        <label className="text-xs font-medium text-slate-500">Nome da propriedade</label>
        <input
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-72 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={createProperty.isPending}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {createProperty.isPending ? "Salvando..." : "Cadastrar"}
      </button>
      {createProperty.isError && (
        <p className="w-full text-sm text-red-600">
          {createProperty.error instanceof ApiError ? createProperty.error.message : "Erro ao cadastrar propriedade."}
        </p>
      )}
    </form>
  );
}

export function PropertiesPage() {
  const { data, isLoading, error } = useProperties();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Propriedades</h1>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "Cancelar" : "Nova propriedade"}
        </button>
      </div>

      {showForm && <NewPropertyForm onDone={() => setShowForm(false)} />}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <LoadingState label="Carregando propriedades..." />}
        {error && <ErrorState message={error instanceof ApiError ? error.message : "Erro desconhecido."} />}
        {data && data.length === 0 && <EmptyState title="Nenhuma propriedade cadastrada" />}
        {data?.map((property) => (
          <div key={property.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="font-medium text-slate-900">{property.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {property.areaHectares ? `${property.areaHectares} hectares` : "Área não informada"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
