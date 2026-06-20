import { request, buildQuery } from './client';

export type CatalogItem = { brand: string; model: string };
export type CatalogEntry = { id: number; brand: string; model: string; group_name: string | null };
export type CatalogListResponse = { items: CatalogEntry[]; total: number; groups: string[] };
export type ImeiSearchResult = {
  device_id: number; brand: string; model: string; imei: string; serial_number: string | null;
  client_id: number; client_name: string; client_phone: string;
};

export function searchDeviceCatalog(q: string) {
  return request<CatalogItem[]>(`/devices/catalog?q=${encodeURIComponent(q)}`);
}

export function getCatalog(params?: { search?: string; group?: string; limit?: number; offset?: number }) {
  return request<CatalogListResponse>(`/catalog${buildQuery({
    search: params?.search,
    group: params?.group,
    limit: params?.limit ?? 100,
    offset: params?.offset ?? 0,
  })}`);
}

export function createCatalogEntry(input: { brand: string; model: string; group_name?: string }) {
  return request<CatalogEntry>('/catalog', { method: 'POST', body: JSON.stringify(input) });
}

export function updateCatalogEntry(id: number, input: { brand: string; model: string; group_name?: string }) {
  return request<CatalogEntry>(`/catalog/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteCatalogEntry(id: number) {
  return request<{ deleted: boolean }>(`/catalog/${id}`, { method: 'DELETE' });
}

export function importCatalog(items: Array<{ brand: string; model: string; group_name?: string }>) {
  return request<{ inserted: number; skipped: number; total: number }>('/catalog/import', { method: 'POST', body: JSON.stringify(items) });
}

export function searchDeviceByImei(last4: string) {
  return request<ImeiSearchResult[]>(`/devices/search-imei?last4=${encodeURIComponent(last4)}`);
}
