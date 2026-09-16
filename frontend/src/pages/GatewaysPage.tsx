import { ApiError } from "../api/client";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { useGateways } from "../hooks/useGateways";

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("pt-BR") : "Ainda não observada";
}

export function GatewaysPage() {
  const { data, isLoading, error } = useGateways();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Gateway</h1>
      <p className="mt-1 text-sm text-slate-500">Visão mínima da recepção usada nos testes de bancada.</p>

      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-medium">Contrato atual</p>
        <p className="mt-1">
          A API informa o identificador e a última comunicação observada pelo backend. Um heartbeat próprio do gateway será adicionado quando o contrato do receptor estiver definido; ausência de pacote de brinco ainda não comprova que o gateway está offline.
        </p>
      </div>

      <div className="mt-6">
        {isLoading && <LoadingState label="Consultando gateway..." />}
        {error && <ErrorState message={error instanceof ApiError ? error.message : "Erro desconhecido."} />}
        {data?.length === 0 && <EmptyState title="Gateway ainda não preparado" description="O registro técnico será criado na preparação do ambiente de bancada." />}
        {data && data.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Identificador</th>
                  <th className="px-4 py-3">Última comunicação observada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((gateway) => (
                  <tr key={gateway.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{gateway.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{gateway.gatewayIdentifier}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(gateway.lastSeen)}</td>
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
