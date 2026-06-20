import { request } from './client';

export type FinanceReport = {
  period: { from: string; to: string };
  income: number;
  income_orders: Array<{
    id: number; client_name: string; brand: string; model: string;
    cost: number; discount: number; completed_at: string;
  }>;
  paid: number;
  paid_orders: Array<{
    order_id: number; amount: number; payment_method_name: string;
    client_name: string; completed_at: string;
  }>;
  debt: number;
  debt_orders: Array<{
    id: number; client_name: string; brand: string; model: string;
    cost: number; discount: number; paid_total: number;
    balance: number; completed_at: string;
  }>;
  expenses: { direct: number; parts_cost: number; total: number };
  expense_items: Array<{
    type: 'expense' | 'part'; id: number; amount: number;
    category_name: string; description: string; created_at: string;
    part_name?: string; quantity_used?: number;
    purchase_price?: number; order_id?: number;
  }>;
  profit: number; completed_orders: number;
};

export function getFinanceReport(from: string, to: string) {
  return request<FinanceReport>(`/finance/report?from=${from}&to=${to}`);
}

// --- Payments ---

export type CreatePaymentInput = {
  order_id: number;
  amount: number;
  payment_method_id: number;
  is_prepayment?: boolean;
  splits?: Array<{ account_id: number; amount: number }>;
};

export function createPayment(data: CreatePaymentInput) {
  return request<{ id: number }>('/payments', { method: 'POST', body: JSON.stringify(data) });
}

export function deletePayment(id: number) {
  return request(`/payments/${id}`, { method: 'DELETE' });
}

export function updatePayment(id: number, payment_method_id: number) {
  return request<{ success: boolean; payment_method_id: number }>(`/payments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ payment_method_id })
  });
}

export function refundPayment(id: number, reason?: string) {
  return request<{ success: boolean }>(`/payments/${id}/refund`, {
    method: 'PATCH',
    body: JSON.stringify({ reason })
  });
}

export function getRefunds() {
  return request<Array<{ id: number; amount: string; refunded_at: string; refund_reason: string | null; payment_method_name: string; order_id: number; client_name: string }>>('/payments/refunds');
}

// --- Master payouts ---

export type MasterPayout = {
  order_id: number;
  cost: string;
  discount: string;
  master_commission_pct: string;
  completed_at: string;
  master_id: number;
  master_name: string;
  parts_cost: string;
  profit: string;
  master_payout: string;
};

export type MasterPayoutsResponse = {
  period: { from: string; to: string; label: string };
  masters: Array<{
    master_id: number;
    master_name: string;
    orders: MasterPayout[];
    total_profit: number;
    total_payout: number;
  }>;
};

export function getMasterPayouts(period: string, master_id?: number) {
  const query = `period=${period}${master_id ? `&master_id=${master_id}` : ''}`;
  return request<MasterPayoutsResponse>(`/finance/master-payouts?${query}`);
}
