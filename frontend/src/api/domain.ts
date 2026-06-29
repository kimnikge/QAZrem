// ═══════════════════════════════════════════════════════════
// ЗЕРКАЛО backend/src/types/domain.ts
//
// Синхронизировано вручную. При изменении domain.ts на бэкенде —
// обновить этот файл.
// ═══════════════════════════════════════════════════════════

export const ORDER_STATUS_SLUGS = [
  'new', 'diagnosis', 'waiting_parts', 'repair', 'ready', 'completed', 'cancelled',
] as const;

export type OrderStatusSlug = typeof ORDER_STATUS_SLUGS[number];

export const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  diagnosis: 'Диагностика',
  waiting_parts: 'Ожидание запчасти',
  repair: 'Ремонт',
  ready: 'Готов к выдаче',
  completed: 'Выдан',
  cancelled: 'Отказ',
};

export const STATUS_LABELS_SHORT: Record<string, string> = {
  new: 'Новый',
  diagnosis: 'Диагностика',
  waiting_parts: 'Ожидание',
  repair: 'Ремонт',
  ready: 'Готов',
  completed: 'Выдан',
  cancelled: 'Отказ',
};

export const STATUS_LABELS_PLURAL: Record<string, string> = {
  new: 'Новые',
  diagnosis: 'Диагностика',
  waiting_parts: 'Ожидание',
  repair: 'Ремонт',
  ready: 'Готовы',
  completed: 'Выдано',
  cancelled: 'Отказы',
};

export const STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  diagnosis: '#d97706',
  waiting_parts: '#7c3aed',
  repair: '#5c5a52',
  ready: '#16a34a',
  completed: '#9ca3af',
  cancelled: '#dc2626',
};

export const STATUS_CSS: Record<string, string> = {
  new: 's-new',
  diagnosis: 's-diagnosis',
  waiting_parts: 's-waiting',
  repair: 's-repair',
  ready: 's-ready',
  completed: 's-completed',
  cancelled: 's-cancelled',
};

/** Допустимые переходы — синхронизировано с backend/src/types/domain.ts */
export const STATUS_TRANSITIONS: Record<string, readonly OrderStatusSlug[]> = {
  new: ['diagnosis', 'cancelled'],
  diagnosis: ['waiting_parts', 'repair', 'ready', 'cancelled'],
  waiting_parts: ['repair', 'cancelled'],
  repair: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const PRIORITIES = ['normal', 'urgent', 'critical'] as const;
export type Priority = typeof PRIORITIES[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  normal: 'Обычный',
  urgent: 'Срочный',
  critical: 'Критичный',
};

export const USER_ROLES = ['admin', 'master', 'reception'] as const;
export type UserRole = typeof USER_ROLES[number];

export const SOURCES = [
  'звонок', 'сайт', 'instagram', '2gis', 'реклама', 'постоянный', 'другое',
] as const;

export const SOURCE_OPTIONS = [
  { value: 'звонок', label: 'Звонок' },
  { value: 'сайт', label: 'Сайт' },
  { value: 'instagram', label: 'Instagram' },
  { value: '2gis', label: '2GIS' },
  { value: 'реклама', label: 'Реклама' },
  { value: 'постоянный', label: 'Постоянный клиент' },
  { value: 'другое', label: 'Другое' },
] as const;
