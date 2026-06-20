import { request } from './client';

export function getMasters() {
  return request<{ id: number; name: string; default_commission_pct: string }[]>('/users/masters');
}

export function getAllUsers() {
  return request<Array<{ id: number; name: string; login: string; role: string; default_commission_pct: string }>>('/users');
}

export type UserCreateInput = {
  name: string;
  login: string;
  password: string;
  role: 'admin' | 'master' | 'reception';
  default_commission_pct?: number;
};

export type UserUpdateInput = {
  name?: string;
  login?: string;
  password?: string;
  role?: 'admin' | 'master' | 'reception';
  default_commission_pct?: number;
};

export function createUser(data: UserCreateInput) {
  return request<{ id: number; name: string; login: string; role: string; default_commission_pct: string; created_at: string }>('/users', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function updateUser(id: number, data: UserUpdateInput) {
  return request<{ id: number; name: string; login: string; role: string; default_commission_pct: string; created_at: string }>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

export function deleteUser(id: number) {
  return request<{ message: string }>(`/users/${id}`, { method: 'DELETE' });
}
