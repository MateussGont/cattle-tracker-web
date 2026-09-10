import { useState } from "react";
import { LoadingState } from "../components/LoadingState";
import { EmptyState, ErrorState } from "../components/EmptyState";
import {
  useAlertRules,
  useCreateAlertRule,
  useDeleteAlertRule,
  useProperties,
  useUpdateAlertRule,
} from "../hooks/useProperties";
import { useDevices } from "../hooks/useDevices";
import { useGateways } from "../hooks/useGateways";
import { ApiError } from "../api/client";
import type { AlertRule, AlertRuleMetric, AlertSeverity } from "../types";

const METRIC_LABELS: Record<AlertRuleMetric, string> = {
  battery_level: "Bateria abaixo de",
  device_offline_minutes: "Dispositivo sem comunicação há mais de",
  gps_stale_minutes: "GPS parado há mais de",
  gateway_offline_minutes: "Gateway sem comunicação há mais de",
};

const METRIC_UNIT: Record<AlertRuleMetric, string> = {
  battery_level: "%",
  device_offline_minutes: "min",
  gps_stale_minutes: "min",
  gateway_offline_minutes: "min",
};

const METRIC_CONDITION_SYMBOL: Record<AlertRuleMetric, string> = {
  battery_level: "<",
  device_offline_minutes: ">",
  gps_stale_minutes: ">",
  gateway_offline_minutes: ">",
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  info: "Informativo",
  warning: "Aviso",
  critical: "Crítico",
};

