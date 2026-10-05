// Lê certificados Caddy sem modificá-los. Nunca registra conteúdo ou chave.
import { createHash, createPrivateKey, X509Certificate } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, readdir, readlink, rename, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function validatePair(certPem, keyPem, domain, now = Date.now()) {
  const cert = new X509Certificate(certPem);
  if (!cert.checkHost(domain) || !cert.checkPrivateKey(createPrivateKey(keyPem))) throw Error('Par certificado/chave ou domínio inválido.');
  if (Date.parse(cert.validFrom) > now || Date.parse(cert.validTo) <= now + 86400000) throw Error('Certificado fora da janela segura de validade.');
  return { validTo: cert.validTo, fingerprint: cert.fingerprint256 };
}

export async function synchronize({ source = '/caddy/caddy/certificates', target = '/certs/mqtt', domain, reload, now = Date.now() }) {
  if (!/^[a-z0-9]+([.-][a-z0-9]+)+$/.test(domain ?? '')) throw Error('Domínio inválido.');
  // Busca emissores dinamicamente: não presume o nome do intermediário ACME.
  const candidates = [];
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const base = path.join(source, entry.name, domain, domain);
    try {
      const certPem = await readFile(`${base}.crt`);
      const keyPem = await readFile(`${base}.key`);
      const info = validatePair(certPem, keyPem, domain, now);
      candidates.push({ certPem, keyPem, ...info });
    } catch { /* Par em renovação, inválido ou ausente: não substituir o atual. */ }
  }
  candidates.sort((a, b) => Date.parse(b.validTo) - Date.parse(a.validTo));
  if (!candidates.length) throw Error('Nenhum certificado válido disponível.');
  const pair = candidates[0];
  const digest = createHash('sha256').update(pair.certPem).update(pair.keyPem).digest('hex');
  await mkdir(target, { recursive: true, mode: 0o750 });
  await chmod(target, 0o750);
  let current;
  try { current = await readlink(path.join(target, 'current')); } catch {}
  if (current !== digest) {
    // Geração completa antes da troca atômica; cópias antigas pequenas preservadas.
    const generation = await mkdtemp(path.join(target, '.stage-'));
    await chmod(generation, 0o750);
    await writeFile(path.join(generation, 'fullchain.pem'), pair.certPem, { mode: 0o640 });
    await writeFile(path.join(generation, 'key.pem'), pair.keyPem, { mode: 0o640 });
    try { await rename(generation, path.join(target, digest)); }
    catch (error) {
      if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error;
      // Uma geração idêntica já existe (rollback); validar antes de reutilizar.
      const existingCert = await readFile(path.join(target, digest, 'fullchain.pem'));
      const existingKey = await readFile(path.join(target, digest, 'key.pem'));
      if (!existingCert.equals(pair.certPem) || !existingKey.equals(pair.keyPem)) throw Error('Geração existente divergente.');
    }
    const next = path.join(target, `.current-${process.pid}-${Date.now()}`);
    await symlink(digest, next);
    await rename(next, path.join(target, 'current'));
  }
  // Em loop, reload também no primeiro ciclo após restart. Falha não é confirmada.
  if (reload) await reload(digest);
  const status = { checkedAt: now, validTo: pair.validTo, fingerprint: pair.fingerprint, digest };
  await writeFile(path.join(target, 'status.next'), JSON.stringify(status), { mode: 0o640 });
  await rename(path.join(target, 'status.next'), path.join(target, 'status.json'));
  return status;
}

async function main() {
  process.umask(0o027);
  const mode = process.argv[2];
  if (mode === 'health') {
    const status = JSON.parse(await readFile('/certs/mqtt/status.json', 'utf8'));
    if (Date.now() - status.checkedAt > 300000 || Date.parse(status.validTo) - Date.now() < 7 * 86400000) throw Error('Sincronização atrasada ou certificado próximo do vencimento.');
    return;
  }
  if (!['once', 'loop'].includes(mode)) throw Error('Use once, loop ou health.');
  let reloaded;
  const reload = mode === 'loop' ? async digest => {
    if (digest === reloaded) return;
    if ((await readFile('/proc/1/comm', 'utf8')).trim() !== 'mosquitto') throw Error('Namespace não pertence ao broker.');
    process.kill(1, 'SIGHUP');
    reloaded = digest;
    console.log('Certificado validado e recarga do broker solicitada.');
  } : undefined;
  do {
    try { await synchronize({ domain: process.env.APP_DOMAIN, reload }); }
    catch {
      // Não imprimir exceções de parser que possam incluir material privado.
      console.error('Falha ao sincronizar certificado; configuração anterior preservada.');
      if (mode === 'once') process.exitCode = 1;
    }
    if (mode === 'loop') await new Promise(resolve => setTimeout(resolve, 60000));
  } while (mode === 'loop');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(() => { console.error('Verificação de certificado falhou.'); process.exitCode = 1; });
}
