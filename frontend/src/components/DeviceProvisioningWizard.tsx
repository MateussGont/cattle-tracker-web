import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../api/client";
import {
  confirmProvisioning,
  markProvisioningConfigured,
  startProvisioning,
  type ProvisioningProof,
  type ProvisioningSession,
} from "../api/provisioning";
import { useAnimals } from "../hooks/useAnimals";
import { useLinkDeviceToAnimal } from "../hooks/useDevices";
import { useGateways } from "../hooks/useGateways";
import {
  flashCollarFirmware,
  getDeviceInfo,
  isWebSerialSupported,
  provisionDevice,
  type DeviceInfoMessage,
  type FlashProgress,
} from "../lib/deviceProvisioning";

type Step = 1 | 2 | 3 | 4;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

function proofFrom(session: ProvisioningSession): ProvisioningProof {
  return {
    hardwareUid: session.hardwareUid,
    radioDeviceId: session.radioDeviceId,
    configRevision: session.configRevision,
    firmwareVersion: session.firmwareVersion,
  };
}

function matchesSession(info: DeviceInfoMessage, session: ProvisioningSession): boolean {
  return info.provisioned && info.hardwareUid === session.hardwareUid &&
    info.radioDeviceId === session.radioDeviceId && info.configRevision === session.configRevision &&
    info.firmwareVersion === session.firmwareVersion;
}

