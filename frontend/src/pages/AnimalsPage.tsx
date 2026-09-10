import { useState } from "react";
import { Link } from "react-router-dom";
import { LoadingState } from "../components/LoadingState";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { useAnimals, useCreateAnimal, useDeactivateAnimal } from "../hooks/useAnimals";
import { useProperties } from "../hooks/useProperties";
import { ApiError } from "../api/client";
import type { AnimalSex, AnimalStatus } from "../types";

const STATUS_LABELS: Record<AnimalStatus, string> = {
  active: "Ativo",
  sold: "Vendido",
  deceased: "Morto",
  inactive: "Inativo",
};

const SEX_LABELS: Record<AnimalSex, string> = {
  male: "Macho",
  female: "Fêmea",
};

function NewAnimalForm({ onDone }: { onDone: () => void }) {
  const createAnimal = useCreateAnimal();
  const { data: properties } = useProperties();
  const [tagCode, setTagCode] = useState("");
  const [name, setName] = useState("");
  const [sex, setSex] = useState<AnimalSex | "">("");
  const [breed, setBreed] = useState("");
  const [propertyId, setPropertyId] = useState("");

  return (
    <form
      className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!tagCode.trim() || !propertyId) return;
        createAnimal.mutate(
          {
            tagCode: tagCode.trim(),
            name: name.trim() || undefined,
            sex: sex || undefined,
            breed: breed.trim() || undefined,
            propertyId,
          },
          {
            onSuccess: () => {
              setTagCode("");
              setName("");
              setSex("");
              setBreed("");
              setPropertyId("");
              onDone();
            },
          },
        );
      }}
    >
      <div>
        <label className="text-xs font-medium text-slate-500">Identificação (brinco)</label>
        <input
          type="text"
          required
          value={tagCode}
          onChange={(event) => setTagCode(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Nome (opcional)</label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Sexo</label>
        <select
          value={sex}
          onChange={(event) => setSex(event.target.value as AnimalSex | "")}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">—</option>
          {Object.entries(SEX_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Raça (opcional)</label>
        <input
          type="text"
          value={breed}
          onChange={(event) => setBreed(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Propriedade</label>
        <select
          required
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Selecione...</option>
          {properties?.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2 lg:col-span-3 xl:col-span-5">
        <button
          type="submit"
          disabled={createAnimal.isPending}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {createAnimal.isPending ? "Salvando..." : "Cadastrar"}
        </button>
        {createAnimal.isError && (
          <span className="ml-3 text-sm text-red-600">
            {createAnimal.error instanceof ApiError ? createAnimal.error.message : "Erro ao cadastrar animal."}
          </span>
        )}
      </div>
    </form>
  );
}

export function AnimalsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AnimalStatus | "">("active");
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading, error } = useAnimals({ search: search || undefined, status: status || undefined });
  const deactivateAnimal = useDeactivateAnimal();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Animais</h1>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "Cancelar" : "Novo animal"}
        </button>
      </div>

      {showForm && <NewAnimalForm onDone={() => setShowForm(false)} />}

      <div className="mt-4 flex gap-3">
        <input
          type="search"
          placeholder="Buscar por identificação ou nome"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as AnimalStatus | "")}
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
        {isLoading && <LoadingState label="Carregando animais..." />}
        {error && <ErrorState message={error instanceof ApiError ? error.message : "Erro desconhecido."} />}
        {data && data.length === 0 && (
          <EmptyState title="Nenhum animal encontrado" description="Ajuste os filtros ou cadastre um novo animal." />
        )}
        {data && data.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Identificação</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((animal) => (
                  <tr key={animal.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{animal.tagCode}</td>
                    <td className="px-4 py-3 text-slate-600">{animal.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{STATUS_LABELS[animal.status]}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link to={`/animals/${animal.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                          Ver detalhes
                        </Link>
                        {animal.status === "active" && (
                          <button
                            type="button"
                            title="Marca o animal como inativo (não exclui o histórico)"
                            onClick={() => deactivateAnimal.mutate(animal.id)}
                            disabled={deactivateAnimal.isPending}
                            className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            Remover
                          </button>
                        )}
                      </div>
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
