// Гибкие права доступа (ТЗ Блок 10): роль admin — всё;
// остальные роли получают права через role_permissions и user_permission_overrides.
import { pool } from '../db/pool.js';

/** Каталог прав, которыми админ может наделять мастеров и приёмщиков */
export const PERMISSIONS = [
  { code: 'parts.view_purchase_price', label: 'Видеть закупочные цены' },
  { code: 'parts.receive', label: 'Оприходование' },
  { code: 'parts.writeoff', label: 'Списание брака' },
  { code: 'inventory.manage', label: 'Инвентаризация' },
  { code: 'catalog.manage', label: 'Категории и атрибуты' },
] as const;

/**
 * Есть ли у пользователя право.
 * Приоритет: индивидуальный override > право роли; admin — всегда всё.
 */
export async function hasPermission(
  userId: number,
  role: string,
  permission: string,
): Promise<boolean> {
  if (role === 'admin') return true;
  const result = await pool.query(
    `SELECT COALESCE(
       (SELECT o.allowed FROM user_permission_overrides o
         WHERE o.user_id = $1 AND o.permission = $2),
       (SELECT EXISTS(SELECT 1 FROM role_permissions rp
         WHERE rp.role = $3 AND rp.permission = $2))
     )::boolean AS allowed`,
    [userId, permission, role],
  );
  return Boolean(result.rows[0]?.allowed);
}

/**
 * Скрывает закупочные цены (и производные поля, например total_cost)
 * для пользователей без права parts.view_purchase_price.
 * admin и обладатели права видят значения как есть.
 *
 * Используется везде, где API отдаёт строки с purchase_price:
 * /parts, /warehouse/reports/stock, /warehouse/reports/by-category.
 */
export async function hidePurchasePrice(
  user: { userId: number; role: string } | undefined,
  rows: Array<Record<string, unknown>>,
  derivedFields: string[] = [],
): Promise<Array<Record<string, unknown>>> {
  if (!user || user.role === 'admin') return rows;
  const allowed = await hasPermission(user.userId, user.role, 'parts.view_purchase_price');
  if (allowed) return rows;

  for (const row of rows) {
    if ('purchase_price' in row) row.purchase_price = null;
    for (const field of derivedFields) {
      if (field in row) row[field] = null;
    }
  }
  return rows;
}
