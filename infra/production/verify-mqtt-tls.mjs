// Executar com a imagem backend e credenciais somente na VPS. Sem dados de negócio.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import mqtt from 'mqtt';

const access = JSON.parse(readFileSync('/run/gateway-access.json', 'utf8'));
const url = `mqtts://${process.env.APP_DOMAIN}:8883`;
const opts = { reconnectPeriod: 0, connectTimeout: 6000, rejectUnauthorized: true, minVersion: 'TLSv1.2', clean: true };
const clients = [];
async function connect(endpoint, options) {
  const client = mqtt.connect(endpoint, { ...opts, clientId: `tls-check-${randomUUID()}`, ...options });
  clients.push(client);
  client.on('error', () => {});
  await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('error', reject); });
  return client;
}
async function rejected(options) {
  await assert.rejects(connect(url, options), error => error.code === 5 || error.code === 135);
}
try {
  await rejected({});
  await rejected({ username: access.mqttUsername, password: 'not-a-real-password' });
  await rejected({ username: 'backend', password: process.env.MQTT_BACKEND_PASSWORD });
  console.log('Anonimato, senha inválida e credencial interna recusados na porta pública.');
  const internal = await connect('mqtt://mosquitto:1883', { username: 'backend', password: process.env.MQTT_BACKEND_PASSWORD });
  await internal.subscribeAsync(access.mqttTopic, { qos: 1 });
  const gateway = await connect(url, { username: access.mqttUsername, password: access.mqttPassword, protocolVersion: 5 });
  const reader = await connect(url, { username: access.mqttUsername, password: access.mqttPassword, protocolVersion: 5 });
  // ACL estática pode aceitar SUBSCRIBE, mas deve bloquear a entrega.
  try { await reader.subscribeAsync(access.mqttTopic, { qos: 1 }); } catch {}
  let leaked = false;
  const marker = JSON.stringify({ tlsValidation: randomUUID() });
  reader.on('message', (_topic, payload) => { if (payload.toString() === marker) leaked = true; });
  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Mensagem não chegou ao assinante interno.')), 6000);
    internal.on('message', (_topic, payload) => { if (payload.toString() === marker) { clearTimeout(timer); resolve(); } });
  });
  // Payload propositalmente fora do schema: backend ignora, sem criar posições/gateways.
  await gateway.publishAsync(access.mqttTopic, marker, { qos: 1, retain: false });
  await received;
  await delay(1000);
  assert.equal(leaked, false, 'Gateway não pode receber telemetria.');
  await assert.rejects(gateway.publishAsync('cattle-tracker/forbidden', marker, { qos: 1, retain: false }), error => error.code === 135);
  const legacy = await connect(url, { username: access.mqttUsername, password: access.mqttPassword, protocolVersion: 4 });
  assert.ok(legacy.connected);
  console.log('TLS autenticado MQTT 3.1.1/5, publicação permitida, leitura e tópico indevido bloqueados.');
} catch {
  console.error('Validação MQTT falhou; detalhes sensíveis suprimidos.');
  process.exitCode = 1;
} finally {
  await Promise.all(clients.map(client => client.endAsync(true)));
}
