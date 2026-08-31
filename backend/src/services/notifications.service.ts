// Уведомления по складу (ТЗ Блок 11): 8 типов, каналы Telegram/WhatsApp
import { pool } from '../db/pool.js';
import { sendTelegramMessage } from './telegram.js';

export type NotificationTypeCode =
  | 'low_stock' | 'zero_stock' | 'stale' | 'return_order'
  | 'incoming' | 'inventory' | 'return_supplier' | 'reservation_cancelled';

/** Создаёт уведомление и доставляет его подписанным получателям. Никогда не бросает. */
export async function createNotification(
  typeCode: NotificationTypeCode,
  title: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO notifications (type_code, title, payload)
       VALUES ($1, $2, $3::jsonb)`,
      [typeCode, title, JSON.stringify(payload)],
    );
    await deliver(typeCode, title, payload);
  } catch (error) {
    console.error('[notifications] failed:', error instanceof Error ? error.message : error);
  }
}

/** Доставка по каналам согласно настройкам получателей */
async function deliver(
  typeCode: NotificationTypeCode,
  title: string,
  payload: Record<string, unknown>,
): Promise<void> {
  let settings: { rows: Array<{ channel: string }> };
  try {
    settings = await pool.query(
      `SELECT user_id, channel FROM notification_settings
       WHERE type_code = $1 AND enabled = TRUE`,
      [typeCode],
    );
  } catch (error) {
    console.error('[notifications] settings query failed:', error instanceof Error ? error.message : error);
    return;
  }

  const text = buildText(title, payload);
  for (const s of settings.rows) {
    if (s.channel === 'telegram') {
      try {
        await sendTelegramMessage(text);
      } catch (error) {
        console.error('[notifications] telegram:', error instanceof Error ? error.message : error);
      }
    } else if (s.channel === 'whatsapp') {
      // WhatsApp-канал заявлен в ТЗ; интеграция пока не настроена — логируем событие
      console.log(`[notifications] whatsapp (не настроен): ${title}`);
    }
    // channel='app' — доставка через ленту в приложении (запись уже создана)
  }
}

function buildText(title: string, payload: Record<string, unknown>): string {
  const lines = Object.entries(payload)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n');
  return lines ? `<b>${title}</b>\n${lines}` : `<b>${title}</b>`;
}

/** Проверяет остаток после изменения и создаёт low_stock / zero_stock (без дублей непрочитанных). */
export async function checkStockAlerts(partId: number): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT id, name, quantity, min_quantity FROM parts WHERE id = $1',
      [partId],
    );
    if (result.rows.length === 0) return;
    const p = result.rows[0];
    const type: NotificationTypeCode | null =
      p.quantity <= 0 ? 'zero_stock' : p.quantity <= p.min_quantity ? 'low_stock' : null;
    if (!type) return;

    const dup = await pool.query(
      `SELECT 1 FROM notifications
       WHERE type_code = $1 AND read_at IS NULL AND payload->>'part_id' = $2`,
      [type, String(p.id)],
    );
    if (dup.rows.length > 0) return;

    await createNotification(
      type,
      type === 'zero_stock'
        ? `Нулевой остаток: ${p.name}`
        : `Низкий остаток: ${p.name} (${p.quantity} ≤ ${p.min_quantity})`,
      { part_id: p.id, part_name: p.name, quantity: p.quantity, min_quantity: p.min_quantity },
    );
  } catch (error) {
    console.error('[notifications] stock alert failed:', error instanceof Error ? error.message : error);
  }
}

/** Генерация уведомлений о залежавшихся запчастях (без движений за N дней). Возвращает число созданных. */
export async function runStaleCheck(days = 30): Promise<number> {
  // Один SQL: детекция + дедупликация непрочитанных — без N+1 запросов к БД
  const result = await pool.query(
    `INSERT INTO notifications (type_code, title, payload)
     SELECT 'stale', 'Залежалась без движения: ' || p.name,
            jsonb_build_object('part_id', p.id, 'part_name', p.name, 'days', $1::int)
     FROM parts p
     WHERE p.is_active = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM part_movements pm
         WHERE pm.part_id = p.id AND pm.created_at > NOW() - ($1 * INTERVAL '1 day')
       )
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.type_code = 'stale' AND n.read_at IS NULL
           AND n.payload->>'part_id' = p.id::text
       )
     RETURNING id`,
    [days],
  );

  // Доставка подписчикам (обычно настроек нет — один запрос)
  try {
    const settings = await pool.query(
      `SELECT user_id, channel FROM notification_settings
       WHERE type_code = 'stale' AND enabled = TRUE`,
    );
    for (const s of settings.rows) {
      if (s.channel === 'telegram') {
        try {
          await sendTelegramMessage(`<b>Залежавшиеся запчасти</b>\nСоздано уведомлений: ${result.rowCount}`);
        } catch (error) {
          console.error('[notifications] telegram:', error instanceof Error ? error.message : error);
        }
      } else if (s.channel === 'whatsapp') {
        console.log('[notifications] whatsapp (не настроен): stale-check');
      }
    }
  } catch (error) {
    console.error('[notifications] stale delivery failed:', error instanceof Error ? error.message : error);
  }

  return result.rowCount ?? 0;
}