export function DeviceProvisioningWizard({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: gateways } = useGateways();
  const { data: animals } = useAnimals({ status: "active" });
  const linkDevice = useLinkDeviceToAnimal();

  const [step, setStep] = useState<Step>(1);
  const [port, setPort] = useState<SerialPort | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfoMessage | null>(null);
  const [session, setSession] = useState<ProvisioningSession | null>(null);
  const [deviceIdentifier, setDeviceIdentifier] = useState("");
  const [hardwareModel, setHardwareModel] = useState("XIAO ESP32-S3 + Wio-SX1262");
  const [gatewayId, setGatewayId] = useState("");
  const [animalId, setAnimalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashProgress, setFlashProgress] = useState<FlashProgress | null>(null);
  const [complete, setComplete] = useState(false);

  async function connectAndIdentify() {
    setError(null);
    setBusy(true);
    try {
      const selectedPort = port ?? await navigator.serial.requestPort();
      setPort(selectedPort);
      const info = await getDeviceInfo(selectedPort);
      setDeviceInfo(info);
      setStep(2);
    } catch (caught) {
      if (caught instanceof Error && caught.name === "NotFoundError") return;
      setError(errorMessage(caught, "Não foi possível identificar o dispositivo."));
    } finally {
      setBusy(false);
    }
  }

  async function flashFirmware() {
    if (!port) return;
    setError(null);
    setBusy(true);
    setFlashProgress(null);
    try {
      await flashCollarFirmware(port, setFlashProgress);
      setDeviceInfo(null);
    } catch (caught) {
      setError(errorMessage(caught, "Falha ao atualizar o firmware."));
    } finally {
      setBusy(false);
    }
  }

  async function reserveAndConfigure() {
    if (!port || !deviceInfo) return;
    setError(null);
    setBusy(true);
    try {
      const reserved = await startProvisioning({
        idempotencyKey: crypto.randomUUID(),
        hardwareUid: deviceInfo.hardwareUid,
        firmwareVersion: deviceInfo.firmwareVersion,
        deviceIdentifier: deviceIdentifier.trim(),
        hardwareModel: hardwareModel.trim() || undefined,
        gatewayId: gatewayId || undefined,
      });
      setSession(reserved);
      const configured = await provisionDevice(port, {
        hardwareUid: reserved.hardwareUid,
        radioDeviceId: reserved.radioDeviceId,
        configRevision: reserved.configRevision,
      });
      if (!matchesSession(configured, reserved)) {
        throw new Error("O brinco respondeu com uma identidade diferente da reservada.");
      }
      await markProvisioningConfigured(reserved.id, proofFrom(reserved));
      setDeviceInfo(configured);
      setStep(4);
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível configurar o dispositivo."));
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndConfirm() {
    if (!port || !session) return;
    setError(null);
    setBusy(true);
    try {
      const verified = await getDeviceInfo(port);
      if (!matchesSession(verified, session)) {
        throw new Error("A leitura após reinício não corresponde à reserva; o cadastro não foi ativado.");
      }
      await confirmProvisioning(session.id, proofFrom(session));
      if (animalId) await linkDevice.mutateAsync({ deviceId: session.deviceId, animalId });
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
      setDeviceInfo(verified);
      setComplete(true);
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível confirmar o provisionamento."));
    } finally {
      setBusy(false);
    }
  }

  if (!isWebSerialSupported()) {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        O provisionamento USB requer Chrome ou Edge em um computador. Nenhum cadastro foi criado.
        <button type="button" onClick={onClose} className="ml-3 underline">Fechar</button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-slate-900">Provisionar brinco — passo {step} de 4</h2>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">Fechar</button>
      </div>

      {step === 1 && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">Conecte o brinco. A identidade física e a versão do firmware serão lidas antes de qualquer cadastro.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void connectAndIdentify()} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? "Identificando..." : "Selecionar USB e identificar"}
            </button>
            {port && <button type="button" disabled={busy} onClick={() => void flashFirmware()} className="rounded-md border border-slate-300 px-4 py-2 text-sm disabled:opacity-60">Manutenção: atualizar firmware</button>}
          </div>
          {flashProgress && <p className="text-xs text-slate-500">Gravando {flashProgress.written} de {flashProgress.total} bytes.</p>}
        </div>
      )}

      {step === 2 && deviceInfo && (
        <div className="mt-4 space-y-4">
          <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            Hardware <strong>{deviceInfo.hardwareUid}</strong> · firmware <strong>{deviceInfo.firmwareVersion}</strong> · {deviceInfo.provisioned ? `ID ${deviceInfo.radioDeviceId} detectado (a sessão será retomada se ainda estiver pendente)` : "não provisionado"}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-500">Identificação
              <input value={deviceIdentifier} onChange={(event) => setDeviceIdentifier(event.target.value)} placeholder="BRINCO-0001" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-medium text-slate-500">Modelo
              <input value={hardwareModel} onChange={(event) => setHardwareModel(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </div>
          <button type="button" disabled={!deviceIdentifier.trim()} onClick={() => setStep(3)} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Avançar</button>
        </div>
      )}

      {step === 3 && (
        <div className="mt-4 space-y-4">
          <label className="block text-xs font-medium text-slate-500">Gateway
            <select value={gatewayId} onChange={(event) => setGatewayId(event.target.value)} className="mt-1 block w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Associar depois</option>
              {gateways?.map((gateway) => <option key={gateway.id} value={gateway.id}>{gateway.name}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-500">Animal
            <select value={animalId} onChange={(event) => setAnimalId(event.target.value)} className="mt-1 block w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Associar depois</option>
              {animals?.map((animal) => <option key={animal.id} value={animal.id}>{animal.name ? `${animal.name} (${animal.tagCode})` : animal.tagCode}</option>)}
            </select>
          </label>
          <p className="text-sm text-slate-600">O servidor reservará o ID LoRa; ele não pode ser escolhido manualmente.</p>
          <button type="button" disabled={busy} onClick={() => void reserveAndConfigure()} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? "Configurando..." : "Reservar ID e configurar"}</button>
        </div>
      )}

      {step === 4 && session && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-600">ID LoRa <strong>{session.radioDeviceId}</strong> gravado. Reinicie o brinco, aguarde a porta reaparecer e faça a leitura final.</p>
          {!complete ? (
            <button type="button" disabled={busy} onClick={() => void verifyAndConfirm()} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? "Verificando..." : "Verificar após reinício e ativar"}</button>
          ) : (
            <div className="rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Provisionamento confirmado. O dispositivo está ativo e pronto para transmitir.</div>
          )}
          {complete && <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm">Concluir</button>}
        </div>
      )}

      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
