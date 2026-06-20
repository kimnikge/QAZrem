import { request, buildQuery } from './client';

export type Part = {
  id: number; name: string; sku: string; compatible_models: string[];
  purchase_price: string; selling_price: string; quantity: number; min_quantity: number;
};

export function getParts(lowStock?: boolean) {
  return request<Part[]>(`/parts${lowStock ? '?low_stock=true' : ''}`);
}

export function writeoffPart(data: { part_id: number; quantity: number; document?: string }) {
  return request<{ message: string }>('/parts/writeoff', { method: 'POST', body: JSON.stringify(data) });
}

export function getPartsSummary() {
  return request<{ total_items: number; total_quantity: number; total_cost: string; total_value: string; low_stock_count: number }>('/parts/summary');
}

export function getPartMovements(params?: { part_id?: number; type?: string; limit?: number }) {
  return request<{ movements: Array<{ id: number; part_name: string; sku: string; type: string; quantity: number; document: string | null; created_at: string }>; total: number }>(`/parts/movements${buildQuery({ part_id: params?.part_id, type: params?.type, limit: params?.limit })}`);
}

export type CreatePartInput = {
  name: string; sku: string; purchase_price: number; selling_price: number;
  quantity?: number; min_quantity?: number; compatible_models?: string[];
};

export function createPart(data: CreatePartInput) {
  return request<Part>('/parts', { method: 'POST', body: JSON.stringify(data) });
}

export function updatePart(id: number, data: Partial<CreatePartInput>) {
  return request<Part>(`/parts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function receivePart(part_id: number, quantity: number, document?: string) {
  return request<{ message: string }>('/parts/movement', {
    method: 'POST', body: JSON.stringify({ part_id, quantity, document })
  });
}
