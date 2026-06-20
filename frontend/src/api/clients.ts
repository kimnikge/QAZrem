import { request, buildQuery } from './client';

export type Client = {
  id: number; name: string; phone: string; email: string | null;
  total_spent: string; created_at: string;
};

export function getClients(params?: { search?: string; limit?: number }) {
  return request<Client[]>(`/clients${buildQuery({ search: params?.search, limit: params?.limit ?? 100 })}`);
}

export function getClient(id: number) {
  return request<Client & { devices?: Array<{ brand: string; model: string; imei: string }> }>(`/clients/${id}`);
}
