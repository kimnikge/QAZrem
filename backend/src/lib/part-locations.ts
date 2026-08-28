// Остатки запчастей по локациям (part_locations).
// Инвариант: SUM(part_locations.quantity) по part_id === parts.quantity.
// Каждая операция, меняющая parts.quantity, обязана менять и part_locations.

import type { PoolClient } from 'pg';
import { BadRequestError } from './errors.js';

/** ID системной локации «Общий склад» (кэш между запросами) */
let defaultLocationId: number | null = null;

/** Возвращает id системной локации «Общий склад (система)» */
export async function getDefaultLocationId(client: PoolClient): Promise<number> {
  if (defaultLocationId !== null) return defaultLocationId;

  const res = await client.query(
    `SELECT id FROM locations WHERE name = 'Общий склад (система)' LIMIT 1`
  );
  if (res.rows.length === 0) {
    throw new BadRequestError(
      'Системная локация «Общий склад (система)» не найдена. Примените миграцию 1720050000000_part_transfers'
    );
  }
  const id: number = res.rows[0].id;
  defaultLocationId = id;
  return id;
}

/** Зачислить qty на локацию (locationId = null → «Общий склад») */
export async function depositPartLocation(
  client: PoolClient,
  partId: number,
  locationId: number | null,
  qty: number,
): Promise<void> {
  const locId = locationId ?? (await getDefaultLocationId(client));
  await client.query(
    `INSERT INTO part_locations (part_id, location_id, quantity, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (part_id, location_id)
     DO UPDATE SET quantity = part_locations.quantity + EXCLUDED.quantity, updated_at = NOW()`,
    [partId, locId, qty],
  );
}

/** Снять qty с локаций (в порядке возрастания location_id). Возвращает разбивку. */
export async function withdrawPartLocations(
  client: PoolClient,
  partId: number,
  qty: number,
): Promise<{ locationId: number; qty: number }[]> {
  const rows = await client.query(
    `SELECT location_id, quantity FROM part_locations
     WHERE part_id = $1 AND quantity > 0
     ORDER BY location_id
     FOR UPDATE`,
    [partId],
  );

  const used: { locationId: number; qty: number }[] = [];
  let remaining = qty;
  for (const r of rows.rows) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, r.quantity);
    remaining -= take;
    await client.query(
      `UPDATE part_locations SET quantity = quantity - $1, updated_at = NOW()
       WHERE part_id = $2 AND location_id = $3`,
      [take, partId, r.location_id],
    );
    used.push({ locationId: r.location_id, qty: take });
  }

  if (remaining > 0) {
    throw new BadRequestError(
      `Несоответствие остатков по локациям: не хватает ${remaining}шт. Обратитесь к админу.`
    );
  }
  return used;
}

/** Остаток запчасти на конкретной локации */
export async function getPartLocationBalance(
  client: PoolClient,
  partId: number,
  locationId: number,
): Promise<number> {
  const res = await client.query(
    `SELECT COALESCE(SUM(quantity), 0)::int AS qty
     FROM part_locations WHERE part_id = $1 AND location_id = $2`,
    [partId, locationId],
  );
  return res.rows[0].qty;
}
