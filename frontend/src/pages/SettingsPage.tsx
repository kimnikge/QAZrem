import { useEffect, useState } from 'react';
import {
  getSettings,
  createPaymentMethod, deletePaymentMethod,
  createExpenseCategory, deleteExpenseCategory,
  type SettingsData
} from '../api';

type Tab = 'users' | 'statuses' | 'payments' | 'expenses';

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('users');
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  // New payment method
  const [newPayment, setNewPayment] = useState('');
  // New expense category
  const [newExpense, setNewExpense] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await getSettings();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAddPayment() {
    if (!newPayment.trim()) return;
    await createPaymentMethod(newPayment.trim());
    setNewPayment('');
    await load();
  }

  async function handleDeletePayment(id: number) {
    await deletePaymentMethod(id);
    await load();
  }

  async function handleAddExpense() {
    if (!newExpense.trim()) return;
    await createExpenseCategory(newExpense.trim());
    setNewExpense('');
    await load();
  }

  async function handleDeleteExpense(id: number) {
    await deleteExpenseCategory(id);
    await load();
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'users', label: 'Пользователи' },
    { key: 'statuses', label: 'Статусы заказов' },
    { key: 'payments', label: 'Способы оплаты' },
    { key: 'expenses', label: 'Категории расходов' },
  ];

  return (
    <div className="ro-dashboard">
      <div className="page-header"><h2>Настройки</h2></div>

      <div className="ro-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`ro-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="loading">Загрузка...</div> : !data ? <div className="error-message">Ошибка загрузки</div> : (
        <>
          {tab === 'users' && (
            <div className="ro-table-wrap">
              <table className="ro-table">
                <thead><tr><th>ID</th><th>Имя</th><th>Логин</th><th>Роль</th><th>Создан</th></tr></thead>
                <tbody>
                  {data.users.map(u => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.login}</td>
                      <td><span className="ro-badge s-completed">{u.role === 'admin' ? 'Админ' : u.role === 'master' ? 'Мастер' : 'Приёмщик'}</span></td>
                      <td className="ro-cell-date">{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'statuses' && (
            <div className="ro-table-wrap">
              <table className="ro-table">
                <thead><tr><th>ID</th><th>Название</th><th>Slug</th><th>Порядок</th><th>Финальный</th></tr></thead>
                <tbody>
                  {data.order_statuses.map(s => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td><strong>{s.name}</strong></td>
                      <td><code>{s.slug}</code></td>
                      <td>{s.order}</td>
                      <td>{s.is_final ? '✅' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'payments' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  className="filter-select"
                  placeholder="Новый способ оплаты"
                  value={newPayment}
                  onChange={e => setNewPayment(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="ro-btn-primary" onClick={handleAddPayment}>Добавить</button>
              </div>
              <div className="ro-table-wrap">
                <table className="ro-table">
                  <thead><tr><th>ID</th><th>Название</th><th></th></tr></thead>
                  <tbody>
                    {data.payment_methods.map(p => (
                      <tr key={p.id}>
                        <td>{p.id}</td>
                        <td><strong>{p.name}</strong></td>
                        <td>
                          <button className="btn-status" onClick={() => handleDeletePayment(p.id)} style={{ color: '#ef4444' }}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'expenses' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  className="filter-select"
                  placeholder="Новая категория расходов"
                  value={newExpense}
                  onChange={e => setNewExpense(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="ro-btn-primary" onClick={handleAddExpense}>Добавить</button>
              </div>
              <div className="ro-table-wrap">
                <table className="ro-table">
                  <thead><tr><th>ID</th><th>Название</th><th></th></tr></thead>
                  <tbody>
                    {data.expense_categories.map(c => (
                      <tr key={c.id}>
                        <td>{c.id}</td>
                        <td><strong>{c.name}</strong></td>
                        <td>
                          <button className="btn-status" onClick={() => handleDeleteExpense(c.id)} style={{ color: '#ef4444' }}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
