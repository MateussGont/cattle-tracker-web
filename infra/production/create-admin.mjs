// Recebe JSON por stdin: nenhum segredo é passado em argumentos ou escrito em logs.
import { readFileSync } from 'node:fs';
import argon2 from 'argon2';
import pg from 'pg';

const input = JSON.parse(readFileSync(0, 'utf8'));
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email ?? '') || typeof input.password !== 'string' || input.password.length < 24) {
  throw new Error('Informe e-mail válido e senha aleatória de pelo menos 24 caracteres.');
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'admin', 'active')
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [input.name || 'Administrador', input.email, passwordHash],
  );
  console.log(result.rowCount ? 'Administrador criado.' : 'Administrador já existe; senha preservada.');
} finally {
  await pool.end();
}
