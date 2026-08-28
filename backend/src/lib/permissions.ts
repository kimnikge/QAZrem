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
