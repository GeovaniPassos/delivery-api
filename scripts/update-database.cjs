const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Client } = require('pg');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  quiet: true,
});

const version = '20260930-manual-orders-and-settings';
const quote = (identifier) => '"' + identifier.replaceAll('"', '""') + '"';
const digest = (text) => createHash('sha256').update(text).digest('hex');
const client = new Client({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionTimeoutMillis: 8000,
  application_name: 'delivery-schema-upgrade',
});

async function rows(table, columns) {
  const result = await client.query(
    `SELECT to_jsonb(t)::text AS record FROM (SELECT ${columns.map(quote).join(',')} FROM ${table}) t ORDER BY record`,
  );
  return result.rows.map((row) => row.record);
}

async function main() {
  const sql = await fs.readFile(
    path.resolve(__dirname, '../database/migrations', version + '.sql'),
    'utf8',
  );
  await client.connect();
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query('SELECT pg_advisory_xact_lock(20260930)');
    const schema = (await client.query('SELECT current_schema() AS name'))
      .rows[0].name;
    await client.query(`CREATE TABLE IF NOT EXISTS delivery_schema_versions (
      version varchar(100) PRIMARY KEY, checksum varchar(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const previous = (
      await client.query(
        'SELECT checksum FROM delivery_schema_versions WHERE version=$1',
        [version],
      )
    ).rows[0];
    if (previous) {
      if (previous.checksum !== digest(sql))
        throw new Error(
          'A migração aplicada foi alterada. Crie uma nova versão.',
        );
      await client.query('COMMIT');
      console.log('Esta versão do banco já foi aplicada.');
      return;
    }
    const tables = (
      await client.query(
        `SELECT table_name FROM information_schema.tables
      WHERE table_schema=$1 AND table_type='BASE TABLE' AND table_name <> 'delivery_schema_versions'
      ORDER BY table_name`,
        [schema],
      )
    ).rows.map((row) => row.table_name);
    for (const required of ['orders', 'optional_groups', 'payment_methods']) {
      if (!tables.includes(required))
        throw new Error(
          'Esta migração requer o banco anterior do delivery: falta ' +
            required,
        );
    }
    const qualified = (table) => quote(schema) + '.' + quote(table);
    // Prevent concurrent writes while taking the local data copy and validating preservation.
    await client.query(
      'LOCK TABLE ' +
        tables.map(qualified).join(',') +
        ' IN SHARE ROW EXCLUSIVE MODE',
    );
    const backup = {
      version,
      createdAt: new Date().toISOString(),
      database: process.env.DATABASE_NAME,
      schema,
      tables: {},
    };
    for (const table of tables) {
      const metadata = (
        await client.query(
          `SELECT column_name, data_type, column_default, is_nullable, character_maximum_length
        FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`,
          [schema, table],
        )
      ).rows;
      const columns = metadata.map((column) => column.column_name);
      backup.tables[table] = {
        columns,
        metadata,
        records: await rows(qualified(table), columns),
      };
    }
    const directory = path.resolve(__dirname, '../.tmp/database-backups');
    await fs.mkdir(directory, { recursive: true });
    const backupPath = path.join(
      directory,
      version + '-' + Date.now() + '.json',
    );
    await fs.writeFile(backupPath, JSON.stringify(backup), {
      flag: 'wx',
      mode: 0o600,
    });
    await client.query(sql);
    for (const [table, original] of Object.entries(backup.tables)) {
      const current = await rows(qualified(table), original.columns);
      if (
        digest(JSON.stringify(current)) !==
        digest(JSON.stringify(original.records))
      ) {
        throw new Error(
          'Os registros originais não foram preservados em ' +
            table +
            '. Alterações revertidas.',
        );
      }
    }
    await client.query(
      'INSERT INTO delivery_schema_versions (version,checksum) VALUES ($1,$2)',
      [version, digest(sql)],
    );
    await client.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          applied: version,
          originalTablesVerified: tables.length,
          recordsPreserved: Object.values(backup.tables).reduce(
            (sum, table) => sum + table.records.length,
            0,
          ),
          dataCopy: backupPath,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
