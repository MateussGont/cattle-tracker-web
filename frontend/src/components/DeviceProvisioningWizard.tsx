import { useState } from "react";
import { ApiError } from "../api/client";
import {
  flashCollarFirmware,
  getDeviceStatus,
  isWebSerialSupported,
  provisionRadioDeviceId,
  type DeviceStatusMessage,
  type FlashProgress,
} from "../lib/deviceProvisioning";
import { useAnimals } from "../hooks/useAnimals";
import { useCreateDevice, useDevices, useLinkDeviceToAnimal } from "../hooks/useDevices";
import { useGateways } from "../hooks/useGateways";
import type { Device } from "../types";

type Step = 1 | 2 | 3 | 4;

function suggestNextRadioDeviceId(devices: Device[] | undefined): number {
  if (!devices || devices.length === 0) return 1;
  return Math.max(...devices.map((device) => device.radioDeviceId)) + 1;
}

export function DeviceProvisioningWizard({ onClose }: { onClose: () => void }) {
  const { data: devices } = useDevices();
  const { data: gateways } = useGateways();
  const { data: animals } = useAnimals({ status: "active" });
  const createDevice = useCreateDevice();
  const linkDevice = useLinkDeviceToAnimal();

  const [step, setStep] = useState<Step>(1);

  const [deviceIdentifier, setDeviceIdentifier] = useState("");
  const [hardwareModel, setHardwareModel] = useState("");
  const [radioDeviceId, setRadioDeviceId] = useState<string | null>(null);
  const [gatewayId, setGatewayId] = useState("");
  const [animalId, setAnimalId] = useState("");

  const [createdDevice, setCreatedDevice] = useState<Device | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [port, setPort] = useState<SerialPort | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatusMessage | null>(null);
  const [usbError, setUsbError] = useState<string | null>(null);
  const [flashing, setFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState<FlashProgress | null>(null);
  const [configuring, setConfiguring] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const effectiveRadioDeviceId = radioDeviceId ?? (devices ? String(suggestNextRadioDeviceId(devices)) : "");
  const canAdvanceStep1 = deviceIdentifier.trim().length > 0 && effectiveRadioDeviceId.trim().length > 0;

  async function handleSaveAndAdvanceToUsbStep() {
    setCreateError(null);
    try {
      const device = await createDevice.mutateAsync({
        deviceIdentifier: deviceIdentifier.trim(),
        radioDeviceId: Number(effectiveRadioDeviceId),
        hardwareModel: hardwareModel.trim() || undefined,
        gatewayId: gatewayId || undefined,
      });
      if (animalId) {
        await linkDevice.mutateAsync({ deviceId: device.id, animalId });
      }
      setCreatedDevice(device);
      setStep(4);
    } catch (error) {
      setCreateError(error instanceof ApiError ? error.message : "Erro ao cadastrar o dispositivo.");
    }
  }

  async function handleConnect() {
    setUsbError(null);
    try {
      const selectedPort = await navigator.serial.requestPort();
      setPort(selectedPort);
    } catch (error) {
      if (error instanceof Error && error.name === "NotFoundError") {
        return; // user closed the picker without selecting a device
      }
      setUsbError(error instanceof Error ? error.message : "Não foi possível acessar a porta USB.");
    }
  }

  async function handleCheckStatus() {
    if (!port) return;
    setUsbError(null);
    setCheckingStatus(true);
    try {
      setDeviceStatus(await getDeviceStatus(port));
    } catch (error) {
      setUsbError(error instanceof Error ? error.message : "Falha ao consultar o dispositivo.");
    } finally {
      setCheckingStatus(false);
    }
  }

  async function handleFlash() {
    if (!port) return;
    setUsbError(null);
    setFlashing(true);
    setFlashProgress(null);
    try {
      await flashCollarFirmware(port, setFlashProgress);
      setDeviceStatus(null);
    } catch (error) {
      setUsbError(error instanceof Error ? error.message : "Falha ao gravar o firmware.");
    } finally {
      setFlashing(false);
    }
  }

  async function handleConfigure() {
    if (!port || !createdDevice) return;
    setUsbError(null);
    setConfiguring(true);
    try {
      const result = await provisionRadioDeviceId(port, createdDevice.radioDeviceId);
      setDeviceStatus(result);
    } catch (error) {
      setUsbError(error instanceof Error ? error.message : "Falha ao configurar o dispositivo.");
    } finally {
      setConfiguring(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-slate-900">Novo dispositivo — passo {step} de 4</h2>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
          Fechar
        </button>
      </div>

      {step === 1 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-slate-500">Identificação (ex.: BRINCO-0004)</label>
            <input
              type="text"
              required
              value={deviceIdentifier}
              onChange={(event) => setDeviceIdentifier(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">ID de rádio (LoRa)</label>
            <input
              type="number"
              required
              min={0}
              max={65535}
              value={effectiveRadioDeviceId}
              onChange={(event) => setRadioDeviceId(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">Sugerido automaticamente; pode alterar se necessário.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Modelo (opcional)</label>
            <input
              type="text"
              value={hardwareModel}
              onChange={(event) => setHardwareModel(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="button"
              disabled={!canAdvanceStep1}
              onClick={() => setStep(2)}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Avançar
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-4">
          <label className="text-xs font-medium text-slate-500">Gateway (receptor) a que este dispositivo pertence</label>
          <select
            value={gatewayId}
            onChange={(event) => setGatewayId(event.target.value)}
            className="mt-1 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Nenhum / decidir depois</option>
            {gateways?.map((gateway) => (
              <option key={gateway.id} value={gateway.id}>
                {gateway.name}
              </option>
            ))}
          </select>
          {gateways && gateways.length === 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Nenhum gateway cadastrado ainda — dá pra continuar sem selecionar e associar depois em "Gateways".
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Avançar
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-4">
          <label className="text-xs font-medium text-slate-500">Animal a vincular (opcional)</label>
          <select
            value={animalId}
            onChange={(event) => setAnimalId(event.target.value)}
            className="mt-1 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Nenhum / decidir depois</option>
            {animals?.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.name ? `${animal.name} (${animal.tagCode})` : animal.tagCode}
              </option>
            ))}
          </select>
          {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={createDevice.isPending || linkDevice.isPending}
              onClick={() => void handleSaveAndAdvanceToUsbStep()}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {createDevice.isPending || linkDevice.isPending ? "Salvando..." : "Cadastrar e continuar"}
            </button>
          </div>
        </div>
      )}

      {step === 4 && createdDevice && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-600">
            Dispositivo <strong>{createdDevice.deviceIdentifier}</strong> cadastrado (radioDeviceId{" "}
            <strong>{createdDevice.radioDeviceId}</strong>). Agora plugue o colar na porta USB deste computador para
            gravar/configurar — ou feche o assistente e faça isso depois.
          </p>

          {!isWebSerialSupported() && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              Este navegador não suporta Web Serial (use Chrome ou Edge para gravar pela USB). O cadastro já foi
              salvo — grave depois em um navegador compatível.
            </p>
          )}

          {isWebSerialSupported() && (
            <div className="space-y-3 rounded-md border border-slate-200 p-4">
              {!port ? (
                <button
                  type="button"
                  onClick={() => void handleConnect()}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Conectar dispositivo USB
                </button>
              ) : (
                <>
                  <p className="text-sm text-emerald-700">Porta serial selecionada.</p>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={checkingStatus}
                      onClick={() => void handleCheckStatus()}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    >
                      {checkingStatus ? "Consultando..." : "Verificar status atual"}
                    </button>
                    <button
                      type="button"
                      disabled={flashing}
                      onClick={() => void handleFlash()}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    >
                      {flashing ? "Gravando firmware..." : "① Gravar firmware (1x por unidade nova)"}
                    </button>
                    <button
                      type="button"
                      disabled={configuring}
                      onClick={() => void handleConfigure()}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {configuring ? "Configurando..." : "② Configurar (enviar ID de rádio)"}
                    </button>
                  </div>

                  {flashProgress && (
                    <div className="text-xs text-slate-500">
                      Gravando: {flashProgress.written} / {flashProgress.total} bytes
                    </div>
                  )}

                  {deviceStatus && (
                    <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(deviceStatus, null, 2)}</pre>
                      {deviceStatus.event === "provisioned" && deviceStatus.radioDeviceId === createdDevice.radioDeviceId && (
                        <p className="mt-2 font-medium text-emerald-700">
                          Configurado com sucesso — o colar já está pronto para transmitir.
                        </p>
                      )}
                    </div>
                  )}

                  {usbError && <p className="text-sm text-red-600">{usbError}</p>}
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Concluir
          </button>
        </div>
      )}
    </div>
  );
}
