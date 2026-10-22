// Compara uma restauração isolada ao banco original sem imprimir dados/segredos.
import assert from 'node:assert/strict';
import pg from 'pg';
const target = process.env.RESTORE_DATABASE;
assert.match(target ?? '', /^cattle_restore_check_[0-9]{14}$/);
const restoredUrl = new URL(process.env.DATABASE_URL);
assert.notEqual(restoredUrl.pathname.slice(1), target);
restoredUrl.pathname = `/${target}`;
const source = new pg.Pool({connectionString: process.env.DATABASE_URL});
const restored = new pg.Pool({connectionString: restoredUrl.toString()});
const quote = value => `"${value.replaceAll('"', '""')}"`;
try {
  const tablesQuery = `SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_schema IN ('public','drizzle') AND table_type='BASE TABLE' ORDER BY table_schema,table_name`;
  const tables = (await source.query(tablesQuery)).rows;
  assert.deepEqual((await restored.query(tablesQuery)).rows, tables, 'Schemas restaurados divergem.');
  for (const row of tables) {
    const query = `SELECT count(*)::int AS count, md5(string_agg(md5(row_to_json(t)::text), '' ORDER BY row_to_json(t)::text)) AS fingerprint FROM ${quote(row.table_schema)}.${quote(row.table_name)} t`;
    assert.deepEqual((await restored.query(query)).rows, (await source.query(query)).rows, `Dados divergem: ${row.table_name}`);
  }
  const sequences = `SELECT schemaname,sequencename,last_value FROM pg_sequences WHERE schemaname IN ('public','drizzle') ORDER BY schemaname,sequencename`;
  assert.deepEqual((await restored.query(sequences)).rows, (await source.query(sequences)).rows, 'Sequências divergem.');
  assert.equal((await source.query('SELECT count(*)::int AS count FROM locations')).rows[0].count, 2, 'Ensaio espera duas medições sintéticas.');
  console.log(`RESTORE_VERIFIED_${tables.length}_TABLES_ALL_ROWS_AND_SEQUENCES_WITH_TWO_SYNTHETIC_LOCATIONS`);
} finally { await source.end(); await restored.end(); }
