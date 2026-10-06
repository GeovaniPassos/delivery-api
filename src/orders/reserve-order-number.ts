import { EntityManager } from 'typeorm';

// Both online orders and manual cards consume the orders table's sequence.
// Reserved numbers are never reused, even if a manual card is cancelled.
export async function reserveOrderNumber(
  manager: EntityManager,
): Promise<number> {
  const [row] = await manager.query(
    `SELECT nextval(pg_get_serial_sequence('orders', 'id'))::int AS number`,
  );
  return row.number;
}
