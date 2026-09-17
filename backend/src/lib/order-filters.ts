// ═══════════════════════════════════════════════════════════
// Фильтры заказов — единое построение WHERE для всех выборок
// заказов (GET /orders, GET /orders/export).
//
// Раньше логика фильтров была скопирована в двух обработчиках
// с ручным инкрементом $1, $2, ... — легко рассинхронизировать.
//
// ⚠️ Контракт: запросы обязаны использовать алиасы таблиц
//    o (orders), os (order_statuses), d (devices), c (clients).
// ═══════════════════════════════════════════════════════════

export interface OrderFilters {
  status?: string;
  master_id?: string;
  search?: string;
  overdue?: string;
  my?: string;
  group_id?: string;
  created_from?: string;
  created_to?: string;
  brand?: string;
  model?: string;
  client_id?: string;
}

export interface BuiltWhere {
  /** SQL-условия, соединённые через AND (без WHERE) */
  clause: string;
  /** Параметры в порядке плейсхолдеров $1..$N */
  params: unknown[];
}

/**
 * Строит WHERE-условия по фильтрам списка заказов.
 * Пропускает пустые фильтры; 'null' для group_id → IS NULL.
 */
export function buildOrderWhere(
  filters: OrderFilters,
  currentUserId?: number,
): BuiltWhere {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const and = (clause: string, value?: unknown) => {
    conditions.push(clause);
    if (value !== undefined) params.push(value);
  };
  const p = (): number => params.length + 1;

  if (filters.status) and(`os.slug = $${p()}`, filters.status);
  if (filters.master_id) and(`o.master_id = $${p()}`, Number(filters.master_id));
  if (filters.search) {
    and(
      `(c.name ILIKE $${p()} OR c.phone ILIKE $${p()} OR d.imei ILIKE $${p()})`,
      `%${filters.search}%`,
    );
  }
  if (filters.overdue === 'true') {
    and(`o.deadline IS NOT NULL AND o.deadline < NOW() AND os.is_final = FALSE`);
  }
  if (filters.my === 'true' && currentUserId) {
    and(`o.master_id = $${p()}`, currentUserId);
  }
  if (filters.group_id) {
    if (filters.group_id === 'null') {
      and('o.group_id IS NULL');
    } else {
      and(`o.group_id = $${p()}`, Number(filters.group_id));
    }
  }
  if (filters.created_from) and(`o.created_at >= $${p()}`, filters.created_from);
  if (filters.created_to) and(`o.created_at <= $${p()}`, filters.created_to);
  if (filters.brand) and(`d.brand ILIKE $${p()}`, `%${filters.brand}%`);
  if (filters.model) and(`d.model ILIKE $${p()}`, `%${filters.model}%`);
  if (filters.client_id) and(`c.id = $${p()}`, Number(filters.client_id));

  return { clause: conditions.join(' AND '), params };
}
