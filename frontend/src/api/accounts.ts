import { request } from './client';

export type CompanyAccount = {
  id: number; name: string; type: string;
  balance: string; is_active: boolean; sort_order: number;
};

export type CashTransfer = {
  id: number;
  from_account_id: number; from_account_name: string;
  to_account_id: number; to_account_name: string;
  amount: string; comment: string | null;
  created_by: number; created_by_name: string;
  created_at: string;
};

export type AccountTransaction = {
  created_at: string; type: string; description: string;
  income: string; outcome: string; balance: string;
};

export function getAccounts() {
  return request<CompanyAccount[]>('/accounts');
}

export function createAccount(data: { name: string; type?: string }) {
  return request<CompanyAccount>('/accounts', { method: 'POST', body: JSON.stringify(data) });
}

export function updateAccount(id: number, data: { name?: string; is_active?: boolean }) {
  return request<{ message: string }>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function getAccountTransactions(id: number) {
  return request<{ account: CompanyAccount; transactions: AccountTransaction[] }>(`/accounts/${id}/transactions`);
}

export function getTransfers() {
  return request<CashTransfer[]>('/transfers');
}

export function createTransfer(data: { from_account_id: number; to_account_id: number; amount: number; comment?: string }) {
  return request<CashTransfer>('/transfers', { method: 'POST', body: JSON.stringify(data) });
}

export type CashOperation = {
  id: number;
  account_id: number;
  type: 'income' | 'expense';
  amount: string;
  description: string | null;
  created_by: number;
  created_at: string;
};

export function createCashOperation(accountId: number, data: { type: 'income' | 'expense'; amount: number; description?: string }) {
  return request<CashOperation>(`/accounts/${accountId}/operations`, { method: 'POST', body: JSON.stringify(data) });
}
