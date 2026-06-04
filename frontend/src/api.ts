const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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

// --- Auth ---
export type UserInfo = { id: number; name: string; login: string; role: string };
export type LoginResponse = { user: UserInfo; token: string };

export function login(login: string, password: string) {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login, password })
  });
}

// --- Clients ---
export type Client = {
  id: number; name: string; phone: string; email: string | null;
  total_spent: string; created_at: string;
};

// --- Search ---
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

// --- Orders ---
export type Order = {
  id: number; device_id: number; master_id: number | null;
  status_id: number; issue_description: string; diagnosis: string | null;
  cost: string; prepaid: string; internal_comment: string | null;
  created_at: string; completed_at: string | null;
  status_name: string; status_slug: string;
  brand: string; model: string; imei: string;
  client_id: number; client_name: string; client_phone: string;
};

export type OrderListResponse = { orders: Order[]; total: number; limit: number; offset: number };

export function getOrders(params?: { status?: string; search?: string; limit?: number; offset?: number }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return request<OrderListResponse>(`/orders${qs ? `?${qs}` : ''}`);
}

export type OrderDetail = Order & {
  history: Array<{ id: number; from_status_name: string | null; to_status_name: string; comment: string | null; user_name: string; created_at: string }>;
  parts: Array<{ id: number; part_name: string; sku: string; quantity_used: number; purchase_price_at_moment: string; selling_price_at_moment: string }>;
  payments: Array<{ id: number; amount: string; payment_method_name: string; is_prepayment: boolean; created_at: string }>;
};

export function getOrder(id: number) {
  return request<OrderDetail>(`/orders/${id}`);
}

export type CreateOrderInput = {
  client: { name: string; phone: string };
  device: { brand: string; model: string; imei: string };
  issue_description: string;
  master_id?: number;
};

export function createOrder(input: CreateOrderInput) {
  return request<{ id: number }>('/orders', { method: 'POST', body: JSON.stringify(input) });
}

export type AvailableStatus = { id: number; name: string; slug: string };

export function getOrderStatuses(id: number) {
  return request<{ current: string; available: AvailableStatus[] }>(`/orders/${id}/statuses`);
}

export function updateOrderStatus(id: number, status_slug: string, comment?: string) {
  return request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status_slug, comment }) });
}

// --- Parts ---
export type Part = {
  id: number; name: string; sku: string; compatible_models: string[];
  purchase_price: string; selling_price: string; quantity: number; min_quantity: number;
};

export function getParts(lowStock?: boolean) {
  return request<Part[]>(`/parts${lowStock ? '?low_stock=true' : ''}`);
}

// --- Finance ---
export type FinanceReport = {
  period: { from: string; to: string };
  income: number; expenses: { direct: number; parts_cost: number; total: number };
  profit: number; completed_orders: number;
};

export function getFinanceReport(from: string, to: string) {
  return request<FinanceReport>(`/finance/report?from=${from}&to=${to}`);
}

// --- Users ---
export function getMasters() {
  return request<{ id: number; name: string }[]>('/users/masters');
}
