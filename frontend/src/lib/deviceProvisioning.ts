import { ESPLoader, Transport } from "esptool-js";

const FIRMWARE_URL = "/firmware/collar-latest.bin";
const FLASH_ADDRESS = 0x0;
const PROVISION_BAUD_RATE = 115200;
const busyPorts = new WeakSet<object>();

export interface FlashProgress { written: number; total: number }

export interface DeviceInfoMessage {
  event: "device_info" | "boot" | "status" | "provision_result";
  requestId?: string;
  hardwareUid: string;
  firmwareVersion: string;
  provisioned: boolean;
  radioDeviceId: number;
  configRevision: number;
  radioReady: boolean;
}

interface ProvisionErrorMessage {
  event: "provision_error";
  requestId?: string;
  code: string;
  message: string;
}

type SerialMessage = DeviceInfoMessage | ProvisionErrorMessage | Record<string, unknown>;

export class JsonLineDecoder {
  private buffer = "";

  push(chunk: string): SerialMessage[] {
    this.buffer += chunk;
    const messages: SerialMessage[] = [];
    let newline = this.buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (line.startsWith("{")) {
        try { messages.push(JSON.parse(line) as SerialMessage); } catch { /* ignore debug/malformed lines */ }
      }
      newline = this.buffer.indexOf("\n");
    }
    return messages;
  }
}

function acquirePort(port: SerialPort): () => void {
  const key = port as object;
  if (busyPorts.has(key)) throw new Error("A porta USB já está sendo usada por outra operação.");
  busyPorts.add(key);
  return () => busyPorts.delete(key);
}

export async function flashCollarFirmware(
  port: SerialPort,
  onProgress?: (progress: FlashProgress) => void,
): Promise<void> {
  const release = acquirePort(port);
  try {
    const response = await fetch(FIRMWARE_URL);
    if (!response.ok) throw new Error(`Não foi possível baixar o firmware: HTTP ${response.status}.`);
    const firmware = new Uint8Array(await response.arrayBuffer());
    const transport = new Transport(port, true);
    const loader = new ESPLoader({
      transport,
      baudrate: 115200,
      terminal: { clean() {}, write() {}, writeLine() {} },
    });
    try {
      await loader.main();
      await loader.writeFlash({
        fileArray: [{ data: firmware, address: FLASH_ADDRESS }],
        flashMode: "keep",
        flashFreq: "keep",
        flashSize: "keep",
        eraseAll: false,
        compress: true,
        reportProgress: (_fileIndex, written, total) => onProgress?.({ written, total }),
      });
      await loader.after("hard_reset");
    } finally {
      await transport.disconnect().catch(() => undefined);
    }
  } finally {
    release();
  }
}

function isDeviceInfo(message: SerialMessage): message is DeviceInfoMessage {
  return ["device_info", "boot", "status", "provision_result"].includes(String(message.event)) &&
    "hardwareUid" in message && typeof message.hardwareUid === "string" &&
    "firmwareVersion" in message && typeof message.firmwareVersion === "string";
}

async function sendSerialRequest(
  port: SerialPort,
  payload: Record<string, unknown>,
  timeoutMs = 8000,
): Promise<DeviceInfoMessage> {
  const release = acquirePort(port);
  const openedHere = !port.readable;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  try {
    if (openedHere) await port.open({ baudRate: PROVISION_BAUD_RATE });
    if (!port.readable || !port.writable) throw new Error("A porta USB não disponibilizou leitura e escrita.");
    reader = (port.readable as unknown as ReadableStream<Uint8Array>).getReader();
    writer = (port.writable as unknown as WritableStream<Uint8Array>).getWriter();
    await writer.write(new TextEncoder().encode(`${JSON.stringify(payload)}\n`));

    const decoder = new JsonLineDecoder();
    const textDecoder = new TextDecoder();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const timedOut = Symbol("timeout");
      const result = await Promise.race([
        reader.read(),
        new Promise<typeof timedOut>((resolve) => window.setTimeout(() => resolve(timedOut), remaining)),
      ]);
      if (result === timedOut || result.done) break;
      for (const message of decoder.push(textDecoder.decode(result.value, { stream: true }))) {
        if (message.requestId !== payload.requestId) continue;
        if (message.event === "provision_error") {
          const error = message as ProvisionErrorMessage;
          throw new Error(`${error.code}: ${error.message}`);
        }
        if (isDeviceInfo(message)) return message;
      }
    }
    throw new Error("O dispositivo não respondeu a tempo. Confirme o cabo e o firmware instalado.");
  } finally {
    await reader?.cancel().catch(() => undefined);
    reader?.releaseLock();
    writer?.releaseLock();
    if (openedHere) await port.close().catch(() => undefined);
    release();
  }
}

export function getDeviceInfo(port: SerialPort): Promise<DeviceInfoMessage> {
  return sendSerialRequest(port, { cmd: "get_info", requestId: crypto.randomUUID() });
}

export function provisionDevice(
  port: SerialPort,
  request: { hardwareUid: string; radioDeviceId: number; configRevision: number },
): Promise<DeviceInfoMessage> {
  return sendSerialRequest(port, { cmd: "provision", requestId: crypto.randomUUID(), ...request });
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}
