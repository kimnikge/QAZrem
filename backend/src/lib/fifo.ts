// ═══════════════════════════════════════════════════════════
// FIFO-списание по партиям — ЕДИНСТВЕННАЯ реализация.
//
// Раньше один и тот же цикл «SELECT партий FOR UPDATE → снятие
// по очереди → проверка покрытия» был скопирован трижды:
//   1) routes/parts.ts          (POST /parts/writeoff)
//   2) services/order.service.ts assignPartToOrder()
//   3) services/order.service.ts writeoffParts()
//
// Правило: любое списание остатков идёт только через withdrawFifo.
// ═══════════════════════════════════════════════════════════

import type { PoolClient } from 'pg';
import { BadRequestError } from './errors.js';

/** Что и из какой партии было списано */
export interface FifoBatchUsage {
  batchId: number;
  batchNumber: string;
  qty: number;
  price: number;
}

/**
 * Списывает qty по партиям от старейшей к новейшей (FIFO).
 *
 * @param client      клиент транзакции (BEGIN уже открыт)
 * @param partId      id запчасти
 * @param qty         сколько списать
 * @param errorMessage опциональное сообщение при нехватке партий
 *                    (по умолчанию — стандартное «Несоответствие остатков»)
 */
export async function withdrawFifo(
  client: PoolClient,
  partId: number,
  qty: number,
  errorMessage?: (missing: number) => string,
): Promise<FifoBatchUsage[]> {
  const batches = await client.query(
    `SELECT id, batch_number, current_quantity, purchase_price
     FROM part_batches
     WHERE part_id = $1 AND current_quantity > 0
     ORDER BY received_at ASC, id ASC
     FOR UPDATE`,
    [partId],
  );

  const used: FifoBatchUsage[] = [];
  let remaining = qty;
  for (const batch of batches.rows) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.current_quantity);
    remaining -= take;
    await client.query(
      'UPDATE part_batches SET current_quantity = current_quantity - $1 WHERE id = $2',
      [take, batch.id],
    );
    used.push({
      batchId: batch.id,
      batchNumber: batch.batch_number,
      qty: take,
      price: Number(batch.purchase_price),
    });
  }

  if (remaining > 0) {
    throw new BadRequestError(
      errorMessage
        ? errorMessage(remaining)
        : `Несоответствие остатков: в партиях не хватает ${remaining}шт. Обратитесь к админу.`,
    );
  }
  return used;
}
