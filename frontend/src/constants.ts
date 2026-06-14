// ============================================================
// Статусы заказов
// ============================================================
export const ORDER_STATUSES = ['new', 'diagnosis', 'waiting_parts', 'repair', 'ready', 'completed', 'cancelled'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

/** Полные названия — для модалок, карточек, страниц */
export const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  diagnosis: 'Диагностика',
  waiting_parts: 'Ожидание запчасти',
  repair: 'Ремонт',
  ready: 'Готов к выдаче',
  completed: 'Выдан',
  cancelled: 'Отказ',
};

/** Краткие названия — для таблицы, канбан-карточек */
export const STATUS_LABELS_SHORT: Record<string, string> = {
  new: 'Новый',
  diagnosis: 'Диагностика',
  waiting_parts: 'Ожидание',
  repair: 'Ремонт',
  ready: 'Готов',
  completed: 'Выдан',
  cancelled: 'Отказ',
};

/** Названия колонок (множ. число) — для канбан-досок */
export const STATUS_LABELS_PLURAL: Record<string, string> = {
  new: 'Новые',
  diagnosis: 'Диагностика',
  waiting_parts: 'Ожидание',
  repair: 'Ремонт',
  ready: 'Готовы',
  completed: 'Выдано',
  cancelled: 'Отказы',
};

/** HEX-цвета статусов */
export const STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  diagnosis: '#f59e0b',
  waiting_parts: '#8b5cf6',
  repair: '#f97316',
  ready: '#22c55e',
  completed: '#6b7280',
  cancelled: '#ef4444',
};

/** CSS-классы статусов */
export const STATUS_CSS: Record<string, string> = {
  new: 's-new',
  diagnosis: 's-diagnosis',
  waiting_parts: 's-waiting',
  repair: 's-repair',
  ready: 's-ready',
  completed: 's-completed',
  cancelled: 's-cancelled',
};

// ============================================================
// Приоритеты
// ============================================================
export const PRIORITIES = [
  { value: 'normal', label: 'Обычный' },
  { value: 'urgent', label: 'Срочный' },
  { value: 'critical', label: 'Критичный' },
] as const;

// ============================================================
// Источники заявок
// ============================================================
export const SOURCES = [
  { value: 'звонок', label: 'Звонок' },
  { value: 'сайт', label: 'Сайт' },
  { value: 'instagram', label: 'Instagram' },
  { value: '2gis', label: '2GIS' },
  { value: 'реклама', label: 'Реклама' },
  { value: 'постоянный', label: 'Постоянный клиент' },
  { value: 'другое', label: 'Другое' },
] as const;
