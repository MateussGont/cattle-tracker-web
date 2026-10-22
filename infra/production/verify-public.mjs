// Executar em cliente com acesso externo e admin.json montado read-only.
// Somente leitura; não imprime token, senha ou dados dos dispositivos.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import WebSocket from 'ws';
const origin = 'https://cattletracker.tech';
const admin = JSON.parse(readFileSync('/run/admin.json', 'utf8'));
async function get(path, options = {}, expected = 200) {
  const response = await fetch(origin + path, {...options, signal: AbortSignal.timeout(15000)});
  assert.equal(response.status, expected, `HTTP ${path}`);
  return response;
}
for (const url of ['http://cattletracker.tech/', 'https://www.cattletracker.tech/']) {
  const response = await fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(15000)});
  assert.ok([301, 308].includes(response.status));
  assert.equal(response.headers.get('location'), `${origin}/`);
}
const page = await get('/map');
assert.ok(page.headers.get('strict-transport-security')?.includes('max-age='));
assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
const html = await page.text();
assert.ok(html.includes('<div id="root">'));
const asset = html.match(/src="([^"]+\.js)"/)[1];
const bundle = await (await get(asset)).text();
assert.ok(bundle.includes(origin) && bundle.includes('wss://cattletracker.tech/ws'));
assert.ok(!bundle.includes('http://localhost:8080') && !bundle.includes('ws://localhost:8080/ws'));
await get('/assets/missing-validation.js', {}, 404);
console.log('HTTPS_TRUST_REDIRECTS_HEADERS_SPA_AND_PRODUCTION_URLS_OK');
const login = await (await get('/api/auth/login', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(admin)})).json();
assert.equal(login.user.role, 'admin');
assert.ok(typeof login.token === 'string');
for (const path of ['/api/devices', '/api/gateways', '/api/map/devices']) {
  await get(path, {}, 401);
  const response = await get(path, {headers:{authorization:`Bearer ${login.token}`,origin}});
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.ok(Array.isArray(await response.json()));
}
await get('/api/telemetry', {method:'POST',headers:{'content-type':'application/json'},body:'{}'}, 401);
await get('/api/auth/login', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:admin.email,password:'invalid-validation-password'})}, 401);
const cors = await get('/healthz', {headers:{origin:'https://not-trusted.invalid'}});
assert.notEqual(cors.headers.get('access-control-allow-origin'), 'https://not-trusted.invalid');
console.log('PUBLIC_LOGIN_AUTHORIZATION_AND_CORS_OK');
await new Promise((resolve, reject) => {
  const ws = new WebSocket(`wss://cattletracker.tech/ws?token=${encodeURIComponent(login.token)}`);
  const timer = setTimeout(() => { ws.terminate(); reject(Error('WSS timeout')); }, 10000);
  ws.once('open', () => ws.ping('cattle-public-check'));
  ws.once('pong', data => {
    clearTimeout(timer); ws.close();
    data.toString() === 'cattle-public-check' ? resolve() : reject(Error('WSS pong inesperado'));
  });
  ws.once('error', error => { clearTimeout(timer); reject(error); });
});
await new Promise((resolve, reject) => {
  const ws = new WebSocket('wss://cattletracker.tech/ws');
  const timer = setTimeout(() => { ws.terminate(); reject(Error('WSS anonymous timeout')); }, 10000);
  ws.once('close', code => { clearTimeout(timer); code === 4401 ? resolve() : reject(Error('WSS deveria recusar anônimo')); });
  ws.once('error', error => { clearTimeout(timer); reject(error); });
});
await get('/healthz?proxy_check=public-20260928', {headers:{'x-forwarded-for':'198.51.100.222'}});
console.log('AUTHENTICATED_WSS_PING_PONG_AND_ANONYMOUS_REJECTION_OK');
