const fs = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  quiet: true,
});
const client = new Client({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionTimeoutMillis: 8000,
});
async function main() {
  if (!process.argv.includes('--execute'))
    throw new Error(
      'Use --execute only for an explicitly requested reset of manual cards.',
    );
  await client.connect();
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query(
      await fs.readFile(
        path.resolve(
          __dirname,
          '../database/migrations/20261006-manual-order-deletions.sql',
        ),
        'utf8',
      ),
    );
    await client.query(
      'LOCK TABLE manual_order_notes IN ACCESS EXCLUSIVE MODE',
    );
    await client.query(
      'INSERT INTO manual_order_deletions (id) SELECT id FROM manual_order_notes ON CONFLICT DO NOTHING',
    );
    const drafts = await client.query(
      "DELETE FROM orders WHERE source='manual' AND status='manual_draft' AND \"requestId\" IN (SELECT id FROM manual_order_notes)",
    );
    const cards = await client.query('DELETE FROM manual_order_notes');
    const remaining = await client.query(
      'SELECT count(*)::int total FROM manual_order_notes',
    );
    await client.query('COMMIT');
    console.log(
      JSON.stringify({
        deletedCards: cards.rowCount,
        deletedManualDraftOrders: drafts.rowCount,
        remainingCards: remaining.rows[0].total,
      }),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
