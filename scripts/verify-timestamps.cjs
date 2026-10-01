const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { Client } = require('pg');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  quiet: true,
});
const client = new Client({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionTimeoutMillis: 8000,
});

async function main() {
  const sql = await readFile(
    path.resolve(
      __dirname,
      '../database/migrations/20261001-timestamps-with-timezone.sql',
    ),
    'utf8',
  );
  const schema = 'verify_timestamps_' + randomUUID().replaceAll('-', '');
  await client.connect();
  await client.query('BEGIN');
  try {
    // All fixtures live in a separate transactional schema, rolled back at the end.
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", pg_temp`);
    await client.query(`CREATE TABLE orders (id int PRIMARY KEY, source text, "requestId" uuid, "createdAt" timestamp DEFAULT now(), "updatedAt" timestamp DEFAULT now(), "dispatchedAt" timestamptz, marker text);
      CREATE TABLE manual_order_notes (id uuid PRIMARY KEY, data jsonb, "updatedAt" timestamp DEFAULT now());
      CREATE TABLE store_settings (id int PRIMARY KEY, "updatedAt" timestamp DEFAULT now());
      INSERT INTO orders VALUES (1,'online',NULL,'2026-10-01 14:00:00','2026-10-01 14:05:00','2026-10-01T14:30:00Z','preserved'),
        (2,'manual','00000000-0000-4000-8000-000000000002','2026-10-01 11:10:00','2026-10-01 14:15:00',NULL,'manual-preserved');
      INSERT INTO manual_order_notes VALUES ('00000000-0000-4000-8000-000000000002','{"createdAt":"2026-10-01T14:10:00.000Z"}','2026-10-01 14:20:00');
      INSERT INTO store_settings VALUES (1,'2026-10-01 14:25:00');`);
    await client.query('SAVEPOINT invalid_manual');
    await client.query(
      `INSERT INTO orders (id,source,"createdAt","updatedAt") VALUES (3,'manual',now(),now())`,
    );
    await assert.rejects(client.query(sql), /sem data original/);
    await client.query('ROLLBACK TO SAVEPOINT invalid_manual');
    await client.query(sql);
    const first = (await client.query('SELECT * FROM orders ORDER BY id')).rows;
    assert.equal(first[0].createdAt.toISOString(), '2026-10-01T14:00:00.000Z');
    assert.equal(first[0].updatedAt.toISOString(), '2026-10-01T14:05:00.000Z');
    assert.equal(
      first[0].dispatchedAt.toISOString(),
      '2026-10-01T14:30:00.000Z',
    );
    assert.equal(first[0].marker, 'preserved');
    assert.equal(first[1].createdAt.toISOString(), '2026-10-01T14:10:00.000Z');
    assert.equal(first[1].marker, 'manual-preserved');
    assert.equal(
      (
        await client.query('SELECT "updatedAt" FROM manual_order_notes')
      ).rows[0].updatedAt.toISOString(),
      '2026-10-01T14:20:00.000Z',
    );
    assert.equal(
      (
        await client.query('SELECT "updatedAt" FROM store_settings')
      ).rows[0].updatedAt.toISOString(),
      '2026-10-01T14:25:00.000Z',
    );
    await client.query(sql);
    assert.deepEqual(
      (await client.query('SELECT * FROM orders ORDER BY id')).rows,
      first,
    );
    for (const zone of ['America/Sao_Paulo', 'Pacific/Auckland']) {
      await client.query(`SELECT set_config('TimeZone',$1,true)`, [zone]);
      assert.deepEqual(
        (await client.query('SELECT * FROM orders ORDER BY id')).rows,
        first,
      );
      await client.query(`INSERT INTO store_settings (id) VALUES (2)`);
      const result = await client.query(
        `SELECT abs(extract(epoch FROM ("updatedAt" - transaction_timestamp()))) AS delta FROM store_settings WHERE id=2`,
      );
      assert.equal(Number(result.rows[0].delta), 0);
      await client.query('DELETE FROM store_settings WHERE id=2');
    }
    console.log(
      'Validados: UTC, origem manual, preservação de dados, saída para entrega, repetição da migração e gravação/leitura em fusos diferentes.',
    );
  } finally {
    await client.query('ROLLBACK');
  }
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
