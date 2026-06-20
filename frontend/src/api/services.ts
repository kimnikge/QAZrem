import { request } from './client';

export type Service = {
  id: number;
  name: string;
  price: string;
  master_commission_pct: number;
  created_at: string;
};

export function getServices() {
  return request<Service[]>('/services');
}

export function createService(data: { name: string; price: number; master_commission_pct: number }) {
  return request<Service>('/services', { method: 'POST', body: JSON.stringify(data) });
}

export function updateService(id: number, data: { name: string; price: number; master_commission_pct: number }) {
  return request<Service>(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteService(id: number) {
  return request<{ message: string }>(`/services/${id}`, { method: 'DELETE' });
}
