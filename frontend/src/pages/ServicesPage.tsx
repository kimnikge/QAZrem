import { useEffect, useState } from 'react';
import { Wrench, Plus, Save, X, Edit3 } from 'lucide-react';
import { getServices, createService, updateService, deleteService, type Service } from '../api';
import { useAuth } from '../context/AuthContext';

export function ServicesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState(0);
  const [newCommission, setNewCommission] = useState(50);
  const [creating, setCreating] = useState(false);

  // Edit
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editCommission, setEditCommission] = useState(50);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setServices(await getServices());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createService({ name: newName.trim(), price: Math.round(Number(newPrice)), master_commission_pct: Math.round(Number(newCommission)) });
      setShowCreate(false);
      setNewName('');
      setNewPrice(0);
      setNewCommission(50);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  }

  function startEdit(s: Service) {
    setEditId(s.id);
    setEditName(s.name);
    setEditPrice(Math.round(Number(s.price)));
    setEditCommission(s.master_commission_pct);
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function handleSaveEdit() {
    if (!editId || !editName.trim()) return;
    setSaving(true);
    try {
      await updateService(editId, { name: editName.trim(), price: Math.round(Number(editPrice)), master_commission_pct: Math.round(Number(editCommission)) });
      setEditId(null);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Удалить услугу "${name}"?`)) return;
    try {
      await deleteService(id);
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <Wrench size={24} />
          <h2>Услуги и товары</h2>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Добавить услугу
          </button>
        )}
      </div>

      {loading ? <div className="loading">Загрузка...</div> : (
        <div className="ro-table-wrap">
          <table className="ro-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Цена</th>
                <th>% мастеру</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id}>
                  <td>
                    {editId === s.id ? (
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                        autoFocus
                        style={{ padding: '4px 8px', border: '1px solid var(--primary)', borderRadius: 4, fontSize: 13, width: '100%' }}
                      />
                    ) : (
                      <strong>{s.name}</strong>
                    )}
                  </td>
                  <td>
                    {editId === s.id ? (
                      <input
                        type="number"
                        value={editPrice}
                        onChange={e => setEditPrice(Math.round(Number(e.target.value)))}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                        style={{ padding: '4px 8px', border: '1px solid var(--primary)', borderRadius: 4, fontSize: 13, width: 80 }}
                      />
                    ) : (
                      <span>{Math.round(Number(s.price))} ₸</span>
                    )}
                  </td>
                  <td>
                    {editId === s.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number" min={0} max={100}
                          value={editCommission}
                          onChange={e => setEditCommission(Math.round(Number(e.target.value)))}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          style={{ padding: '4px 8px', border: '1px solid var(--primary)', borderRadius: 4, fontSize: 13, width: 60 }}
                        />
                        <span style={{ fontSize: 12, color: '#6b7280' }}>%</span>
                      </div>
                    ) : (
                      <span style={{ fontWeight: 600, color: '#2563eb' }}>{s.master_commission_pct}%</span>
                    )}
                  </td>
                  <td>
                    {editId === s.id ? (
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
                        <button className="btn-status" onClick={() => startEdit(s)} title="Редактировать">
                          <Edit3 size={14} />
                        </button>
                        <button className="btn-status" onClick={() => handleDelete(s.id, s.name)} style={{ color: '#ef4444' }} title="Удалить">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>Нет услуг</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно: создать услугу */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowCreate(false)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24,
            maxWidth: 440, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Новая услуга</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#5f6368' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Название *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Например: Чистка, Замена экрана..."
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Цена</label>
                  <input type="number" value={newPrice || ''} onChange={e => setNewPrice(Math.round(Number(e.target.value)))}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>% мастеру</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="number" min={0} max={100} value={newCommission} onChange={e => setNewCommission(Math.round(Number(e.target.value)))}
                      onKeyDown={e => e.key === 'Enter' && handleCreate()}
                      style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
                    <span style={{ fontSize: 14, color: '#5f6368' }}>%</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'end', marginTop: 4 }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Отмена</button>
                <button className="btn-primary" onClick={handleCreate} disabled={creating}>
                  {creating ? 'Сохранение...' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
