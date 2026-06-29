// ═══════════════════════════════════════════════════════════
// ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ — общие типы и константы.
//
// Бэкенд:   import { STATUS_TRANSITIONS, ... } from '../types/domain.js'
// Фронтенд: import { STATUS_TRANSITIONS, ... } from '../api/domain'
//
// ⚠️ При изменении — синхронизировать frontend/src/api/domain.ts
// ═══════════════════════════════════════════════════════════

// ─── Статусы заказов ────────────────────────────────────

export const ORDER_STATUS_SLUGS = [
  'new', 'diagnosis', 'waiting_parts', 'repair', 'ready', 'completed', 'cancelled',
] as const;

export type OrderStatusSlug = typeof ORDER_STATUS_SLUGS[number];

export const STATUS_LABELS: Record<OrderStatusSlug, string> = {
  new: 'Новая',
  diagnosis: 'Диагностика',
  waiting_parts: 'Ожидание запчасти',
  repair: 'Ремонт',
  ready: 'Готов к выдаче',
  completed: 'Выдан',
  cancelled: 'Отказ',
};

export const STATUS_LABELS_SHORT: Record<OrderStatusSlug, string> = {
  new: 'Новый',
  diagnosis: 'Диагностика',
  waiting_parts: 'Ожидание',
  repair: 'Ремонт',
  ready: 'Готов',
  completed: 'Выдан',
  cancelled: 'Отказ',
};

export const STATUS_COLORS: Record<OrderStatusSlug, string> = {
  new: '#3b82f6',
  diagnosis: '#d97706',
  waiting_parts: '#7c3aed',
  repair: '#5c5a52',
  ready: '#16a34a',
  completed: '#9ca3af',
  cancelled: '#dc2626',
};

/** Допустимые переходы между статусов — единый источник */
export const STATUS_TRANSITIONS: Record<string, readonly OrderStatusSlug[]> = {
  new: ['diagnosis', 'cancelled'],
  diagnosis: ['waiting_parts', 'repair', 'ready', 'cancelled'],
  waiting_parts: ['repair', 'cancelled'],
  repair: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// ─── Приоритеты ──────────────────────────────────────────

export const PRIORITIES = ['normal', 'urgent', 'critical'] as const;
export type Priority = typeof PRIORITIES[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  normal: 'Обычный',
  urgent: 'Срочный',
  critical: 'Критичный',
};

// ─── Роли ────────────────────────────────────────────────

export const USER_ROLES = ['admin', 'master', 'reception'] as const;
export type UserRole = typeof USER_ROLES[number];

// ─── Источники заявок ───────────────────────────────────

export const SOURCES = [
  'звонок', 'сайт', 'instagram', '2gis', 'реклама', 'постоянный', 'другое',
] as const;
export type Source = typeof SOURCES[number];

// ─── Типы данных (API-контракт, snake_case как в БД) ────

export interface OrderBase {
  id: number;
  device_id: number;
  master_id: number | null;
  status_id: number;
  issue_description: string;
  diagnosis: string | null;
  cost: number;
  estimated_cost: number;
  prepaid: number;
  discount: number;
  internal_comment: string | null;
  deadline: string | null;
  status_deadline: string | null;
  priority: Priority;
  source: string | null;
  master_commission_pct: number;
  group_id: number | null;
  location_id: number | null;
  created_at: string;
  completed_at: string | null;
  is_overdue: boolean;
  status_name: string;
  status_slug: OrderStatusSlug;
  brand: string;
  model: string;
  imei: string;
  serial_number: string | null;
  color: string | null;
  client_id: number;
  client_name: string;
  client_phone: string;
  client_address: string | null;
  master_name: string | null;
  group_name: string | null;
  location_name: string | null;
  created_by_name: string | null;
  password: string | null;
  face_id: boolean;
  completeness: string | null;
  condition: string | null;
  appearance: string | null;
  manager_notes: string | null;
  order_type: 'paid' | 'warranty';
  image_url: string | null;
}

export interface ClientBase {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  total_spent: number;
  created_at: string;
}

export interface PartBase {
  id: number;
  name: string;
  sku: string;
  compatible_models: string[];
  purchase_price: number;
  selling_price: number;
  quantity: number;
  min_quantity: number;
  category_id: number | null;
  category_name: string | null;
  model_name: string | null;
  unit: string;
  photo_url: string | null;
  is_active: boolean;
  attributes: Record<string, unknown>;
  tags: Array<{ id: number; name: string; color: string }>;
}

export interface PaymentBase {
  id: number;
  order_id: number;
  amount: number;
  payment_method_id: number;
  payment_method_name: string;
  is_prepayment: boolean;
  created_at: string;
  refunded_at: string | null;
  refund_reason: string | null;
}

export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}
