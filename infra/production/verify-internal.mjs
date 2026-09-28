// Validação de bancada vazia. Credenciais são montadas read-only, nunca impressas.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import pg from 'pg';
import mqtt from 'mqtt';
import WebSocket from 'ws';

assert.equal(process.env.ALLOW_BENCH_VALIDATION, 'yes', 'Habilite explicitamente a validação de bancada.');
const mode = process.argv[2];
assert.ok(['exercise', 'verify-clean'].includes(mode));
const credentials = JSON.parse(readFileSync('/run/admin.json', 'utf8'));
const gatewayCredentials = JSON.parse(readFileSync('/run/gateway-access.json', 'utf8'));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const fixturePath = '/validation/fixture.json';
let fixture;
let token;
let socket;
let mqttClient;
const origin = 'http://web:8080';
const save = () => writeFileSync(fixturePath, JSON.stringify(fixture), {mode: 0o600});
async function request(path, method = 'GET', body, expected = 200, authenticated = true, extra = {}) {
  const r = await fetch(origin + path, {
    method,
    headers: {...(authenticated ? {authorization: `Bearer ${token}`} : {}), ...(body ? {'content-type': 'application/json'} : {}), ...extra},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(r.status, expected, `HTTP ${method} ${path}`);
  return r.headers.get('content-type')?.includes('application/json') ? r.json() : r.text();
}
async function cleanup() {
  if (!fixture) return;
  assert.match(fixture.label, /^VPS-CHECK-[a-f0-9-]{36}$/);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Cascata remove somente locations/sessões do dispositivo sintético exato.
    if (fixture.deviceId) await client.query('DELETE FROM devices WHERE id=$1 AND device_identifier=$2 AND hardware_uid=$3', [fixture.deviceId, fixture.label, fixture.hardwareUid]);
    if (fixture.gatewayId) await client.query('DELETE FROM gateways WHERE id=$1 AND gateway_identifier=$2', [fixture.gatewayId, fixture.label]);
    await client.query('COMMIT');
    if (existsSync(fixturePath)) unlinkSync(fixturePath);
    console.log('SYNTHETIC_FIXTURES_REMOVED');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function assertStored() {
  const markers = await request('/api/map/devices');
  const marker = markers.find(row => row.deviceId === fixture.deviceId);
  assert.ok(marker && Math.abs(marker.latitude - fixture.latitude) < 0.00001, 'Mapa deve conter a última medição.');
  const {rows} = await pool.query('SELECT count(*)::int AS count FROM locations WHERE device_id=$1', [fixture.deviceId]);
  assert.equal(rows[0].count, 2, 'Duas posições devem estar persistidas.');
  const {rows: positions} = await pool.query('SELECT ST_Y(position::geometry) AS latitude, ST_X(position::geometry) AS longitude FROM locations WHERE device_id=$1 ORDER BY id DESC LIMIT 1', [fixture.deviceId]);
  assert.equal(positions[0].latitude, fixture.latitude);
  const gateways = await request('/api/gateways');
  assert.ok(gateways.find(row => row.id === fixture.gatewayId)?.lastSeen, 'Heartbeat do gateway deve estar atualizado.');
}
async function nextEvent(action) {
  const eventPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('message', receive); reject(Error('Timeout aguardando evento WebSocket.')); }, 15000);
    function receive(data) {
      const event = JSON.parse(data.toString());
      if (event.type === 'location_update' && event.payload.deviceId === fixture.deviceId) {
        clearTimeout(timer); socket.off('message', receive); resolve(event);
      }
    }
    socket.on('message', receive);
  });
  const [event] = await Promise.all([eventPromise, action()]);
  return event;
}
try {
  const login = await request('/api/auth/login', 'POST', credentials, 200, false);
  assert.ok(typeof login.token === 'string' && login.user.role === 'admin');
  token = login.token;
  console.log('ADMIN_LOGIN_OK');
  if (mode === 'verify-clean') {
    fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
    await assertStored();
    console.log('DATA_AND_LOGIN_PERSISTED_AFTER_CONTAINER_REPLACEMENT');
    await cleanup();
    assert.equal((await request('/api/devices')).length, 0);
    assert.equal((await request('/api/gateways')).length, 0);
    console.log('BENCH_EMPTY_AFTER_CLEANUP');
  } else {
    assert.ok(!existsSync(fixturePath), 'Há um ensaio anterior pendente de limpeza.');
    const {rows} = await pool.query('SELECT (SELECT count(*) FROM devices)::int AS devices, (SELECT count(*) FROM gateways)::int AS gateways');
    assert.deepEqual(rows[0], {devices: 0, gateways: 0}, 'Este teste exige bancada sem dispositivos/gateways reais.');
    fixture = { label: `VPS-CHECK-${randomUUID()}`, hardwareUid: `02${randomBytes(5).toString('hex')}`.toUpperCase() };
    save();
    await request('/api/auth/login', 'POST', {email: credentials.email, password: 'invalid-validation-password'}, 401, false);
    for (const route of ['/api/devices', '/api/gateways', '/api/map/devices']) await request(route, 'GET', undefined, 401, false);
    await request('/api/telemetry', 'POST', {}, 401, false);
    console.log('UNAUTHENTICATED_ACCESS_AND_INVALID_LOGIN_REJECTED');
    const html = await request('/map', 'GET', undefined, 200, false);
    assert.ok(html.includes('<div id="root">'));
    const asset = html.match(/src="([^"]+\.js)"/)[1];
    const bundle = await request(asset, 'GET', undefined, 200, false);
    assert.ok(bundle.includes('http://localhost:8080') && bundle.includes('ws://localhost:8080/ws'));
    await request('/assets/not-found.js', 'GET', undefined, 404, false);
    console.log('FRONTEND_SPA_ASSETS_AND_PRIVATE_ENDPOINTS_OK');
    const gateway = await request('/api/gateways', 'POST', {name: fixture.label, gatewayIdentifier: fixture.label}, 201);
    fixture.gatewayId = gateway.id; save();
    const input = { idempotencyKey: randomUUID(), hardwareUid: fixture.hardwareUid, firmwareVersion: 'synthetic-validation', deviceIdentifier: fixture.label, gatewayId: gateway.id };
    const session = await request('/api/provisioning/sessions', 'POST', input, 201);
    fixture.deviceId = session.deviceId; fixture.radioDeviceId = session.radioDeviceId; save();
    const repeated = await request('/api/provisioning/sessions', 'POST', input, 201);
    assert.equal(session.id, repeated.id);
    const proof = { hardwareUid: fixture.hardwareUid, firmwareVersion: input.firmwareVersion, radioDeviceId: session.radioDeviceId, configRevision: session.configRevision };
    await request(`/api/provisioning/sessions/${session.id}/confirm`, 'POST', {...proof, configRevision: proof.configRevision + 1}, 409);
    await request(`/api/provisioning/sessions/${session.id}/configured`, 'POST', proof);
    const confirmed = await request(`/api/provisioning/sessions/${session.id}/confirm`, 'POST', proof);
    assert.equal(confirmed.status, 'confirmed');
    console.log('PROVISIONING_API_IDEMPOTENCY_AND_PROOF_OK_NO_PHYSICAL_HARDWARE');
    await new Promise((resolve, reject) => {
      const unauthenticated = new WebSocket('ws://web:8080/ws');
      const timer = setTimeout(() => { unauthenticated.terminate(); reject(Error('Timeout WS anônimo')); }, 5000);
      unauthenticated.on('close', code => { clearTimeout(timer); code === 4401 ? resolve() : reject(Error('WebSocket anônimo deveria ser recusado.')); });
      unauthenticated.on('error', reject);
    });
    socket = new WebSocket(`ws://web:8080/ws?token=${encodeURIComponent(token)}`);
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    mqttClient = await mqtt.connectAsync('mqtt://mosquitto:1883', {username: 'gateway', password: gatewayCredentials.mqttPassword, reconnectPeriod: 0, connectTimeout: 10000});
    const telemetry = {gatewayId: fixture.label, radioDeviceId: session.radioDeviceId, sequence: 1, latitude: -19.5, longitude: -44.5, gnssUnixTime: Math.floor(Date.now()/1000), batteryMv: 3900, flags: 7};
    const event = await nextEvent(() => mqttClient.publishAsync('cattle-tracker/telemetry', JSON.stringify(telemetry), {qos: 1, retain: false}));
    assert.equal(event.payload.latitude, telemetry.latitude);
    console.log('MQTT_TO_DATABASE_TO_AUTHENTICATED_WEBSOCKET_OK');
    fixture.latitude = -19.499; save();
    const next = {...telemetry, sequence: 2, latitude: fixture.latitude};
    await nextEvent(() => request('/api/telemetry', 'POST', next, 201, false, {'x-gateway-key': process.env.GATEWAY_API_KEY}));
    await request('/api/telemetry', 'POST', {...next, latitude: 999}, 400, false, {'x-gateway-key': process.env.GATEWAY_API_KEY});
    await assertStored();
    console.log('HTTP_TELEMETRY_MAP_AND_POSTGIS_STORAGE_OK');
    console.log('FIXTURES_RETAINED_ONLY_FOR_BACKUP_AND_RESTART_VALIDATION');
  }
} catch (error) {
  console.error('INTERNAL_VALIDATION_FAILED:', error.message);
  await cleanup();
  process.exitCode = 1;
} finally {
  socket?.terminate();
  await mqttClient?.endAsync();
  await pool.end();
}
