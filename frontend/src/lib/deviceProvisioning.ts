import { ESPLoader, Transport } from "esptool-js";

const FIRMWARE_URL = "/firmware/collar-latest.bin";
// collar-latest.bin is a merged image containing bootloader, partitions,
// boot_app0 and application at their proper offsets, so it starts at 0x0.
const FLASH_ADDRESS = 0x0;
const PROVISION_BAUD_RATE = 115200;

export interface FlashProgress {
  written: number;
  total: number;
}

/**
 * Flashes the generic collar firmware image (built once for all units, see
 * scripts/sync-firmware.mjs) onto a blank or previously-flashed board over
 * WebSerial. Only needed the first time a physical unit is used — after
 * this, sendProvisionCommand() alone is enough to (re)assign its identity.
 */
export async function flashCollarFirmware(
  port: SerialPort,
  onProgress?: (progress: FlashProgress) => void,
): Promise<void> {
  const response = await fetch(FIRMWARE_URL);
  if (!response.ok) {
    throw new Error(`Não foi possível baixar o firmware (${FIRMWARE_URL}): HTTP ${response.status}.`);
  }
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
}

export interface DeviceStatusMessage {
  event: "status" | "boot" | "provisioned" | "awaiting_provisioning" | "provision_error";
  provisioned?: boolean;
  radioDeviceId?: number;
  message?: string;
}

async function readJsonLine(
  reader: ReadableStreamDefaultReader<string>,
  timeoutMs: number,
): Promise<DeviceStatusMessage> {
  let buffer = "";
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const timeout = new Promise<{ value: undefined; done: true }>((resolve) => {
      setTimeout(() => resolve({ value: undefined, done: true }), Math.max(remaining, 0));
    });
    const result = await Promise.race([reader.read(), timeout]);
    if (result.done || result.value === undefined) {
      break;
    }
    buffer += result.value;
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex === -1) {
      continue;
    }
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line.startsWith("{")) {
      try {
        return JSON.parse(line) as DeviceStatusMessage;
      } catch {
        // Non-JSON debug line (e.g. "collar ready: ..."); keep reading.
      }
    }
  }

  throw new Error("O dispositivo não respondeu a tempo. Confirme que ele está ligado e com o firmware da Cattle Tracker.");
}

/**
 * Opens the collar's USB-serial port directly (no esptool bootloader
 * protocol involved) and runs one request/response line: "GET_STATUS" to
 * read what a unit is currently set to, or "SET_RADIO_ID <n>" to assign it.
 * Firmware side: firmware/collar/main.cpp, tryHandleSerialCommand().
 */
export async function sendSerialCommand(
  port: SerialPort,
  command: string,
  timeoutMs = 8000,
): Promise<DeviceStatusMessage> {
  const openedHere = !port.readable;
  if (openedHere) {
    await port.open({ baudRate: PROVISION_BAUD_RATE });
  }

  // SerialPort's readable/writable are typed as BufferSource by the
  // w3c-web-serial community types, one level looser than the DOM lib's
  // TextDecoderStream/TextEncoderStream (which are Uint8Array-exact) —
  // both actually carry Uint8Array chunks at runtime, so bridge the two
  // stream type declarations explicitly rather than fighting the variance.
  const textDecoder = new TextDecoderStream();
  const readableClosed = (port.readable as unknown as ReadableStream<Uint8Array>)
    .pipeTo(textDecoder.writable as unknown as WritableStream<Uint8Array>)
    .catch(() => undefined);
  const reader = textDecoder.readable.getReader();

  const textEncoder = new TextEncoderStream();
  const writableClosed = textEncoder.readable
    .pipeTo(port.writable as unknown as WritableStream<Uint8Array>)
    .catch(() => undefined);
  const writer = textEncoder.writable.getWriter();

  try {
    await writer.write(`${command}\n`);
    return await readJsonLine(reader, timeoutMs);
  } finally {
    await reader.cancel().catch(() => undefined);
    await writer.close().catch(() => undefined);
    await readableClosed;
    await writableClosed;
    if (openedHere) {
      await port.close().catch(() => undefined);
    }
  }
}

export async function getDeviceStatus(port: SerialPort): Promise<DeviceStatusMessage> {
  return sendSerialCommand(port, "GET_STATUS");
}

export async function provisionRadioDeviceId(port: SerialPort, radioDeviceId: number): Promise<DeviceStatusMessage> {
  return sendSerialCommand(port, `SET_RADIO_ID ${radioDeviceId}`);
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}
