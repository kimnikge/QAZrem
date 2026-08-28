import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { request } from '../api/client';

/**
 * Проверяет гибкое право текущего пользователя (ТЗ Блок 10).
 * admin — всегда true; для остальных запрашивается GET /permissions/check.
 */
export function usePermission(permission: string): boolean {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean>(user?.role === 'admin');

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    let cancelled = false;
    request<{ allowed: boolean }>(`/permissions/check?permission=${encodeURIComponent(permission)}`)
      .then((r) => { if (!cancelled) setAllowed(r.allowed); })
      .catch(() => { /* без права — оставляем false */ });
    return () => { cancelled = true; };
  }, [permission, user?.id, user?.role]);

  return allowed;
}
