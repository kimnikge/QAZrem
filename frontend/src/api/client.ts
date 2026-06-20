// ═══════════════════════════════════════════════════════════
// HTTP-клиент — общая основа для всех API-модулей
// ═══════════════════════════════════════════════════════════

const apiUrl = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  return sessionStorage.getItem('token');
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

/** Собрать query-строку из объекта */
export function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}
