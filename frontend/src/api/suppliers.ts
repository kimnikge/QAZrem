import { request } from './client';

export type Supplier = {
  id: number; name: string;
  contact_person: string | null; phone: string | null; email: string | null;
  notes: string | null; created_at: string;
  deliveries_count?: number;
};

export type CreateSupplierInput = {
  name: string; contact_person?: string; phone?: string; email?: string; notes?: string;
};

export function getSuppliers() {
  return request<Supplier[]>('/suppliers');
}

export function createSupplier(data: CreateSupplierInput) {
  return request<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(data) });
}

export function updateSupplier(id: number, data: Partial<CreateSupplierInput>) {
  return request<Supplier>(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteSupplier(id: number) {
  return request<{ message: string }>(`/suppliers/${id}`, { method: 'DELETE' });
}

export function returnToSupplier(supplierId: number, data: { batch_id: number; part_id: number; quantity: number; reason?: string }) {
  return request<{ message: string }>(`/suppliers/${supplierId}/return`, { method: 'POST', body: JSON.stringify(data) });
}