function AlertRuleForm({
  propertyId,
  initialRule,
  onDone,
  onCancel,
}: {
  propertyId: string;
  initialRule?: AlertRule;
  onDone: () => void;
  onCancel: () => void;
}) {
  const createRule = useCreateAlertRule(propertyId);
  const updateRule = useUpdateAlertRule(propertyId);
  const { data: devices } = useDevices();
  const { data: gateways } = useGateways();

  const [name, setName] = useState(initialRule?.name ?? "");
  const [metric, setMetric] = useState<AlertRuleMetric>(initialRule?.metric ?? "battery_level");
  const [thresholdValue, setThresholdValue] = useState(String(initialRule?.thresholdValue ?? 20));
  const [severity, setSeverity] = useState<AlertSeverity>(initialRule?.severity ?? "warning");
  const [deviceId, setDeviceId] = useState(initialRule?.deviceId ?? "");
  const [gatewayId, setGatewayId] = useState(initialRule?.gatewayId ?? "");

  const isGatewayMetric = metric === "gateway_offline_minutes";
  const mutation = initialRule ? updateRule : createRule;

  return (
    <form
      className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-6"
      onSubmit={(event) => {
        event.preventDefault();
        const threshold = Number(thresholdValue);
        if (!name.trim() || !Number.isFinite(threshold) || threshold <= 0) return;

        const input = {
          name: name.trim(),
          metric,
          thresholdValue: threshold,
          severity,
          deviceId: !isGatewayMetric && deviceId ? deviceId : undefined,
          gatewayId: isGatewayMetric && gatewayId ? gatewayId : undefined,
        };

        if (initialRule) {
          updateRule.mutate({ ruleId: initialRule.id, input }, { onSuccess: onDone });
        } else {
          createRule.mutate(input, {
            onSuccess: () => {
              setName("");
              setThresholdValue("20");
              setDeviceId("");
              setGatewayId("");
              onDone();
            },
          });
        }
      }}
    >
      <div className="xl:col-span-2">
        <label className="text-xs font-medium text-slate-500">Nome</label>
        <input
          type="text"
          required
          placeholder="Ex.: Bateria crítica"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Métrica</label>
        <select
          value={metric}
          onChange={(event) => {
            const nextMetric = event.target.value as AlertRuleMetric;
            setMetric(nextMetric);
            setDeviceId("");
            setGatewayId("");
          }}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {(Object.keys(METRIC_LABELS) as AlertRuleMetric[]).map((value) => (
            <option key={value} value={value}>
              {METRIC_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Limite ({METRIC_UNIT[metric]})</label>
        <input
          type="number"
          required
          min={0}
          step="any"
          value={thresholdValue}
          onChange={(event) => setThresholdValue(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Severidade</label>
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value as AlertSeverity)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {(Object.keys(SEVERITY_LABELS) as AlertSeverity[]).map((value) => (
            <option key={value} value={value}>
              {SEVERITY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">
          {isGatewayMetric ? "Gateway" : "Dispositivo"}
        </label>
        {isGatewayMetric ? (
          <select
            value={gatewayId}
            onChange={(event) => setGatewayId(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {gateways?.map((gateway) => (
              <option key={gateway.id} value={gateway.id}>
                {gateway.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {devices?.map((device) => (
              <option key={device.id} value={device.id}>
                {device.deviceIdentifier}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-end gap-2 xl:col-span-6">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {mutation.isPending ? "Salvando..." : initialRule ? "Salvar alterações" : "Criar regra"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </button>
      </div>
      {mutation.isError && (
        <p className="text-sm text-red-600 xl:col-span-6">
          {mutation.error instanceof ApiError ? mutation.error.message : "Erro ao salvar regra."}
        </p>
      )}
    </form>
  );
}

export function AlertRulesPage() {
  const { data: properties } = useProperties();
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const propertyId = selectedPropertyId || properties?.[0]?.id;

  const { data: rules, isLoading, error } = useAlertRules(propertyId);
  const { data: devices } = useDevices();
  const { data: gateways } = useGateways();
  const updateRule = useUpdateAlertRule(propertyId);
  const deleteRule = useDeleteAlertRule(propertyId);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const scopeLabel = (rule: AlertRule) => {
    if (rule.metric === "gateway_offline_minutes") {
      if (!rule.gatewayId) return "Todos os gateways";
      return gateways?.find((gateway) => gateway.id === rule.gatewayId)?.name ?? "—";
    }
    if (!rule.deviceId) return "Todos os dispositivos";
    return devices?.find((device) => device.id === rule.deviceId)?.deviceIdentifier ?? "—";
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Regras de alerta</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure quando o sistema deve avisar sobre bateria, comunicação de dispositivos e gateways, e GPS desatualizado.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {properties && properties.length > 1 && (
            <select
              value={propertyId ?? ""}
              onChange={(event) => setSelectedPropertyId(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => {
              setEditingRuleId(null);
              setShowCreateForm((value) => !value);
            }}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {showCreateForm ? "Cancelar" : "Nova regra"}
          </button>
        </div>
      </div>

      {showCreateForm && propertyId && (
        <AlertRuleForm propertyId={propertyId} onDone={() => setShowCreateForm(false)} onCancel={() => setShowCreateForm(false)} />
      )}

      <div className="mt-6">
        {isLoading && <LoadingState label="Carregando regras..." />}
        {error && <ErrorState message={error instanceof ApiError ? error.message : "Erro desconhecido."} />}
        {rules && rules.length === 0 && (
          <EmptyState title="Nenhuma regra cadastrada" description="Crie uma regra para começar a receber alertas." />
        )}
        {rules && rules.length > 0 && propertyId && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Métrica</th>
                  <th className="px-4 py-3">Condição</th>
                  <th className="px-4 py-3">Severidade</th>
                  <th className="px-4 py-3">Escopo</th>
                  <th className="px-4 py-3">Ativo</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((rule) =>
                  editingRuleId === rule.id ? (
                    <tr key={rule.id}>
                      <td colSpan={7} className="p-0">
                        <AlertRuleForm
                          propertyId={propertyId}
                          initialRule={rule}
                          onDone={() => setEditingRuleId(null)}
                          onCancel={() => setEditingRuleId(null)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={rule.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{rule.name}</td>
                      <td className="px-4 py-3 text-slate-600">{METRIC_LABELS[rule.metric]}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {METRIC_CONDITION_SYMBOL[rule.metric]} {rule.thresholdValue}
                        {METRIC_UNIT[rule.metric]}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{SEVERITY_LABELS[rule.severity]}</td>
                      <td className="px-4 py-3 text-slate-600">{scopeLabel(rule)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={updateRule.isPending}
                          onClick={() => updateRule.mutate({ ruleId: rule.id, input: { enabled: !rule.enabled } })}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            rule.enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {rule.enabled ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateForm(false);
                              setEditingRuleId(rule.id);
                            }}
                            className="text-sm text-slate-700 hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={deleteRule.isPending}
                            onClick={() => deleteRule.mutate(rule.id)}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
