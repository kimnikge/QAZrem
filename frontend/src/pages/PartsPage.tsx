import { useEffect, useState } from 'react';
import { Package, Plus, Save, ArrowDownToLine } from 'lucide-react';
import { getParts, createPart, updatePart, receivePart, type Part } from '../api';
import { useAuth } from '../context/AuthContext';

export function PartsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newPart, setNewPart] = useState({ name: '', sku: '', purchase_price: 0, selling_price: 0, quantity: 0, min_quantity: 2 });
  const [creating, setCreating] = useState(false);

  // Edit / Receive modal
  const [editPart, setEditPart] = useState<Part | null>(null);
  const [editData, setEditData] = useState({ name: '', sku: '', purchase_price: 0, selling_price: 0, min_quantity: 2 });
  const [receiveQty, setReceiveQty] = useState(0);
  const [receiveDoc, setReceiveDoc] = useState('');
  const [saving, setSaving] = useState(false);
  const [receiving, setReceiving] = useState(false);

  async function load() {
    try {
      const data = await getParts();
      setParts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!newPart.name || !newPart.sku) return;
    setCreating(true);
    try {
      await createPart({
        name: newPart.name,
        sku: newPart.sku,
        purchase_price: Math.round(Number(newPart.purchase_price)),
        selling_price: Math.round(Number(newPart.selling_price)),
        quantity: Math.round(Number(newPart.quantity)),
        min_quantity: Math.round(Number(newPart.min_quantity))
      });
      setShowCreate(false);
      setNewPart({ name: '', sku: '', purchase_price: 0, selling_price: 0, quantity: 0, min_quantity: 2 });
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  }

  function openEdit(p: Part) {
    setEditPart(p);
    setEditData({
      name: p.name,
      sku: p.sku,
      purchase_price: Math.round(Number(p.purchase_price)),
      selling_price: Math.round(Number(p.selling_price)),
      min_quantity: p.min_quantity
    });
    setReceiveQty(0);
    setReceiveDoc('');
  }

  async function handleSaveEdit() {
    if (!editPart) return;
    setSaving(true);
    try {
      await updatePart(editPart.id, {
        name: editData.name,
        sku: editData.sku,
        purchase_price: editData.purchase_price,
        selling_price: editData.selling_price,
        min_quantity: editData.min_quantity
      });
      setEditPart(null);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleReceive() {
    if (!editPart || !receiveQty) return;
    setReceiving(true);
    try {
      await receivePart(editPart.id, Math.round(Number(receiveQty)), receiveDoc || undefined);
      setReceiveQty(0);
      setReceiveDoc('');
      // reload to get updated quantity
      const data = await getParts();
      setParts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setReceiving(false);
    }
  }

  const lowStockParts = parts.filter(p => p.quantity <= p.min_quantity);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <Package size={24} />
          <h2>Склад запчастей</h2>
          {lowStockParts.length > 0 && (
            <span className="badge" style={{ background: '#ef4444' }}>{lowStockParts.length} мало</span>
          )}
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Добавить запчасть
          </button>
        )}
      </div>

      {loading ? <div className="loading">Загрузка...</div> : (
        <table className="table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Артикул</th>
              <th>Цена закуп</th>
              <th>Цена продажи</th>
              <th>Остаток</th>
              <th>Мин. уровень</th>
            </tr>
          </thead>
          <tbody>
            {parts.map(p => (
              <tr
                key={p.id}
                onClick={() => isAdmin && openEdit(p)}
                style={{ cursor: isAdmin ? 'pointer' : undefined }}
              >
                <td>{p.name}</td>
                <td><code>{p.sku}</code></td>
                <td>{Math.round(Number(p.purchase_price))} ₸</td>
                <td>{Math.round(Number(p.selling_price))} ₸</td>
                <td><strong>{p.quantity}</strong></td>
                <td>{p.min_quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal: создать запчасть */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowCreate(false)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24,
            maxWidth: 480, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Новая запчасть</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#5f6368' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Название *</label>
                <input value={newPart.name} onChange={e => setNewPart({ ...newPart, name: e.target.value })} placeholder="Например: Экран iPhone 13" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Артикул *</label>
                <input value={newPart.sku} onChange={e => setNewPart({ ...newPart, sku: e.target.value })} placeholder="SCR-IP13" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Цена закупа</label>
                  <input type="number" value={newPart.purchase_price || ''} onChange={e => setNewPart({ ...newPart, purchase_price: Math.round(Number(e.target.value)) })} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Цена продажи</label>
                  <input type="number" value={newPart.selling_price || ''} onChange={e => setNewPart({ ...newPart, selling_price: Math.round(Number(e.target.value)) })} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Начальный остаток</label>
                  <input type="number" value={newPart.quantity} onChange={e => setNewPart({ ...newPart, quantity: Math.round(Number(e.target.value)) })} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Мин. уровень</label>
                  <input type="number" value={newPart.min_quantity} onChange={e => setNewPart({ ...newPart, min_quantity: Math.round(Number(e.target.value)) })} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
                </div>
              </div>
              <button className="btn-primary" onClick={handleCreate} disabled={creating || !newPart.name || !newPart.sku} style={{ marginTop: 8 }}>
                {creating ? 'Сохранение...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: редактировать / оприходовать */}
      {editPart && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setEditPart(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24,
            maxWidth: 520, width: '90%', maxHeight: '90vh', overflow: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>{editPart.name}</h3>
              <button onClick={() => setEditPart(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#5f6368' }}>×</button>
            </div>

            <p style={{ fontSize: 13, color: '#5f6368', marginBottom: 16 }}>
              Артикул: <code>{editPart.sku}</code> · Текущий остаток: <strong>{editPart.quantity}</strong>
            </p>

            {/* Редактирование карточки */}
            <h4 style={{ fontSize: 14, marginBottom: 8, color: '#202124' }}>Редактировать</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Название</label>
                <input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Артикул</label>
                <input value={editData.sku} onChange={e => setEditData({ ...editData, sku: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Цена закупа</label>
                <input type="number" value={editData.purchase_price || ''} onChange={e => setEditData({ ...editData, purchase_price: Math.round(Number(e.target.value)) })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Цена продажи</label>
                <input type="number" value={editData.selling_price || ''} onChange={e => setEditData({ ...editData, selling_price: Math.round(Number(e.target.value)) })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Мин. уровень</label>
                <input type="number" value={editData.min_quantity} onChange={e => setEditData({ ...editData, min_quantity: Math.round(Number(e.target.value)) })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
            </div>
            <button className="btn-primary" onClick={handleSaveEdit} disabled={saving} style={{ marginBottom: 20 }}>
              <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}
            </button>

            {/* Оприходование */}
            <h4 style={{ fontSize: 14, marginBottom: 8, color: '#202124' }}>Оприходовать на склад</h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Количество</label>
                <input type="number" value={receiveQty || ''} onChange={e => setReceiveQty(Math.round(Number(e.target.value)))} placeholder="0" style={{ width: 100, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Документ (накладная)</label>
                <input value={receiveDoc} onChange={e => setReceiveDoc(e.target.value)} placeholder="№123" style={{ width: 160, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <button className="btn-primary" onClick={handleReceive} disabled={receiving || !receiveQty} style={{ padding: '8px 14px', fontSize: 13 }}>
                <ArrowDownToLine size={14} /> {receiving ? '...' : 'Оприходовать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
