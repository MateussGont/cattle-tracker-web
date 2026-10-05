// Rodar somente na VPS como root, com shared montado em /configuration.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
function main() {
const original = JSON.parse(readFileSync('/configuration/gateway-access.json', 'utf8'));
assert.equal(original.mqttUsername, 'gateway');
assert.match(original.mqttPassword, /^[a-f0-9]{64}$/);
const domain = process.env.APP_DOMAIN;
assert.match(domain, /^[a-z0-9]+([.-][a-z0-9]+)+$/);
const handoff = {
  mqttHost: domain, mqttPort: 8883, mqttTls: true,
  mqttUsername: original.mqttUsername, mqttPassword: original.mqttPassword,
  mqttTopic: original.mqttTopic, minimumTlsVersion: '1.2',
  verifyServerCertificate: true,
  notes: 'Credencial exclusiva do piloto de um gateway. Não concede acesso SSH, site ou API administrativa. Firmware deve validar CA/hostname e sincronizar relógio.'
};
const target = '/configuration/gateway-mqtt.json';
if (existsSync(target)) {
  assert.equal(statSync(target).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(readFileSync(target, 'utf8')), handoff);
} else {
  writeFileSync(target, JSON.stringify(handoff, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
}
console.log('Arquivo MQTT do gateway preparado na VPS, sem expor credenciais.');
}
try { main(); } catch { console.error('Falha ao preparar arquivo MQTT; detalhes sensíveis suprimidos.'); process.exitCode = 1; }
