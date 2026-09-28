// Executar em container sem rede, UID 0, com shared montado em /state.
import { randomBytes } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
const email = process.argv[2];
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '')) throw Error('Informe um e-mail válido.');
const directory = lstatSync('/state');
if (!directory.isDirectory() || directory.uid !== 0 || (directory.mode & 0o777) !== 0o700) throw Error('/state deve ser diretório root 0700.');
const path = '/state/admin.json';
if (existsSync(path)) {
  const file = lstatSync(path);
  if (!file.isFile() || file.uid !== 0 || (file.mode & 0o777) !== 0o600) throw Error('Arquivo existente deve ser regular, root 0600.');
  if (JSON.parse(readFileSync(path, 'utf8')).email !== email) throw Error('E-mail existente diverge; nenhuma alteração feita.');
  console.log('Credenciais administrativas existentes preservadas.');
} else {
  writeFileSync(path, JSON.stringify({name: 'Administrador', email, password: randomBytes(32).toString('hex')}), {flag: 'wx', mode: 0o600});
  console.log('Credenciais administrativas criadas no arquivo privado, sem impressão da senha.');
}
