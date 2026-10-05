// Executar em Linux com Node >=22 e openssl; somente certificados sintéticos temporários.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readlink, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { synchronize, validatePair } from './mqtt-cert-sync.mjs';

test('validação, recarga, idempotência e preservação do certificado anterior', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mqtt-cert-test-'));
  const domain = 'mqtt.example.test';
  const source = path.join(root, 'source');
  const issuer = path.join(source, 'issuer', domain);
  const target = path.join(root, 'target');
  await mkdir(issuer, { recursive: true });
  const cert = path.join(issuer, `${domain}.crt`);
  const key = path.join(issuer, `${domain}.key`);
  const generate = () => execFileSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-days', '30', '-subj', `/CN=${domain}`, '-addext', `subjectAltName=DNS:${domain}`, '-keyout', key, '-out', cert], { stdio: 'ignore' });
  try {
    generate();
    const originalCert = await readFile(cert);
    const originalKey = await readFile(key);
    assert.ok(validatePair(originalCert, originalKey, domain));
    assert.throws(() => validatePair(originalCert, originalKey, 'other.example.test'));
    assert.throws(() => validatePair(originalCert, originalKey, domain, Date.now() + 31 * 86400000));
    assert.throws(() => validatePair(originalCert, originalKey, domain, Date.now() - 86400000));
    let reloads = 0;
    const reload = async () => { reloads++; };
    const first = await synchronize({ source, target, domain, reload });
    assert.equal(reloads, 1);
    assert.equal((await stat(path.join(target, 'current', 'key.pem'))).mode & 0o777, 0o640);
    const second = await synchronize({ source, target, domain });
    assert.equal(second.digest, first.digest);
    const oldStatus = await readFile(path.join(target, 'status.json'), 'utf8');
    await writeFile(key, 'invalid');
    await assert.rejects(synchronize({ source, target, domain }));
    assert.equal(await readlink(path.join(target, 'current')), first.digest);
    assert.equal(await readFile(path.join(target, 'status.json'), 'utf8'), oldStatus);
    generate();
    const nextKey = await readFile(key);
    assert.throws(() => validatePair(originalCert, nextKey, domain));
    const third = await synchronize({ source, target, domain, reload });
    assert.notEqual(third.digest, first.digest);
    assert.equal(reloads, 2);
    const thirdStatus = await readFile(path.join(target, 'status.json'), 'utf8');
    await assert.rejects(synchronize({ source, target, domain, reload: async () => { throw Error('reload failed'); } }));
    assert.equal(await readFile(path.join(target, 'status.json'), 'utf8'), thirdStatus);
    await synchronize({ source, target, domain, reload });
    await assert.rejects(synchronize({ source, target, domain: '../escape' }));
    // Caddy não é modificado pelo sincronizador.
    assert.deepEqual(await readFile(key), nextKey);
  } finally {
    // Somente a árvore sintética criada por este teste, nunca volumes de produção.
    await rm(root, { recursive: true, force: true });
  }
});
