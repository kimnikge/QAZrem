// VITE_API_URL в dev: http://localhost:4000
// В production (Vercel): не задан → используем /api (same-origin, через rewrite)
const apiUrl = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  return sessionStorage.getItem('token');
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

// --- Device catalog ---
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
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.group) query.set('group', params.group);
  if (params?.limit) query.set('limit', String(params.limit || 100));
  if (params?.offset) query.set('offset', String(params.offset || 0));
  const qs = query.toString();
  return request<CatalogListResponse>(`/catalog${qs ? `?${qs}` : ''}`);
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

// --- Orders ---
export type Order = {
  id: number; device_id: number; master_id: number | null;
  status_id: number; issue_description: string; diagnosis: string | null;
  cost: string; estimated_cost: string; discount: string; prepaid: string;
  deadline: string | null; status_deadline: string | null;
  priority: string; source: string | null; internal_comment: string | null;
  master_commission_pct: string;
  created_at: string; completed_at: string | null;
  is_overdue: boolean;
  status_name: string; status_slug: string;
  brand: string; model: string; imei: string; serial_number: string | null; color: string | null;
  client_id: number; client_name: string; client_phone: string;
  master_name: string | null;
  created_by_name: string | null;
  group_id: number | null;
  group_name: string | null;
  location_id: number | null;
  location_name: string | null;
};

export type OrderListResponse = { orders: Order[]; total: number; limit: number; offset: number };

export function getOrders(params?: { status?: string; search?: string; overdue?: string; my?: string; group_id?: string; limit?: number; offset?: number }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.overdue) query.set('overdue', params.overdue);
  if (params?.my) query.set('my', params.my);
  if (params?.group_id) query.set('group_id', params.group_id);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return request<OrderListResponse>(`/orders${qs ? `?${qs}` : ''}`);
}

export type OrderDetail = Order & {
  history: Array<{ id: number; from_status_name: string | null; to_status_name: string; comment: string | null; user_name: string; created_at: string }>;
  parts: Array<{ id: number; part_name: string; sku: string; quantity_used: number; purchase_price_at_moment: string; selling_price_at_moment: string }>;
  payments: Array<{ id: number; amount: string; payment_method_name: string; is_prepayment: boolean; created_at: string; refunded_at: string | null; refund_reason: string | null }>;
  group_name: string | null;
};

export function getOrder(id: number) {
  return request<OrderDetail>(`/orders/${id}`);
}

