import { request } from './client';

export type Location = { id: number; name: string; address: string | null; created_at: string };

export function getLocations() {
  return request<Location[]>('/locations');
}

export function createLocation(input: { name: string; address?: string }) {
  return request<Location>('/locations', { method: 'POST', body: JSON.stringify(input) });
}

export function updateLocation(id: number, input: { name: string; address?: string }) {
  return request<Location>(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteLocation(id: number) {
  return request<{ deleted: boolean }>(`/locations/${id}`, { method: 'DELETE' });
}
