import { useEffect, useState } from 'react';
import { Package, Plus, Save, ArrowDownToLine, Truck, UserPlus, Search as SearchIcon, Edit3, Trash2 } from 'lucide-react';
import { getParts, createPart, updatePart, receivePart, writeoffPart, deletePart, correctPart, transferPart, getTags, type Part, type Tag } from '../api';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, type Supplier } from '../api/suppliers';
import { getLocations, type Location } from '../api/locations';
import { getCategories, type Category } from '../api/warehouse';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { CrudModal } from '../components/CrudModal';
import { TagSelect } from '../components/TagSelect';

function CategoryCheckboxes({ categories, selected, onChange }: {
  categories: Category[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 6, padding: 8,
      maxHeight: 130, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      {categories.map(c => (
        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selected.includes(c.id)}
            onChange={() => onChange(selected.includes(c.id) ? selected.filter(x => x !== c.id) : [...selected, c.id])}
          />
          {c.name}
        </label>
      ))}
      {categories.length === 0 && <span style={{ fontSize: 12, color: '#9ca3af' }}>Нет категорий — создайте их на вкладке «Категории»</span>}
    </div>
  );
}

export function PartsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canViewPurchasePrice = usePermission('parts.view_purchase_price');
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<number>(0);
  const [filterTag, setFilterTag] = useState<number>(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newPurchase, setNewPurchase] = useState(0);
  const [newSelling, setNewSelling] = useState(0);
  const [newQty, setNewQty] = useState(0);
  const [newMinQty, setNewMinQty] = useState(2);
  const [newCategoryIds, setNewCategoryIds] = useState<number[]>([]);
  const [newModel, setNewModel] = useState('');
  const [newUnit, setNewUnit] = useState('шт');
  const [newPhoto, setNewPhoto] = useState('');
  const [newTags, setNewTags] = useState<Tag[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit / Receive modal
  const [editPart, setEditPart] = useState<Part | null>(null);
  const [editData, setEditData] = useState({ name: '', sku: '', purchase_price: 0, selling_price: 0, min_quantity: 2, category_ids: [] as number[], model_name: '', unit: 'шт', photo_url: '' });
  const [editTags, setEditTags] = useState<Tag[]>([]);
  const [receiveQty, setReceiveQty] = useState(0);
  const [receiveDoc, setReceiveDoc] = useState('');
  const [writeoffQty, setWriteoffQty] = useState(0);
  const [writeoffDoc, setWriteoffDoc] = useState('');
  const [corrQty, setCorrQty] = useState('');
  const [corrReason, setCorrReason] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiving, setReceiving] = useState(false);

  // Suppliers
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receiveSupplierId, setReceiveSupplierId] = useState<number>(0);

  // Locations (перемещение между складами)
  const [locations, setLocations] = useState<Location[]>([]);
  const [transferFromId, setTransferFromId] = useState<number>(0);
  const [transferToId, setTransferToId] = useState<number>(0);
  const [transferQty, setTransferQty] = useState(0);
  const [transferring, setTransferring] = useState(false);
  const [receiveSupplierSku, setReceiveSupplierSku] = useState('');
  const [receiveBatchNumber, setReceiveBatchNumber] = useState('');
  const [editSupplierId, setEditSupplierId] = useState<number | null>(null);
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editSupplierPhone, setEditSupplierPhone] = useState('');

  // Quick add supplier
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [addingSupplier, setAddingSupplier] = useState(false);

  async function load() {
    try {
      const data = await getParts({
        search: search || undefined,
        category_id: filterCategory || undefined,
        tag_id: filterTag || undefined,
      });
      setParts(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    getSuppliers().then(setSuppliers).catch(() => {});
    getCategories().then(setCategories).catch(() => {});
    getLocations().then(setLocations).catch(() => {});
    getTags().then(setAllTags).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [search, filterCategory, filterTag]);

  async function handleCreate() {
    if (!newName) return;
    setCreating(true);
    try {
      await createPart({
        name: newName,
        sku: newSku || undefined,
        purchase_price: Math.round(Number(newPurchase)),
        selling_price: Math.round(Number(newSelling)),
        quantity: Math.round(Number(newQty)),
        min_quantity: Math.round(Number(newMinQty)),
        category_ids: newCategoryIds,
        primary_category_id: newCategoryIds[0] || null,
        model_name: newModel || undefined,
        unit: newUnit,
        photo_url: newPhoto || undefined,
        tag_ids: newTags.map(t => t.id),
      });
      setShowCreate(false);
      resetCreateForm();
      await load();
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  }

  function resetCreateForm() {
    setNewName(''); setNewSku(''); setNewPurchase(0); setNewSelling(0);
    setNewQty(0); setNewMinQty(2); setNewCategoryIds([]); setNewModel('');
    setNewUnit('шт'); setNewPhoto(''); setNewTags([]);
  }

  function openEdit(p: Part) {
    setEditPart(p);
    setEditData({
      name: p.name, sku: p.sku,
      purchase_price: Math.round(Number(p.purchase_price)),
      selling_price: Math.round(Number(p.selling_price)),
      min_quantity: p.min_quantity,
      category_ids: (p.categories || []).map(c => c.id),
      model_name: p.model_name || '',
      unit: p.unit || 'шт',
      photo_url: p.photo_url || '',
    });
    setEditTags(p.tags || []);
    setReceiveQty(0); setReceiveDoc('');
    setReceiveSupplierId(0); setReceiveSupplierSku(''); setReceiveBatchNumber('');
  }

  async function handleSaveEdit() {
    if (!editPart) return;
    setSaving(true);
    try {
      await updatePart(editPart.id, {
        name: editData.name, sku: editData.sku,
        purchase_price: editData.purchase_price,
        selling_price: editData.selling_price,
        min_quantity: editData.min_quantity,
        category_ids: editData.category_ids,
        primary_category_id: editData.category_ids[0] || null,
        model_name: editData.model_name || undefined,
        unit: editData.unit,
        photo_url: editData.photo_url || undefined,
        tag_ids: editTags.map(t => t.id),
      });
      setEditPart(null);
      await load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleDeletePart(id: number, name: string) {
    if (!confirm(`Удалить запчасть "${name}"?`)) return;
    try { await deletePart(id); await load(); }
    catch (e: any) { alert(e?.message || 'Ошибка'); }
  }

  async function handleReceive() {
    if (!editPart || !receiveQty) return;
    setReceiving(true);
    try {
      await receivePart(
        editPart.id, Math.round(Number(receiveQty)),
        receiveDoc || undefined,
        receiveSupplierId || undefined,
        receiveSupplierSku || undefined,
        receiveBatchNumber || undefined
      );
      setReceiveQty(0);
      setReceiveDoc('');
      setReceiveSupplierId(0);
      setReceiveSupplierSku('');
      setReceiveBatchNumber('');
      const data = await getParts();
      setParts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setReceiving(false);
    }
  }

  async function handleWriteoff() {
    if (!editPart || !writeoffQty) return;
    setReceiving(true);
    try {
      await writeoffPart({ part_id: editPart.id, quantity: Math.round(Number(writeoffQty)), document: writeoffDoc || undefined });
      setWriteoffQty(0); setWriteoffDoc('');
      const data = await getParts();
      setParts(data);
    } catch (e) { console.error(e); }
    finally { setReceiving(false); }
  }

  async function handleCorrect() {
    if (!editPart || corrQty === '') return;
    setCorrecting(true);
    try {
      const actual = Math.round(Number(corrQty));
      await correctPart({ part_id: editPart.id, actual_quantity: actual, reason: corrReason || undefined });
      setCorrQty(''); setCorrReason('');
      setEditPart(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Ошибка корректировки');
    } finally {
      setCorrecting(false);
    }
  }

  async function handleTransfer() {
    if (!editPart || !transferQty || !transferFromId || !transferToId) return;
    setTransferring(true);
    try {
      await transferPart({
        part_id: editPart.id,
        quantity: Math.round(Number(transferQty)),
        from_location_id: transferFromId,
        to_location_id: transferToId,
      });
      setTransferQty(0); setTransferFromId(0); setTransferToId(0);
      setEditPart(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Ошибка перемещения');
    } finally {
      setTransferring(false);
    }
  }

  async function handleAddSupplierQuick() {
    if (!newSupplierName) return;
    setAddingSupplier(true);
    try {
      const s = await createSupplier({ name: newSupplierName, phone: newSupplierPhone || undefined });
      setSuppliers(prev => [...prev, s]);
      setReceiveSupplierId(s.id);
      setNewSupplierName('');
      setNewSupplierPhone('');
      setShowAddSupplier(false);
    } catch (e) { console.error(e); }
    finally { setAddingSupplier(false); }
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

      {/* Фильтры */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <SearchIcon size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#9ca3af' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию, артикулу, модели..."
            style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}
          />
        </div>
        <select value={filterCategory || ''} onChange={e => setFilterCategory(Number(e.target.value) || 0)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: '#fff' }}>
          <option value="">Все категории</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterTag || ''} onChange={e => setFilterTag(Number(e.target.value) || 0)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: '#fff' }}>
          <option value="">Все теги</option>
          {allTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {loading ? <div className="loading">Загрузка...</div> : (
        <table className="table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Артикул</th>
              <th>Категория</th>
              <th>Теги</th>
              {canViewPurchasePrice && <th>Цена закуп</th>}
              <th>Цена продажи</th>
              <th>Остаток</th>
              <th>Мин.</th>
            </tr>
          </thead>
          <tbody>
            {parts.map(p => (
              <tr key={p.id} onClick={() => isAdmin && openEdit(p)} style={{ cursor: isAdmin ? 'pointer' : undefined }}>
                <td>{p.name}</td>
                <td><code>{p.sku}</code></td>
                <td style={{ fontSize: 13, color: '#5f6368' }}>
                  {(p.categories && p.categories.length > 0)
                    ? p.categories.map(c => c.name).join(', ')
                    : (p.category_name || '—')}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {(p.tags || []).map(tag => (
                      <span key={tag.id} style={{ background: tag.color || '#6b7280', color: '#fff', borderRadius: 8, padding: '1px 6px', fontSize: 10, fontWeight: 500 }}>{tag.name}</span>
                    ))}
                  </div>
                </td>
                {canViewPurchasePrice && <td>{Math.round(Number(p.purchase_price))} ₸</td>}
                <td>{Math.round(Number(p.selling_price))} ₸</td>
                <td><strong>{p.quantity}</strong></td>
                <td>{p.min_quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Поставщики */}
      {isAdmin && suppliers.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="page-title" style={{ marginBottom: 12 }}>
            <Truck size={20} />
            <h3 style={{ margin: 0, fontSize: 16 }}>Поставщики</h3>
            <span className="badge" style={{ background: '#6b7280' }}>{suppliers.length}</span>
          </div>
          <table className="table" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Название</th>
                <th>Контакт</th>
                <th>Телефон</th>
                <th>Поставок</th>
                {isAdmin && <th style={{ width: 80 }}></th>}
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.contact_person || '—'}</td>
                  <td>{s.phone || '—'}</td>
                  <td>{s.deliveries_count ?? 0}</td>
                  {isAdmin && (
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setEditSupplierId(s.id); setEditSupplierName(s.name); setEditSupplierPhone(s.phone || ''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368' }} title="Ред."><Edit3 size={12} /></button>
                      <button onClick={async () => { if (confirm(`Удалить поставщика "${s.name}"?`)) { await deleteSupplier(s.id); getSuppliers().then(setSuppliers); } }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Удалить"><Trash2 size={12} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Инлайн-редактирование поставщика */}
          {editSupplierId && (
            <div style={{ marginTop: 8, padding: 8, background: 'var(--bg)', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'end' }}>
              <input value={editSupplierName} onChange={e => setEditSupplierName(e.target.value)} placeholder="Название" style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, width: 160 }} />
              <input value={editSupplierPhone} onChange={e => setEditSupplierPhone(e.target.value)} placeholder="Телефон" style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, width: 120 }} />
              <button onClick={async () => { await updateSupplier(editSupplierId, { name: editSupplierName, phone: editSupplierPhone || undefined }); setEditSupplierId(null); getSuppliers().then(setSuppliers); }}
                style={{ padding: '6px 12px', fontSize: 12, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Сохранить</button>
              <button onClick={() => setEditSupplierId(null)} style={{ padding: '6px 12px', fontSize: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>Отмена</button>
            </div>
          )}
        </div>
      )}

      {/* Modal: создать запчасть */}
      {showCreate && (
        <CrudModal
          title="Новая запчасть"
          saveLabel="Создать"
          loading={creating}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
          fields={[
            { label: 'Название', name: 'name', value: newName, onChange: v => setNewName(String(v)), required: true, placeholder: 'Экран iPhone 13' },
            { label: 'Артикул', name: 'sku', value: newSku, onChange: v => setNewSku(String(v)), hint: 'авто' },
            { label: 'Модель', name: 'model_name', value: newModel, onChange: v => setNewModel(String(v)), placeholder: 'iPhone 11 ORG' },
            { label: 'Цена закупа', name: 'purchase_price', type: 'number', value: newPurchase || '', onChange: v => setNewPurchase(Number(v)) },
            { label: 'Цена продажи', name: 'selling_price', type: 'number', value: newSelling || '', onChange: v => setNewSelling(Number(v)) },
            { label: 'Начальный остаток', name: 'quantity', type: 'number', value: newQty || '', onChange: v => setNewQty(Number(v)) },
            { label: 'Мин. уровень', name: 'min_quantity', type: 'number', value: newMinQty || '', onChange: v => setNewMinQty(Number(v)) },
            { label: 'Ед. изм.', name: 'unit', type: 'select', value: newUnit, onChange: v => setNewUnit(String(v)), options: [{ label: 'шт', value: 'шт' }, { label: 'комплект', value: 'комплект' }, { label: 'метр', value: 'метр' }] },
            { label: 'Фото (URL)', name: 'photo_url', value: newPhoto, onChange: v => setNewPhoto(String(v)) },
          ]}
        >
          <div>
            <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Категории — можно несколько (первая = основная)</label>
            <CategoryCheckboxes categories={categories} selected={newCategoryIds} onChange={setNewCategoryIds} />
          </div>
          <TagSelect selected={newTags} onChange={setNewTags} />
        </CrudModal>
      )}

      {/* Modal: редактировать / оприходовать */}
      {editPart && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setEditPart(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24,
            maxWidth: 560, width: '90%', maxHeight: '90vh', overflow: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>{editPart.name}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleDeletePart(editPart.id, editPart.name)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }} title="Удалить запчасть">
                  <Trash2 size={16} />
                </button>
                <button onClick={() => setEditPart(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#5f6368' }}>×</button>
              </div>
            </div>

            <p style={{ fontSize: 13, color: '#5f6368', marginBottom: 16 }}>
              Артикул: <code>{editPart.sku}</code> · Остаток: <strong>{editPart.quantity}</strong>
            </p>

            {/* Редактирование */}
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Редактировать</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
              <div><label style={{ fontSize: 11, color: '#5f6368' }}>Название</label><input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} /></div>
              <div><label style={{ fontSize: 11, color: '#5f6368' }}>Артикул</label><input value={editData.sku} onChange={e => setEditData({ ...editData, sku: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} /></div>
              <div><label style={{ fontSize: 11, color: '#5f6368' }}>Категории — несколько (первая = основная)</label>
                <CategoryCheckboxes categories={categories} selected={editData.category_ids} onChange={ids => setEditData({ ...editData, category_ids: ids })} />
              </div>
              <div><label style={{ fontSize: 11, color: '#5f6368' }}>Модель</label><input value={editData.model_name} onChange={e => setEditData({ ...editData, model_name: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} /></div>
              <div><label style={{ fontSize: 11, color: '#5f6368' }}>Цена закупа</label><input type="number" value={editData.purchase_price || ''} onChange={e => setEditData({ ...editData, purchase_price: Math.round(Number(e.target.value)) })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} /></div>
              <div><label style={{ fontSize: 11, color: '#5f6368' }}>Цена продажи</label><input type="number" value={editData.selling_price || ''} onChange={e => setEditData({ ...editData, selling_price: Math.round(Number(e.target.value)) })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} /></div>
              <div><label style={{ fontSize: 11, color: '#5f6368' }}>Мин. уровень</label><input type="number" value={editData.min_quantity} onChange={e => setEditData({ ...editData, min_quantity: Math.round(Number(e.target.value)) })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} /></div>
              <div><label style={{ fontSize: 11, color: '#5f6368' }}>Ед. изм.</label>
                <select value={editData.unit} onChange={e => setEditData({ ...editData, unit: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: '#fff' }}>
                  <option value="шт">шт</option><option value="комплект">комплект</option><option value="метр">метр</option>
                </select>
              </div>
            </div>
            <TagSelect selected={editTags} onChange={setEditTags} />
            <button className="btn-primary" onClick={handleSaveEdit} disabled={saving} style={{ marginBottom: 20, marginTop: 12 }}>
              <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}
            </button>

            {/* Корректировка остатка (аудит) */}
            <h4 style={{ fontSize: 14, marginBottom: 8, color: '#202124' }}>Корректировка остатка (записывается в журнал движений)</h4>
            <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: '#5f6368', display: 'block', marginBottom: 2 }}>Фактический остаток *</label>
                <input type="number" value={corrQty} onChange={e => setCorrQty(e.target.value)}
                  placeholder={`сейчас: ${editPart.quantity}`}
                  style={{ width: 140, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#5f6368', display: 'block', marginBottom: 2 }}>Причина</label>
                <input value={corrReason} onChange={e => setCorrReason(e.target.value)}
                  placeholder="Инвентаризация / брак / пересчёт..."
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <button onClick={handleCorrect} disabled={correcting || corrQty === ''}
                style={{ padding: '8px 14px', fontSize: 13, background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {correcting ? '...' : 'Скорректировать'}
              </button>
            </div>

            {/* Перемещение между локациями */}
            <h4 style={{ fontSize: 14, marginBottom: 8, color: '#202124' }}>Переместить между локациями</h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: '#5f6368', display: 'block', marginBottom: 2 }}>Откуда</label>
                <select value={transferFromId || ''} onChange={e => setTransferFromId(Number(e.target.value) || 0)}
                  style={{ width: 170, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: '#fff' }}>
                  <option value="">—</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#5f6368', display: 'block', marginBottom: 2 }}>Куда</label>
                <select value={transferToId || ''} onChange={e => setTransferToId(Number(e.target.value) || 0)}
                  style={{ width: 170, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: '#fff' }}>
                  <option value="">—</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#5f6368', display: 'block', marginBottom: 2 }}>Количество</label>
                <input type="number" value={transferQty || ''} onChange={e => setTransferQty(Math.round(Number(e.target.value)))}
                  placeholder="0" style={{ width: 100, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <button onClick={handleTransfer}
                disabled={transferring || !transferQty || !transferFromId || !transferToId || transferFromId === transferToId}
                style={{ padding: '8px 14px', fontSize: 13, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {transferring ? '...' : 'Переместить'}
              </button>
            </div>

            {/* Оприходование */}
            <h4 style={{ fontSize: 14, marginBottom: 8, color: '#202124' }}>Оприходовать на склад</h4>

            {/* Поставщик */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Поставщик</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <select value={receiveSupplierId || ''} onChange={e => setReceiveSupplierId(Number(e.target.value) || 0)}
                    style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: 'var(--card-bg)' }}>
                    <option value="">— Выберите поставщика (обязательно) —</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.deliveries_count ? ` (${s.deliveries_count})` : ''}</option>
                    ))}
                  </select>
                  <button onClick={() => setShowAddSupplier(!showAddSupplier)}
                    style={{ padding: '8px 10px', background: 'none', border: '1px dashed var(--primary)', borderRadius: 6, cursor: 'pointer', color: 'var(--primary)', fontSize: 18, lineHeight: 1, whiteSpace: 'nowrap' }}
                    title="Добавить поставщика">
                    <UserPlus size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Быстрое добавление поставщика */}
            {showAddSupplier && (
              <div style={{ marginBottom: 8, padding: '8px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#5f6368', display: 'block', marginBottom: 2 }}>Название *</label>
                    <input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)}
                      placeholder="ООО Поставщик" style={{ width: 150, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#5f6368', display: 'block', marginBottom: 2 }}>Телефон</label>
                    <input value={newSupplierPhone} onChange={e => setNewSupplierPhone(e.target.value)}
                      placeholder="+7..." style={{ width: 120, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }} />
                  </div>
                  <button onClick={handleAddSupplierQuick} disabled={addingSupplier || !newSupplierName}
                    style={{ padding: '6px 12px', fontSize: 12, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    {addingSupplier ? '...' : 'Добавить'}
                  </button>
                </div>
              </div>
            )}

            {/* Артикул поставщика + Номер партии */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Код поставщика</label>
                <input value={receiveSupplierSku} onChange={e => setReceiveSupplierSku(e.target.value)}
                  placeholder="Напр: SCR-IP15-V2" style={{ width: 150, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>№ партии</label>
                <input value={receiveBatchNumber} onChange={e => setReceiveBatchNumber(e.target.value)}
                  placeholder="BATCH-001" style={{ width: 130, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
            </div>

            {/* Количество + Документ + Кнопка */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Количество</label>
                <input type="number" value={receiveQty || ''} onChange={e => setReceiveQty(Math.round(Number(e.target.value)))} placeholder="0" style={{ width: 100, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Документ (накладная)</label>
                <input value={receiveDoc} onChange={e => setReceiveDoc(e.target.value)} placeholder="№123" style={{ width: 160, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
              </div>
              <button className="btn-primary" onClick={handleReceive} disabled={receiving || !receiveQty || !receiveSupplierId} style={{ padding: '8px 14px', fontSize: 13 }}>
                <ArrowDownToLine size={14} /> {receiving ? '...' : 'Оприходовать'}
              </button>
            </div>

            {/* Списание */}
            {isAdmin && (
              <>
                <h4 style={{ fontSize: 14, marginBottom: 8, marginTop: 20, color: '#ef4444' }}>Списать со склада</h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Количество</label>
                    <input type="number" value={writeoffQty || ''} onChange={e => setWriteoffQty(Math.round(Number(e.target.value)))} placeholder="0"
                      style={{ width: 100, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Причина</label>
                    <input value={writeoffDoc} onChange={e => setWriteoffDoc(e.target.value)} placeholder="Брак, утеря..."
                      style={{ width: 160, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
                  </div>
                  <button onClick={handleWriteoff} disabled={receiving || !writeoffQty}
                    style={{ padding: '8px 14px', fontSize: 13, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    {receiving ? '...' : 'Списать'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
