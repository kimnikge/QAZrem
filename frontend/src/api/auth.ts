import { request } from './client';

export type UserInfo = { id: number; name: string; login: string; role: string };
export type LoginResponse = { user: UserInfo; token: string };

export function login(login: string, password: string) {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login, password })
  });
}

/** Очистить httpOnly cookie на сервере (Bearer-токен чистит AuthContext) */
export function logout() {
  return request<{ message: string }>('/auth/logout', { method: 'POST' });
}
