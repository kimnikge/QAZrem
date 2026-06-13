import { useEffect, useState } from 'react';
import { Monitor, Plus, Save, X, Edit3, Upload, Search } from 'lucide-react';
import {
  getCatalog, createCatalogEntry, updateCatalogEntry, deleteCatalogEntry, importCatalog,
  type CatalogEntry,
} from '../api';
import { useAuth } from '../context/AuthContext';

const COMMON_GROUPS = [
  'Мобильный телефон', 'Планшет', 'Ноутбук', 'Смарт часы', 'Дрон',
  'Системный блок', 'Сканер', 'Медицинский прибор', 'Сервер',
  'Стабилизатор камеры', 'MacBook', 'MacBook Air', 'Macbook',
];

export function CatalogPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [items, setItems] = useState<CatalogEntry[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit inline
  const [editId, setEditId] = useState<number | null>(null);
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [saving, setSaving] = useState(false);

  // Import modal
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');

  async function load() {
    try {
      const res = await getCatalog({ search, group: groupFilter, limit: 200 });
      setItems(res.items);
      setGroups(res.groups);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [search, groupFilter]);

  async function handleCreate() {
    if (!newBrand.trim() || !newModel.trim()) return;
    setCreating(true);
    try {
      await createCatalogEntry({ brand: newBrand.trim(), model: newModel.trim(), group_name: newGroup.trim() || undefined });
      setShowCreate(false);
      setNewBrand('');
      setNewModel('');
      setNewGroup('');
      load();
    } catch (e: any) {
      alert(e?.message || 'Ошибка создания');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(item: CatalogEntry) {
    setEditId(item.id);
    setEditBrand(item.brand);
    setEditModel(item.model);
    setEditGroup(item.group_name || '');
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function handleSaveEdit() {
    if (!editId || !editBrand.trim() || !editModel.trim()) return;
    setSaving(true);
    try {
      await updateCatalogEntry(editId, { brand: editBrand.trim(), model: editModel.trim(), group_name: editGroup.trim() || undefined });
      setEditId(null);
      load();
    } catch (e: any) {
      alert(e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, brand: string, model: string) {
    if (!confirm(`Удалить "${brand} ${model}" из каталога?`)) return;
    try {
      await deleteCatalogEntry(id);
      load();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleImport() {
    if (!importText.trim()) return;
    const lines = importText.trim().split('\n').filter(l => l.trim());
    const parsed: Array<{ brand: string; model: string; group_name?: string }> = [];

    for (const line of lines) {
      // Support: group;brand;model  OR  brand;model
      const parts = line.split(';').map(p => p.trim().replace(/^"|"$/g, ''));
      if (parts.length >= 3) {
        parsed.push({ group_name: parts[0] || undefined, brand: parts[1], model: parts[2] });
      } else if (parts.length === 2) {
        parsed.push({ brand: parts[0], model: parts[1] });
      }
    }

    if (parsed.length === 0) {
      setImportResult('Не удалось распознать данные. Формат: бренд;модель или группа;бренд;модель');
      return;
    }

    setImporting(true);
    try {
      const res = await importCatalog(parsed);
      setImportResult(`✅ Добавлено: ${res.inserted}, пропущено (дубликаты): ${res.skipped}, всего в файле: ${res.total}`);
      load();
    } catch (e: any) {
      setImportResult(`❌ Ошибка: ${e?.message || 'Неизвестная ошибка'}`);
    } finally {
      setImporting(false);
    }
  }

  // Combine DB groups + common groups for datalist
  const allGroups = [...new Set([...COMMON_GROUPS, ...groups])].sort();

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <Monitor size={24} />
          <h2>Каталог устройств</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>{total} записей</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={() => setShowImport(true)}>
            <Upload size={16} /> Импорт CSV
          </button>
          {isAdmin && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> Добавить
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            className="glass-input"
            placeholder="Поиск по бренду или модели..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select className="glass-select" value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={{ width: 200 }}>
          <option value="">Все группы</option>
          {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {loading ? <div className="loading">Загрузка...</div> : (
        <div className="ro-table-wrap">
          <table className="ro-table">
            <thead>
              <tr>
                <th>Группа</th>
                <th>Бренд</th>
                <th>Модель</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>
                    {editId === item.id ? (
                      <input
                        value={editGroup}
                        onChange={e => setEditGroup(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                        list="groups-list"
                        autoFocus
                        style={{ padding: '4px 8px', border: '1px solid var(--primary)', borderRadius: 4, fontSize: 13, width: '100%' }}
                      />
                    ) : (
                      <span style={{ color: item.group_name ? 'var(--text)' : '#9ca3af', fontSize: 13 }}>
                        {item.group_name || '—'}
                      </span>
                    )}
                  </td>
                  <td>
                    {editId === item.id ? (
                      <input
                        value={editBrand}
                        onChange={e => setEditBrand(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                        style={{ padding: '4px 8px', border: '1px solid var(--primary)', borderRadius: 4, fontSize: 13, width: '100%' }}
                      />
                    ) : (
                      <strong>{item.brand}</strong>
                    )}
                  </td>
                  <td>
                    {editId === item.id ? (
                      <input
                        value={editModel}
                        onChange={e => setEditModel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                        style={{ padding: '4px 8px', border: '1px solid var(--primary)', borderRadius: 4, fontSize: 13, width: '100%' }}
                      />
                    ) : (
                      <span>{item.model}</span>
                    )}
                  </td>
                  <td>
                    {editId === item.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-status" onClick={handleSaveEdit} disabled={saving} title="Сохранить" style={{ color: '#16a34a' }}>
                          <Save size={14} />
                        </button>
                        <button className="btn-status" onClick={cancelEdit} title="Отмена" style={{ color: '#6b7280' }}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {isAdmin && (
                          <>
                            <button className="btn-status" onClick={() => startEdit(item)} title="Редактировать">
                              <Edit3 size={14} />
                            </button>
                            <button className="btn-status" onClick={() => handleDelete(item.id, item.brand, item.model)} style={{ color: '#ef4444' }} title="Удалить">
                              <X size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>
                  {search || groupFilter ? 'Ничего не найдено' : 'Каталог пуст — добавьте первое устройство'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Datalist for group suggestions */}
      <datalist id="groups-list">
        {allGroups.map(g => <option key={g} value={g} />)}
      </datalist>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowCreate(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 440, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px' }}>Добавить устройство</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="glass-input" placeholder="Бренд *" value={newBrand} onChange={e => setNewBrand(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} />
              <input className="glass-input" placeholder="Модель *" value={newModel} onChange={e => setNewModel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} />
              <input className="glass-input" placeholder="Группа" value={newGroup} onChange={e => setNewGroup(e.target.value)}
                list="groups-list"
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Отмена</button>
              <button className="btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => { setShowImport(false); setImportResult(''); setImportText(''); }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 600, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>Импорт из CSV</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>
              Вставьте данные в формате <code>группа;бренд;модель</code> или <code>бренд;модель</code> — по одной записи на строку.
            </p>
            <textarea
              className="glass-textarea"
              placeholder={`Мобильный телефон;Apple;iPhone 15 Pro
Ноутбук;Lenovo;ThinkPad X1
Дрон;DJI;Mini 4 Pro`}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              rows={10}
              style={{ width: '100%' }}
            />
            {importResult && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: importResult.startsWith('✅') ? '#ecfdf5' : '#fef2f2', fontSize: 13 }}>
                {importResult}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn-secondary" onClick={() => { setShowImport(false); setImportResult(''); setImportText(''); }}>Закрыть</button>
              <button className="btn-primary" onClick={handleImport} disabled={importing || !importText.trim()}>
                {importing ? 'Импорт...' : 'Импортировать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
