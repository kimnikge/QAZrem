import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getSettings,
  createPaymentMethod, deletePaymentMethod,
  createExpenseCategory, deleteExpenseCategory,
  deleteUser,
  getOrderGroups, createOrderGroup, updateOrderGroup, deleteOrderGroup,
  getLocations, createLocation, updateLocation, deleteLocation,
  getPrintTemplates, deletePrintTemplate,
  type SettingsData, type OrderGroup, type Location,
  type PrintTemplateListItem
} from '../api';
import { UserFormModal } from '../components/UserFormModal';
import { PrintTemplateModal } from '../components/PrintTemplateModal';

type Tab = 'users' | 'statuses' | 'payments' | 'expenses' | 'groups' | 'locations' | 'templates';

const roleLabels: Record<string, string> = {
  admin: 'Админ',
  master: 'Мастер',
  reception: 'Приёмщик'
};

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

  // Locations
  const [locations, setLocations] = useState<Location[]>([]);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [editLocationId, setEditLocationId] = useState<number | null>(null);
  const [editLocationName, setEditLocationName] = useState('');
  const [editLocationAddress, setEditLocationAddress] = useState('');

  // User form modal
  const [userModal, setUserModal] = useState<{ mode: 'create' } | { mode: 'edit'; user: SettingsData['users'][0] } | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  // Templates
  const [templates, setTemplates] = useState<PrintTemplateListItem[]>([]);
  const [templateModal, setTemplateModal] = useState<{ mode: 'create' } | { mode: 'edit'; id: number } | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);

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

  useEffect(() => { load(); loadGroups(); loadLocations(); }, []);

  async function loadTemplates() {
    setTemplatesLoading(true);
    try {
      setTemplates(await getPrintTemplates());
    } catch (err) {
      console.error(err);
    } finally {
      setTemplatesLoading(false);
    }
  }

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

  async function loadLocations() {
    try {
      setLocations(await getLocations());
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddLocation() {
    if (!newLocationName.trim()) return;
    try {
      await createLocation({ name: newLocationName.trim(), address: newLocationAddress.trim() || undefined });
      setNewLocationName('');
      setNewLocationAddress('');
      await loadLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleSaveLocation() {
    if (!editLocationId || !editLocationName.trim()) return;
    try {
      await updateLocation(editLocationId, { name: editLocationName.trim(), address: editLocationAddress.trim() || undefined });
      setEditLocationId(null);
      await loadLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleDeleteLocation(id: number, name: string) {
    if (!confirm(`Удалить локацию "${name}"?`)) return;
    try {
      await deleteLocation(id);
      await loadLocations();
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
    { key: 'locations', label: 'Локации' },
    { key: 'templates', label: 'Шаблоны печати' },
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
                      <th>Пароль</th>
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
                          <span style={{ color: '#9ca3af', letterSpacing: 2, userSelect: 'none' }} title="Пароль хранится в зашифрованном виде">
                            ••••••••
                          </span>
                        </td>
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
          {/* Вкладка: Локации */}
          {/* ============================================================ */}
          {tab === 'locations' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  className="filter-select"
                  placeholder="Название локации"
                  value={newLocationName}
                  onChange={e => setNewLocationName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddLocation()}
                  style={{ flex: 1 }}
                />
                <input
                  className="filter-select"
                  placeholder="Адрес"
                  value={newLocationAddress}
                  onChange={e => setNewLocationAddress(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddLocation()}
                  style={{ flex: 1 }}
                />
                <button className="ro-btn-primary" onClick={handleAddLocation}>Добавить</button>
              </div>
              <div className="ro-table-wrap">
                <table className="ro-table">
                  <thead><tr><th>ID</th><th>Название</th><th>Адрес</th><th style={{ width: 120 }}></th></tr></thead>
                  <tbody>
                    {locations.map(l => (
                      <tr key={l.id}>
                        <td>{l.id}</td>
                        <td>
                          {editLocationId === l.id ? (
                            <input
                              value={editLocationName}
                              onChange={e => setEditLocationName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveLocation(); if (e.key === 'Escape') setEditLocationId(null); }}
                              autoFocus
                              style={{ padding: '4px 8px', border: '1px solid var(--primary)', borderRadius: 4, fontSize: 13, width: '100%' }}
                            />
                          ) : (
                            <strong>{l.name}</strong>
                          )}
                        </td>
                        <td>
                          {editLocationId === l.id ? (
                            <input
                              value={editLocationAddress}
                              onChange={e => setEditLocationAddress(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveLocation(); if (e.key === 'Escape') setEditLocationId(null); }}
                              style={{ padding: '4px 8px', border: '1px solid var(--primary)', borderRadius: 4, fontSize: 13, width: '100%' }}
                            />
                          ) : (
                            <span style={{ color: l.address ? 'var(--text)' : '#9ca3af', fontSize: 13 }}>{l.address || '—'}</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {editLocationId === l.id ? (
                              <>
                                <button className="btn-status" onClick={handleSaveLocation} title="Сохранить" style={{ color: '#16a34a' }}>✓</button>
                                <button className="btn-status" onClick={() => setEditLocationId(null)} title="Отмена" style={{ color: '#6b7280' }}>✕</button>
                              </>
                            ) : (
                              <>
                                <button className="btn-status" onClick={() => { setEditLocationId(l.id); setEditLocationName(l.name); setEditLocationAddress(l.address || ''); }} title="Редактировать">✏️</button>
                                <button className="btn-status" onClick={() => handleDeleteLocation(l.id, l.name)} style={{ color: '#ef4444' }} title="Удалить">✕</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {locations.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>Нет локаций</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* Вкладка: Шаблоны печати (только admin) */}
          {/* ============================================================ */}
          {tab === 'templates' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  {[{ key: '', label: 'Все' }, { key: 'ru', label: '🇷🇺 RU' }, { key: 'kz', label: '🇰🇿 KZ' }].map(f => (
                    <button key={f.key} type="button" onClick={() => {
                      setTemplates([]);
                      getPrintTemplates().then(all => setTemplates(f.key ? all.filter(t => t.lang === f.key) : all)).catch(() => {});
                    }}
                    style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 12, background: '#fff' }}
                    >{f.label}</button>
                  ))}
                </div>
                <button className="ro-btn-primary" onClick={() => { loadTemplates(); setTemplateModal({ mode: 'create' }); }}>
                  + Новый шаблон
                </button>
              </div>

              {templatesLoading ? <div className="loading">Загрузка...</div> : (
                <div className="ro-table-wrap">
                  <table className="ro-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Название</th>
                        <th>Язык</th>
                        <th>По умолч.</th>
                        <th>Обновлён</th>
                        <th style={{ width: 120 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map(t => (
                        <tr key={t.id}>
                          <td>{t.id}</td>
                          <td><strong>{t.name}</strong></td>
                          <td><span style={{ fontSize: 13 }}>{t.lang === 'kz' ? '🇰🇿 KZ' : '🇷🇺 RU'}</span></td>
                          <td>{t.is_default ? '✅' : '—'}</td>
                          <td className="ro-cell-date">{new Date(t.updated_at).toLocaleDateString()}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn-status" onClick={() => setTemplateModal({ mode: 'edit', id: t.id })}
                                title="Редактировать">✏️</button>
                              <button className="btn-status" onClick={async () => {
                                if (!confirm(`Удалить шаблон "${t.name}"?`)) return;
                                try { await deletePrintTemplate(t.id); loadTemplates(); }
                                catch (err) { setError(err instanceof Error ? err.message : 'Ошибка'); }
                              }} style={{ color: '#ef4444' }} title="Удалить">✕</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {templates.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>
                          Нет шаблонов. Создайте первый шаблон для печати квитанций.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
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

      {templateModal && (
        <PrintTemplateModal
          mode={templateModal.mode}
          templateId={templateModal.mode === 'edit' ? templateModal.id : undefined}
          onClose={() => setTemplateModal(null)}
          onSaved={() => { setTemplateModal(null); loadTemplates(); }}
        />
      )}
    </div>
  );
}