export type CreateOrderInput = {
  client: { name: string; phone: string; email?: string; address?: string };
  device: { brand: string; model: string; imei: string; serial_number?: string; color?: string };
  issue_description: string;
  master_id?: number;
  deadline?: string;
  priority?: 'normal' | 'urgent' | 'critical';
  source: string;
  estimated_cost?: number;
  discount?: number;
  parts?: Array<{ part_id: number; quantity: number }>;
  group_id?: number;
  location_id?: number;
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

export function updateOrder(id: number, body: Record<string, unknown>) {
  return request(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function assignPartToOrder(orderId: number, partId: number, quantity: number) {
  return request(`/orders/${orderId}/parts`, { method: 'POST', body: JSON.stringify({ part_id: partId, quantity }) });
}

export function deleteOrderPart(orderId: number, partId: number) {
  return request(`/orders/${orderId}/parts/${partId}`, { method: 'DELETE' });
}

// --- Parts ---
export type Part = {
  id: number; name: string; sku: string; compatible_models: string[];
  purchase_price: string; selling_price: string; quantity: number; min_quantity: number;
};

export function getParts(lowStock?: boolean) {
  return request<Part[]>(`/parts${lowStock ? '?low_stock=true' : ''}`);
}

export type CreatePartInput = {
  name: string; sku: string; purchase_price: number; selling_price: number;
  quantity?: number; min_quantity?: number; compatible_models?: string[];
};

export function createPart(data: CreatePartInput) {
  return request<Part>('/parts', { method: 'POST', body: JSON.stringify(data) });
}

export function updatePart(id: number, data: Partial<CreatePartInput>) {
  return request<Part>(`/parts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function receivePart(part_id: number, quantity: number, document?: string) {
  return request<{ message: string }>('/parts/movement', {
    method: 'POST', body: JSON.stringify({ part_id, quantity, document })
  });
}

// --- Finance ---
export type FinanceReport = {
  period: { from: string; to: string };
  income: number;
  income_orders: Array<{
    id: number; client_name: string; brand: string; model: string;
    cost: number; discount: number; completed_at: string;
  }>;
  paid: number;
  paid_orders: Array<{
    order_id: number; amount: number; payment_method_name: string;
    client_name: string; completed_at: string;
  }>;
  debt: number;
  debt_orders: Array<{
    id: number; client_name: string; brand: string; model: string;
    cost: number; discount: number; paid_total: number;
    balance: number; completed_at: string;
  }>;
  expenses: { direct: number; parts_cost: number; total: number };
  expense_items: Array<{
    type: 'expense' | 'part'; id: number; amount: number;
    category_name: string; description: string; created_at: string;
    part_name?: string; quantity_used?: number;
    purchase_price?: number; order_id?: number;
  }>;
  profit: number; completed_orders: number;
};

export function getFinanceReport(from: string, to: string) {
  return request<FinanceReport>(`/finance/report?from=${from}&to=${to}`);
}

export type CreatePaymentInput = {
  order_id: number;
  amount: number;
  payment_method_id: number;
  is_prepayment?: boolean;
};

export function createPayment(data: CreatePaymentInput) {
  return request<{ id: number }>('/payments', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function deletePayment(id: number) {
  return request(`/payments/${id}`, { method: 'DELETE' });
}

export function refundPayment(id: number, reason?: string) {
  return request<{ success: boolean }>(`/payments/${id}/refund`, {
    method: 'PATCH',
    body: JSON.stringify({ reason })
  });
}

export type MasterPayout = {
  order_id: number;
  cost: string;
  discount: string;
  master_commission_pct: string;
  completed_at: string;
  master_id: number;
  master_name: string;
  parts_cost: string;
  profit: string;
  master_payout: string;
};

export type MasterPayoutsResponse = {
  period: { from: string; to: string; label: string };
  masters: Array<{
    master_id: number;
    master_name: string;
    orders: MasterPayout[];
    total_profit: number;
    total_payout: number;
  }>;
};

export function getMasterPayouts(period: string, master_id?: number) {
  const query = `period=${period}${master_id ? `&master_id=${master_id}` : ''}`;
  return request<MasterPayoutsResponse>(`/finance/master-payouts?${query}`);
}

// --- Users ---
export function getMasters() {
  return request<{ id: number; name: string; default_commission_pct: string }[]>('/users/masters');
}

export function getAllUsers() {
  return request<Array<{ id: number; name: string; login: string; role: string; default_commission_pct: string }>>('/users');
}

// --- Settings ---
export type SettingsData = {
  order_statuses: Array<{ id: number; name: string; slug: string; order: number; is_final: boolean }>;
  payment_methods: Array<{ id: number; name: string }>;
  expense_categories: Array<{ id: number; name: string }>;
  users: Array<{ id: number; name: string; login: string; role: string; default_commission_pct: string; created_at: string }>;
};

export function getSettings() {
  return request<SettingsData>('/settings');
}

export function createPaymentMethod(name: string) {
  return request<{ id: number; name: string }>('/settings/payment-methods', {
    method: 'POST', body: JSON.stringify({ name })
  });
}

export function deletePaymentMethod(id: number) {
  return request(`/settings/payment-methods/${id}`, { method: 'DELETE' });
}

export function createExpenseCategory(name: string) {
  return request<{ id: number; name: string }>('/settings/expense-categories', {
    method: 'POST', body: JSON.stringify({ name })
  });
}

export function deleteExpenseCategory(id: number) {
  return request(`/settings/expense-categories/${id}`, { method: 'DELETE' });
}

// --- Locations ---
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

// --- User management (admin) ---
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

// --- Order Groups ---
export type OrderGroup = {
  id: number;
  name: string;
  created_at: string;
  order_count: number;
};

export function getOrderGroups() {
  return request<OrderGroup[]>('/order-groups');
}

export function createOrderGroup(name: string) {
  return request<OrderGroup>('/order-groups', {
    method: 'POST',
    body: JSON.stringify({ name })
  });
}

export function updateOrderGroup(id: number, name: string) {
  return request<OrderGroup>(`/order-groups/${id}`, {
    method: 'PATCH', body: JSON.stringify({ name })
  });
}

export function deleteOrderGroup(id: number) {
  return request<{ message: string }>(`/order-groups/${id}`, { method: 'DELETE' });
}

// ============================================================
// Услуги (Services)
// ============================================================

export type Service = {
  id: number;
  name: string;
  price: string;
  master_commission_pct: number;
  created_at: string;
};

export function getServices() {
  return request<Service[]>('/services');
}

export function createService(data: { name: string; price: number; master_commission_pct: number }) {
  return request<Service>('/services', {
    method: 'POST', body: JSON.stringify(data)
  });
}

export function updateService(id: number, data: { name: string; price: number; master_commission_pct: number }) {
  return request<Service>(`/services/${id}`, {
    method: 'PATCH', body: JSON.stringify(data)
  });
}

export function deleteService(id: number) {
  return request<{ message: string }>(`/services/${id}`, { method: 'DELETE' });
}

// ============================================================
// Шаблоны печати (Print Templates)
// ============================================================

export type PrintTemplate = {
  id: number;
  name: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type PrintTemplateListItem = {
  id: number;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type TemplateVariable = {
  key: string;
  label: string;
  group: string;
};

export function getPrintTemplates() {
  return request<PrintTemplateListItem[]>('/print-templates');
}

export function getPrintTemplate(id: number) {
  return request<PrintTemplate>(`/print-templates/${id}`);
}

export function getTemplateVariables() {
  return request<TemplateVariable[]>('/print-templates/variables');
}

export function createPrintTemplate(data: { name: string; content: string; is_default?: boolean }) {
  return request<PrintTemplate>('/print-templates', {
    method: 'POST', body: JSON.stringify(data)
  });
}

export function updatePrintTemplate(id: number, data: { name: string; content: string; is_default?: boolean }) {
  return request<PrintTemplate>(`/print-templates/${id}`, {
    method: 'PUT', body: JSON.stringify(data)
  });
}

export function deletePrintTemplate(id: number) {
  return request<{ message: string }>(`/print-templates/${id}`, { method: 'DELETE' });
}

export function previewPrintTemplate(orderId: number, templateId?: number) {
  const qs = templateId ? `?templateId=${templateId}` : '';
  return request<{ html: string }>(`/print-templates/preview/${orderId}${qs}`);
}
