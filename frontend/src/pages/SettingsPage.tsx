import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/EmptyState";
import { useSettings } from "../hooks/useDashboard";
import { ApiError } from "../api/client";

export function SettingsPage() {
  const { data, isLoading, error } = useSettings();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Configurações</h1>
      <p className="mt-1 text-sm text-slate-500">
        Limiares usados para calcular o status de comunicação e os alertas de bateria — definidos no backend, nunca fixos na tela.
      </p>

      <div className="mt-6">
        {isLoading && <LoadingState label="Carregando configurações..." />}
        {error && <ErrorState message={error instanceof ApiError ? error.message : "Erro desconhecido."} />}
        {data && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {data.map((setting) => (
                  <tr key={setting.key}>
                    <td className="px-4 py-3 font-medium text-slate-900">{setting.description ?? setting.key}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{JSON.stringify(setting.value)}</td>
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
