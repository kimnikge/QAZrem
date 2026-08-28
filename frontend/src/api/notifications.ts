import { request } from './client';

export type NotificationItem = {
  id: number;
  type_code: string;
  type_title: string;
  title: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};

export type NotificationType = { code: string; title: string; description: string | null };

export type NotificationSetting = {
  user_id: number;
  user_name?: string;
  role?: string;
  type_code: string;
  channel: 'telegram' | 'whatsapp' | 'app';
  enabled: boolean;
};

export function getNotifications(unreadOnly = false) {
  return request<{ notifications: NotificationItem[]; unread_count: number }>(
    `/notifications${unreadOnly ? '?unread=1' : ''}`,
  );
}

export function markNotificationRead(id: number) {
  return request<{ message: string }>(`/notifications/${id}/read`, { method: 'POST' });
}

export function markAllRead() {
  return request<{ message: string }>('/notifications/read-all', { method: 'POST' });
}

export function getNotificationTypes() {
  return request<NotificationType[]>('/notifications/types');
}

export function getNotificationSettings() {
  return request<NotificationSetting[]>('/notifications/settings');
}

export function saveNotificationSetting(data: { user_id: number; type_code: string; channel: string; enabled: boolean }) {
  return request<{ message: string }>('/notifications/settings', { method: 'PUT', body: JSON.stringify(data) });
}

export function runStaleCheck(days = 30) {
  return request<{ message: string; created: number }>('/notifications/stale-check', {
    method: 'POST',
    body: JSON.stringify({ days }),
  });
}
