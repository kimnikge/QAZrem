import { request } from './client';

export type PermissionInfo = { code: string; label: string };

export type PermissionsState = {
  permissions: PermissionInfo[];
  roles: Array<{ role: 'master' | 'reception'; permission: string }>;
  overrides: Array<{ user_id: number; user_name: string; role: string; permission: string; allowed: boolean }>;
};

export function getPermissions() {
  return request<PermissionsState>('/permissions');
}

export function setPermission(data: { role?: 'master' | 'reception'; user_id?: number; permission: string; allowed: boolean }) {
  return request<{ message?: string }>('/permissions', { method: 'PUT', body: JSON.stringify(data) });
}

export function resetPermissionOverride(userId: number, permission: string) {
  return request<{ message: string }>(`/permissions/overrides/${userId}/${encodeURIComponent(permission)}`, { method: 'DELETE' });
}
