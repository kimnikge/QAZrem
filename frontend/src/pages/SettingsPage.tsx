import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getSettings,
  createPaymentMethod, deletePaymentMethod,
  createExpenseCategory, deleteExpenseCategory,
  createUser, updateUser, deleteUser,
  getOrderGroups, createOrderGroup, updateOrderGroup, deleteOrderGroup,
  getLocations, createLocation, updateLocation, deleteLocation,
  getPrintTemplates, getPrintTemplate, getTemplateVariables,
  createPrintTemplate, updatePrintTemplate, deletePrintTemplate,
  samplePreviewPrintTemplate,
  type SettingsData, type UserCreateInput, type UserUpdateInput, type OrderGroup, type Location,
  type PrintTemplateListItem, type TemplateVariable
} from '../api';

type Tab = 'users' | 'statuses' | 'payments' | 'expenses' | 'groups' | 'locations' | 'templates';

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
// Модалка редактирования шаблона печати
// ============================================================
type PrintTemplateModalProps = {
  mode: 'create' | 'edit';
  templateId?: number;
  onClose: () => void;
  onSaved: () => void;
};

function PrintTemplateModal({ mode, templateId, onClose, onSaved }: PrintTemplateModalProps) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [lang, setLang] = useState<'ru' | 'kz'>('ru');
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [previewHtml, setPreviewHtml] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(mode === 'edit');
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getTemplateVariables().then(setVariables).catch(() => {});
    if (mode === 'edit' && templateId) {
      getPrintTemplate(templateId).then(t => {
        setName(t.name);
        setContent(t.content);
        setIsDefault(t.is_default);
        setLang((t.lang as 'ru' | 'kz') || 'ru');
      }).catch(err => setError(err.message)).finally(() => setLoading(false));
    }
  }, [mode, templateId]);

  // Debounced live preview
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      if (!content.trim()) { setPreviewHtml(''); return; }
      try {
        const res = await samplePreviewPrintTemplate(content);
        setPreviewHtml(res.html);
      } catch { /* игнорируем */ }
    }, 400);
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
  }, [content]);

  const groupedVars: Record<string, TemplateVariable[]> = {};
  for (const v of variables) {
    if (!groupedVars[v.group]) groupedVars[v.group] = [];
    groupedVars[v.group].push(v);
  }

  function insertVariable(key: string) {
    setContent(prev => prev + key);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (mode === 'create') {
        await createPrintTemplate({ name, content, is_default: isDefault, lang } as any);
      } else if (templateId) {
        await updatePrintTemplate(templateId, { name, content, is_default: isDefault, lang } as any);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28 }}>Загрузка...</div>
    </div>
  );

  const langLabels: Record<string, string> = { ru: '🇷🇺 Русский', kz: '🇰🇿 Қазақша' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, padding: 28, width: '95vw', maxWidth: 1200, maxHeight: '92vh', overflow: 'auto',
        display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <h3 style={{ margin: 0 }}>{mode === 'create' ? 'Новый шаблон' : 'Редактировать шаблон'}</h3>
        {error && <div className="error-message">{error}</div>}

        {/* Язык + Название + По умолчанию */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Язык</label>
            <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {(['ru', 'kz'] as const).map(l => (
                <button key={l} type="button"
                  onClick={() => setLang(l)}
                  style={{
                    padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13,
                    background: lang === l ? '#1a73e8' : '#fff',
                    color: lang === l ? '#fff' : '#333',
                    fontWeight: lang === l ? 600 : 400,
                  }}
                >{langLabels[l]}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Название</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
              По умолчанию
            </label>
          </div>
        </div>

        {/* Редактор + Переменные + Предпросмотр */}
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 450 }}>
          {/* Левая колонка: редактор */}
          <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>HTML-шаблон</label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              style={{
                flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6,
                fontSize: 12, fontFamily: 'monospace', resize: 'vertical', minHeight: 400, lineHeight: 1.5
              }}
              placeholder="<div>АКТ №#ЗАКАЗ-НОМЕР</div>..."
            />
          </div>

          {/* Средняя колонка: переменные */}
          <div style={{ width: 200, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: '#5f6368', marginBottom: 8, fontWeight: 600 }}>Переменные</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, maxHeight: 420, overflow: 'auto', background: '#f8f9fa' }}>
              {Object.entries(groupedVars).map(([group, vars]) => (
                <div key={group} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#5f6368', marginBottom: 4, textTransform: 'uppercase' }}>{group}</div>
                  {vars.map(v => (
                    <button key={v.key} type="button" onClick={() => insertVariable(v.key)} title={v.label}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '3px 6px',
                        border: 'none', borderRadius: 4, background: 'transparent', cursor: 'pointer',
                        fontSize: 11, fontFamily: 'monospace', color: '#1a73e8', marginBottom: 1
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#e8f0fe')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >{v.key}</button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Правая колонка: живой предпросмотр */}
          <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Предпросмотр</label>
            <div style={{
              flex: 1, border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden',
              background: '#fff', minHeight: 400
            }}>
              {previewHtml ? (
                <iframe
                  srcDoc={`<html><head><style>
                    body { font-family: Arial, sans-serif; font-size: 12px; padding: 16px; color: #1f2937; }
                    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
                    td, th { padding: 6px 8px; border: 1px solid #d1d5db; text-align: left; font-size: 11px; }
                    code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; }
                    h1 { font-size: 18px; }
                    h3 { font-size: 14px; }
</style></head><body>${previewHtml}</body></html>`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="Предпросмотр"
                />
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  Начните вводить HTML-шаблон с переменными — здесь появится живой предпросмотр документа
                </div>
              )}
            </div>
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
