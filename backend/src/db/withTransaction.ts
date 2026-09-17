// ═══════════════════════════════════════════════════════════
// withTransaction — единый хелпер транзакций.
//
// Устраняет повторяющийся в 15+ обработчиках паттерн:
//   const dbClient = await pool.connect();
//   try { await dbClient.query('BEGIN'); ... await dbClient.query('COMMIT'); }
//   catch (e) { await dbClient.query('ROLLBACK'); throw e; }
//   finally { dbClient.release(); }
//
// Использование:
//   const order = await withTransaction(async (tx) => {
//     await tx.query('UPDATE ...');
//     return orderId;
//   });
// ═══════════════════════════════════════════════════════════

import type { PoolClient } from 'pg';
import { pool } from './pool.js';

/**
 * Выполняет fn внутри транзакции: BEGIN → fn → COMMIT.
 * При ошибке — ROLLBACK и проброс исходной ошибки.
 * Клиент из пула гарантированно освобождается (finally).
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    // Если соединение разорвано, ROLLBACK может не пройти —
    // не маскируем исходную ошибку.
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
