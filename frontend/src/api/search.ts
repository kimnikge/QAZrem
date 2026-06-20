import { request } from './client';
import type { Client } from './clients';

export type Device = {
  id: number; client_id: number; brand: string; model: string;
  imei: string; serial_number: string | null; color: string | null;
};

export type SearchResult = {
  matchType: 'exact_device' | 'exact_phone' | 'partial_name' | 'no_results';
  clients: Array<{ client: Client; devices: Device[] }>;
};

export function search(q: string) {
  return request<SearchResult>(`/search?q=${encodeURIComponent(q)}`);
}
