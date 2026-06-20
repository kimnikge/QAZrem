import { request } from './client';

export type OrderGroup = {
  id: number;
  name: string;
  created_at: string;
  order_count: number;
};

export function getOrderGroups() {
  return request<OrderGroup[]>('/order-groups');
}

export function createOrderGroup(name: string) {
  return request<OrderGroup>('/order-groups', { method: 'POST', body: JSON.stringify({ name }) });
}

export function updateOrderGroup(id: number, name: string) {
  return request<OrderGroup>(`/order-groups/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

export function deleteOrderGroup(id: number) {
  return request<{ message: string }>(`/order-groups/${id}`, { method: 'DELETE' });
}
