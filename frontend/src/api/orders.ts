import { request, buildQuery } from './client';

export type Order = {
  id: number; device_id: number; master_id: number | null;
  status_id: number; issue_description: string; diagnosis: string | null;
  cost: string; estimated_cost: string; discount: string; prepaid: string;
  deadline: string | null; status_deadline: string | null;
  priority: string; source: string | null; internal_comment: string | null;
  master_commission_pct: string;
  created_at: string; completed_at: string | null;
  is_overdue: boolean;
  status_name: string; status_slug: string;
  brand: string; model: string; imei: string; serial_number: string | null; color: string | null;
  client_id: number; client_name: string; client_phone: string;
  master_name: string | null;
  created_by_name: string | null;
  group_id: number | null;
  group_name: string | null;
  location_id: number | null;
  location_name: string | null;
  password: string | null;
  face_id: boolean;
  completeness: string | null;
  condition: string | null;
  appearance: string | null;
  manager_notes: string | null;
  order_type: string;
  image_url: string | null;
};

export type OrderListResponse = { orders: Order[]; total: number; limit: number; offset: number };

export function getOrders(params?: {
  status?: string; search?: string; overdue?: string; my?: string;
  group_id?: string; master_id?: string;
  created_from?: string; created_to?: string;
  brand?: string; model?: string; client_id?: string;
  limit?: number; offset?: number;
}) {
  return request<OrderListResponse>(`/orders${buildQuery({
    status: params?.status,
    search: params?.search,
    overdue: params?.overdue,
    my: params?.my,
    group_id: params?.group_id,
    master_id: params?.master_id,
    created_from: params?.created_from,
    created_to: params?.created_to,
    brand: params?.brand,
    model: params?.model,
    client_id: params?.client_id,
    limit: params?.limit,
    offset: params?.offset,
  })}`);
}

export type OrderDetail = Order & {
  history: Array<{ id: number; from_status_name: string | null; to_status_name: string; comment: string | null; user_name: string; created_at: string }>;
  parts: Array<{ id: number; part_name: string; sku: string; quantity_used: number; purchase_price_at_moment: string; selling_price_at_moment: string }>;
  services: Array<{ service_id: number; service_name: string; quantity: number; price_at_moment: string; master_commission_pct_at_moment: number }>;
  payments: Array<{ id: number; amount: string; payment_method_id: number; payment_method_name: string; is_prepayment: boolean; created_at: string; refunded_at: string | null; refund_reason: string | null; splits?: Array<{ id: number; account_id: number; account_name: string; amount: string }> }>;
  group_name: string | null;
};

export function getOrder(id: number) {
  return request<OrderDetail>(`/orders/${id}`);
}

export type CreateOrderInput = {
  client: { name: string; phone: string; email?: string; address?: string };
  device: { brand: string; model: string; imei: string; serial_number?: string; color?: string };
  issue_description: string;
  master_id?: number;
  deadline?: string;
  priority?: 'normal' | 'urgent' | 'critical';
  source: string;
  estimated_cost?: number;
  discount?: number;
  parts?: Array<{ part_id: number; quantity: number }>;
  services?: Array<{ service_id: number; quantity?: number }>;
  group_id?: number;
  location_id?: number;
  password?: string;
  face_id?: boolean;
  completeness?: string;
  condition?: string;
  appearance?: string;
  manager_notes?: string;
  order_type?: 'paid' | 'warranty';
  image_url?: string;
};

export function createOrder(input: CreateOrderInput) {
  return request<{ id: number }>('/orders', { method: 'POST', body: JSON.stringify(input) });
}

export type AvailableStatus = { id: number; name: string; slug: string };

export function getOrderStatuses(id: number) {
  return request<{ current: string; available: AvailableStatus[] }>(`/orders/${id}/statuses`);
}

export function updateOrderStatus(id: number, status_slug: string, comment?: string) {
  return request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status_slug, comment }) });
}

export function updateOrder(id: number, body: Record<string, unknown>) {
  return request(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function assignPartToOrder(orderId: number, partId: number, quantity: number) {
  return request(`/orders/${orderId}/parts`, { method: 'POST', body: JSON.stringify({ part_id: partId, quantity }) });
}

export function deleteOrderPart(orderId: number, partId: number) {
  return request(`/orders/${orderId}/parts/${partId}`, { method: 'DELETE' });
}

export function assignServiceToOrder(orderId: number, serviceId: number, quantity: number = 1) {
  return request(`/orders/${orderId}/services`, { method: 'POST', body: JSON.stringify({ service_id: serviceId, quantity }) });
}

export function deleteOrderService(orderId: number, serviceId: number) {
  return request(`/orders/${orderId}/services/${serviceId}`, { method: 'DELETE' });
}

// ═══════════════════════════════════════════
// Резервирование
// ═══════════════════════════════════════════

export type Reservation = {
  id: number; part_id: number; batch_id: number | null; order_id: number;
  quantity: number; reserved_by: number; reserved_at: string; expires_at: string | null;
  status: string; part_name?: string; sku?: string; batch_number?: string; reserved_by_name?: string;
};

export function reservePart(orderId: number, data: { part_id: number; quantity: number; batch_id?: number }) {
  return request<Reservation>(`/orders/${orderId}/reserve`, { method: 'POST', body: JSON.stringify(data) });
}

export function getReservations(orderId: number) {
  return request<Reservation[]>(`/orders/${orderId}/reservations`);
}

export function cancelReservation(orderId: number, reservationId: number) {
  return request<{ message: string }>(`/orders/${orderId}/reserve/${reservationId}`, { method: 'DELETE' });
}
