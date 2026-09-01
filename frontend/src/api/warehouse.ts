import { request, buildQuery } from './client';

// ═══════════════════════════════════════════
// Типы
// ═══════════════════════════════════════════

export type Category = { id: number; name: string; parent_id: number | null; created_at: string; parts_count?: number };
export type CategoryTree = { id: number; name: string; parent_id: number | null; depth: number; path: string[] };
export type CategoryAttribute = {
  id: number; category_id: number; name: string; attr_type: string;
  attr_options: string[] | null; sort_order: number; is_required: boolean;
};
export type InventorySheet = {
  id: number; location_id: number | null; created_by: number; status: string;
  notes: string | null; created_at: string; completed_at: string | null;
  created_by_name: string; location_name: string | null;
};
export type InventoryItem = {
  id: number; sheet_id: number; part_id: number; expected_quantity: number;
  actual_quantity: number | null; notes: string | null;
  part_name?: string; sku?: string;
};
export type Equipment = { id: number; name: string; master_id: number; quantity: number; notes: string | null; master_name?: string };

// ═══════════════════════════════════════════
// Категории
// ═══════════════════════════════════════════

export function getCategories() { return request<Category[]>('/warehouse/categories'); }
export function getCategoryTree() { return request<CategoryTree[]>('/warehouse/categories/tree'); }
export function createCategory(data: { name: string; parent_id?: number | null }) { return request<Category>('/warehouse/categories', { method: 'POST', body: JSON.stringify(data) }); }
export function updateCategory(id: number, data: { name?: string; parent_id?: number | null }) { return request<Category>(`/warehouse/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function deleteCategory(id: number) { return request<{ message: string }>(`/warehouse/categories/${id}`, { method: 'DELETE' }); }

// Атрибуты категорий
export function getCategoryAttributes(categoryId: number) { return request<CategoryAttribute[]>(`/warehouse/categories/${categoryId}/attributes`); }
export function createCategoryAttribute(categoryId: number, data: { name: string; attr_type?: string; attr_options?: string[]; sort_order?: number; is_required?: boolean }) {
  return request<CategoryAttribute>(`/warehouse/categories/${categoryId}/attributes`, { method: 'POST', body: JSON.stringify(data) });
}
export function updateCategoryAttribute(attrId: number, data: Record<string, unknown>) { return request<CategoryAttribute>(`/warehouse/categories/attributes/${attrId}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function deleteCategoryAttribute(attrId: number) { return request<{ message: string }>(`/warehouse/categories/attributes/${attrId}`, { method: 'DELETE' }); }

// ═══════════════════════════════════════════
// Инвентаризация
// ═══════════════════════════════════════════

export function getInventorySheets(status?: string) { return request<InventorySheet[]>(`/warehouse/inventory${buildQuery({ status })}`); }
export function createInventorySheet(data: { location_id?: number | null; notes?: string }) { return request<InventorySheet>('/warehouse/inventory', { method: 'POST', body: JSON.stringify(data) }); }
export function getInventorySheet(id: number) { return request<{ items: InventoryItem[] } & InventorySheet>(`/warehouse/inventory/${id}`); }
export function updateSheetStatus(id: number, status: string) { return request<InventorySheet>(`/warehouse/inventory/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); }
export function updateInventoryItem(itemId: number, data: { actual_quantity: number | null; notes?: string }) { return request<InventoryItem>(`/warehouse/inventory/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) }); }

// ═══════════════════════════════════════════
// Оборудование
// ═══════════════════════════════════════════

export function getEquipment(masterId?: number) { return request<Equipment[]>(`/warehouse/inventory/equipment${buildQuery({ master_id: masterId })}`); }
export function createEquipment(data: { name: string; master_id: number; quantity?: number; notes?: string }) { return request<Equipment>('/warehouse/inventory/equipment', { method: 'POST', body: JSON.stringify(data) }); }
export function updateEquipment(id: number, data: Record<string, unknown>) { return request<Equipment>(`/warehouse/inventory/equipment/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function deleteEquipment(id: number) { return request<{ message: string }>(`/warehouse/inventory/equipment/${id}`, { method: 'DELETE' }); }

// ═══════════════════════════════════════════
// Отчёты
// ═══════════════════════════════════════════

export function getStockReport(categoryId?: number) { return request<any[]>(`/warehouse/reports/stock${buildQuery({ category_id: categoryId })}`); }
export function getMovementReport(filters: { from?: string; to?: string; type?: string; limit?: number }) { return request<{ movements: any[]; summary: any[] }>(`/warehouse/reports/movements${buildQuery(filters)}`); }
export function getTopParts(limit?: number) { return request<any[]>(`/warehouse/reports/top-parts${buildQuery({ limit })}`); }
export function getStaleParts(days?: number) { return request<any[]>(`/warehouse/reports/stale${buildQuery({ days })}`); }
export function getSupplierReport() { return request<any[]>('/warehouse/reports/by-supplier'); }
export function getCategoryReport() { return request<any[]>('/warehouse/reports/by-category'); }
