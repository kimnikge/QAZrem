import { request } from './client';

export type SettingsData = {
  order_statuses: Array<{ id: number; name: string; slug: string; order: number; is_final: boolean }>;
  payment_methods: Array<{ id: number; name: string }>;
  expense_categories: Array<{ id: number; name: string }>;
  users: Array<{ id: number; name: string; login: string; role: string; default_commission_pct: string; created_at: string }>;
};

export function getSettings() {
  return request<SettingsData>('/settings');
}

export function createPaymentMethod(name: string) {
  return request<{ id: number; name: string }>('/settings/payment-methods', {
    method: 'POST', body: JSON.stringify({ name })
  });
}

export function deletePaymentMethod(id: number) {
  return request(`/settings/payment-methods/${id}`, { method: 'DELETE' });
}

export function createExpenseCategory(name: string) {
  return request<{ id: number; name: string }>('/settings/expense-categories', {
    method: 'POST', body: JSON.stringify({ name })
  });
}

export function deleteExpenseCategory(id: number) {
  return request(`/settings/expense-categories/${id}`, { method: 'DELETE' });
}
