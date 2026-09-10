// Imports an already built, merged XIAO ESP32-S3 image; never invokes PlatformIO.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [source, version, expectedHash] = process.argv.slice(2);
if (!source || !version || !/^[a-f0-9]{64}$/i.test(expectedHash ?? '')) {
  console.error('Usage: npm run firmware:import -- <merged.bin> <version> <expected-sha256>');
  process.exit(1);
}
const data = readFileSync(resolve(source));
const actualHash = createHash('sha256').update(data).digest('hex');
if (actualHash !== expectedHash.toLowerCase()) throw new Error('SHA-256 mismatch. Import cancelled.');
if (data.length < 0x10000 + 24 || data.length > 8 * 1024 * 1024 || data[0] !== 0xe9 || data[0x10000] !== 0xe9) {
  throw new Error('Expected an ESP32 merged image with bootloader at 0x0 and application at 0x10000, at most 8 MiB.');
}
// ESP image header chip ID is little endian at offsets 12..13. ESP32-S3 is 9.
if (data.readUInt16LE(12) !== 9 || data.readUInt16LE(0x10000 + 12) !== 9) throw new Error('Image is not for ESP32-S3.');
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = resolve(root, 'frontend/public/firmware');
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'collar-latest.bin'), data);
writeFileSync(resolve(output, 'manifest.json'), JSON.stringify({ version, board: 'seeed_xiao_esp32s3', protocolVersion: 1, flashAddress: 0, file: 'collar-latest.bin', size: data.length, sha256: actualHash }, null, 2) + '\n');
console.log(`Imported ${data.length} bytes; version=${version}; sha256=${actualHash}`);
