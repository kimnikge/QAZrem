import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getSettings,
  createPaymentMethod, deletePaymentMethod,
  createExpenseCategory, deleteExpenseCategory,
  createUser, updateUser, deleteUser,
  getOrderGroups, createOrderGroup, updateOrderGroup, deleteOrderGroup,
  type SettingsData, type UserCreateInput, type UserUpdateInput, type OrderGroup
} from '../api';

type Tab = 'users' | 'statuses' | 'payments' | 'expenses' | 'groups';

const roleLabels: Record<string, string> = {
  admin: 'Админ',
  master: 'Мастер',
  reception: 'Приёмщик'
};

// ============================================================
// Форма создания/редактирования пользователя
// ============================================================
type UserFormModalProps = {
  mode: 'create' | 'edit';
  initial?: { id: number; name: string; login: string; role: string };
  onClose: () => void;
  onSaved: () => void;
};

function UserFormModal({ mode, initial, onClose, onSaved }: UserFormModalProps) {
  const [name, setName] = useState(initial?.name || '');
  const [login, setLogin] = useState(initial?.login || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>(initial?.role || 'master');
  const [commissionPct, setCommissionPct] = useState(
    initial ? String(Math.round(Number((initial as any).default_commission_pct || 50))) : '50'
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const commission = Math.round(Number(commissionPct));
      if (commission < 0 || commission > 100) {
        throw new Error('Процент комиссии должен быть от 0 до 100');
      }
      if (mode === 'create') {
        await createUser({ name, login, password, role: role as UserCreateInput['role'], default_commission_pct: commission });
      } else if (initial) {
        const data: UserUpdateInput = { name, login, role: role as UserUpdateInput['role'], default_commission_pct: commission };
        if (password.trim()) data.password = password;
        await updateUser(initial.id, data);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, padding: 28, width: 420,
        display: 'flex', flexDirection: 'column', gap: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <h3 style={{ margin: 0 }}>{mode === 'create' ? 'Новый пользователь' : 'Редактировать'}</h3>

        {error && <div className="error-message">{error}</div>}

        <div>
          <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Имя</label>
          <input value={name} onChange={e => setName(e.target.value)} required
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Логин</label>
          <input value={login} onChange={e => setLogin(e.target.value)} required
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>
            Пароль {mode === 'edit' && <span style={{ color: '#999' }}>(оставьте пустым, чтобы не менять)</span>}
          </label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            required={mode === 'create'} minLength={mode === 'create' ? 6 : undefined}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Роль</label>
          <select value={role} onChange={e => setRole(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}>
            <option value="admin">Админ</option>
            <option value="master">Мастер</option>
            <option value="reception">Приёмщик</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>
            % комиссии мастера {role !== 'master' && <span style={{ color: '#999' }}>(только для мастеров)</span>}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" min={0} max={100}
              value={commissionPct}
              onChange={e => setCommissionPct(e.target.value)}
              style={{ width: 100, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}
            />
            <span style={{ fontSize: 14, color: '#5f6368' }}>%</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'end', marginTop: 8 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Сохранение...' : mode === 'create' ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// Основная страница
// ============================================================
export function SettingsPage() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('users');
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New payment method
  const [newPayment, setNewPayment] = useState('');
  // New expense category
  const [newExpense, setNewExpense] = useState('');

  // Groups
  const [groups, setGroups] = useState<OrderGroup[]>([]);
  const [newGroup, setNewGroup] = useState('');
  const [editGroupId, setEditGroupId] = useState<number | null>(null);
  const [editGroupName, setEditGroupName] = useState('');

  // User form modal
  const [userModal, setUserModal] = useState<{ mode: 'create' } | { mode: 'edit'; user: SettingsData['users'][0] } | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await getSettings();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); loadGroups(); }, []);

  async function loadGroups() {
    try {
      const g = await getOrderGroups();
      setGroups(g);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddPayment() {
    if (!newPayment.trim()) return;
    try {
      await createPaymentMethod(newPayment.trim());
      setNewPayment('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleDeletePayment(id: number) {
    if (!confirm('Удалить способ оплаты?')) return;
    try {
      await deletePaymentMethod(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleAddExpense() {
    if (!newExpense.trim()) return;
    try {
      await createExpenseCategory(newExpense.trim());
      setNewExpense('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleDeleteExpense(id: number) {
    if (!confirm('Удалить категорию расходов?')) return;
    try {
      await deleteExpenseCategory(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleAddGroup() {
    if (!newGroup.trim()) return;
    try {
      await createOrderGroup(newGroup.trim());
      setNewGroup('');
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleRenameGroup() {
    if (!editGroupId || !editGroupName.trim()) return;
    try {
      await updateOrderGroup(editGroupId, editGroupName.trim());
      setEditGroupId(null);
      setEditGroupName('');
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleDeleteGroup(id: number, name: string) {
    if (!confirm(`Удалить группу "${name}"? Заказы в ней останутся без группы.`)) return;
    try {
      await deleteOrderGroup(id);
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleDeleteUser(id: number, name: string) {
    if (!confirm(`Удалить пользователя "${name}"?`)) return;
    setDeletingUserId(id);
    try {
      await deleteUser(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setDeletingUserId(null);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'users', label: 'Пользователи' },
    { key: 'statuses', label: 'Статусы заказов' },
    { key: 'groups', label: 'Группы заказов' },
    { key: 'payments', label: 'Способы оплаты' },
    { key: 'expenses', label: 'Категории расходов' },
  ];

  return (
    <div className="ro-dashboard">
      <div className="page-header"><h2>Настройки</h2></div>

      {error && <div className="error-message" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="ro-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`ro-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="loading">Загрузка...</div> : !data ? <div className="error-message">Ошибка загрузки</div> : (
        <>
          {/* ============================================================ */}
          {/* Вкладка: Пользователи */}
          {/* ============================================================ */}
          {tab === 'users' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button className="ro-btn-primary" onClick={() => setUserModal({ mode: 'create' })}>
                  + Новый пользователь
                </button>
              </div>

              <div className="ro-table-wrap">
                <table className="ro-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Имя</th>
                      <th>Логин</th>
                      <th>Роль</th>
                      <th>Комиссия</th>
                      <th>Создан</th>
                      <th style={{ width: 100 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map(u => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>
                          <strong>{u.name}</strong>
                          {u.id === currentUser?.id && <span style={{ fontSize: 11, color: '#5f6368', marginLeft: 6 }}>(вы)</span>}
                        </td>
                        <td>{u.login}</td>
                        <td>
                          <span className={`ro-badge ${u.role === 'admin' ? 's-ready' : u.role === 'master' ? 's-diagnosis' : 's-new'}`}>
                            {roleLabels[u.role] || u.role}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 600, color: u.role === 'master' ? '#1a73e8' : '#999' }}>
                            {u.role === 'master' ? `${Math.round(Number((u as any).default_commission_pct || 50))}%` : '—'}
                          </span>
                        </td>
                        <td className="ro-cell-date">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn-status"
                              onClick={() => setUserModal({ mode: 'edit', user: u })}
                              title="Редактировать"
                            >
                              ✏️
                            </button>
                            {u.id !== currentUser?.id && (
                              <button
                                className="btn-status"
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                disabled={deletingUserId === u.id}
                                style={{ color: '#ef4444' }}
                                title="Удалить"
                              >
                                {deletingUserId === u.id ? '...' : '✕'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* Вкладка: Статусы заказов */}
          {/* ============================================================ */}
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

          {/* ============================================================ */}
          {/* Вкладка: Способы оплаты */}
          {/* ============================================================ */}
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

          {/* ============================================================ */}
          {/* Вкладка: Категории расходов */}
          {/* ============================================================ */}
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

          {/* ============================================================ */}
          {/* Вкладка: Группы заказов */}
          {/* ============================================================ */}
          {tab === 'groups' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  className="filter-select"
                  placeholder="Название новой группы"
                  value={newGroup}
                  onChange={e => setNewGroup(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                  style={{ flex: 1 }}
                />
                <button className="ro-btn-primary" onClick={handleAddGroup}>Добавить</button>
              </div>
              <div className="ro-table-wrap">
                <table className="ro-table">
                  <thead><tr><th>ID</th><th>Название</th><th>Заказов</th><th style={{ width: 120 }}></th></tr></thead>
                  <tbody>
                    {groups.map(g => (
                      <tr key={g.id}>
                        <td>{g.id}</td>
                        <td>
                          {editGroupId === g.id ? (
                            <input
                              value={editGroupName}
                              onChange={e => setEditGroupName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRenameGroup(); if (e.key === 'Escape') setEditGroupId(null); }}
                              onBlur={handleRenameGroup}
                              autoFocus
                              style={{ padding: '4px 8px', border: '1px solid var(--primary)', borderRadius: 4, fontSize: 13, width: '100%' }}
                            />
                          ) : (
                            <strong>{g.name}</strong>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>{g.order_count}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn-status"
                              onClick={() => { setEditGroupId(g.id); setEditGroupName(g.name); }}
                              title="Переименовать"
                            >
                              ✏️
                            </button>
                            <button
                              className="btn-status"
                              onClick={() => handleDeleteGroup(g.id, g.name)}
                              style={{ color: '#ef4444' }}
                              title="Удалить"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {groups.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>Нет групп</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* Модальное окно создания/редактирования пользователя */}
      {/* ============================================================ */}
      {userModal && (
        <UserFormModal
          mode={userModal.mode}
          initial={userModal.mode === 'edit' ? userModal.user : undefined}
          onClose={() => setUserModal(null)}
          onSaved={() => { setUserModal(null); load(); }}
        />
      )}
    </div>
  );
}
