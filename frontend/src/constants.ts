// ═══════════════════════════════════════════════════════════
// Константы — реэкспорт из api/domain.ts (единый источник истины).
//
// Оставлено для обратной совместимости.
// Новый код должен импортировать напрямую из '../api/domain'.
// ═══════════════════════════════════════════════════════════

export {
  ORDER_STATUS_SLUGS as ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_LABELS_SHORT,
  STATUS_LABELS_PLURAL,
  STATUS_COLORS,
  STATUS_TRANSITIONS,
  STATUS_CSS,
  PRIORITY_LABELS,
  SOURCE_OPTIONS as SOURCES,
  type OrderStatusSlug as OrderStatus,
} from './api/domain';

// Для обратной совместимости: {value, label} формат
export const PRIORITIES = [
  { value: 'normal' as const, label: 'Обычный' },
  { value: 'urgent' as const, label: 'Срочный' },
  { value: 'critical' as const, label: 'Критичный' },
] as const;
