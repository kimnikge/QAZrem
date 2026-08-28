import { request, buildQuery } from './client';

export type Part = {
  id: number; name: string; sku: string;
  purchase_price: string; selling_price: string; quantity: number; min_quantity: number;
  category_id: number | null; category_name: string | null;
  categories: { id: number; name: string; is_primary: boolean }[];
  model_name: string | null; unit: string; photo_url: string | null; is_active: boolean;
  attributes: Record<string, unknown>;
  tags: { id: number; name: string; color: string }[];
};

export function getParts(params?: { low_stock?: boolean; category_id?: number; tag_id?: number; search?: string; inactive?: boolean }) {
  return request<Part[]>(`/parts${buildQuery({
    low_stock: params?.low_stock ? 'true' : undefined,
    category_id: params?.category_id,
    tag_id: params?.tag_id,
    search: params?.search,
    inactive: params?.inactive ? 'true' : undefined,
  })}`);
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

// ═══════════════════════════════════════════
// Теги
// ═══════════════════════════════════════════

export type Tag = { id: number; name: string; color: string; parts_count?: number };

export function getTags() { return request<Tag[]>('/parts/tags'); }
export function createTag(name: string, color?: string) { return request<Tag>('/parts/tags', { method: 'POST', body: JSON.stringify({ name, color }) }); }
export function deleteTag(id: number) { return request<{ message: string }>(`/parts/tags/${id}`, { method: 'DELETE' }); }

// ═══════════════════════════════════════════
// CRUD запчастей
// ═══════════════════════════════════════════

export type CreatePartInput = {
  name: string; sku?: string; purchase_price: number; selling_price: number;
  quantity?: number; min_quantity?: number;
  category_id?: number | null; category_ids?: number[]; primary_category_id?: number | null;
  model_name?: string; attributes?: Record<string, unknown>;
  unit?: string; photo_url?: string; tag_ids?: number[];
};

export function createPart(data: CreatePartInput) {
  return request<Part>('/parts', { method: 'POST', body: JSON.stringify(data) });
}

export function updatePart(id: number, data: Partial<CreatePartInput>) {
  return request<Part>(`/parts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deletePart(id: number) {
  return request<{ message: string }>(`/parts/${id}`, { method: 'DELETE' });
}

export function receivePart(part_id: number, quantity: number, document?: string, supplier_id?: number, supplier_sku?: string, batch_number?: string) {
  return request<{ message: string }>('/parts/movement', {
    method: 'POST', body: JSON.stringify({ part_id, quantity, document, supplier_id, supplier_sku, batch_number })
  });
}

export function correctPart(data: { part_id: number; actual_quantity?: number; delta?: number; document?: string; reason?: string }) {
  return request<{ message: string; quantity: number; delta: number; batches?: string }>('/parts/correction', {
    method: 'POST', body: JSON.stringify(data)
  });
}

export function transferPart(data: { part_id: number; quantity: number; from_location_id: number; to_location_id: number; document?: string }) {
  return request<{ message: string; quantity: number; from_location_id: number; to_location_id: number }>('/parts/transfer', {
    method: 'POST', body: JSON.stringify(data)
  });
}
