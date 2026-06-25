import React, { useEffect, useState } from 'react';
import { FolderTree, Plus, Edit3, Trash2, X } from 'lucide-react';
import { getCategories, getCategoryTree, createCategory, updateCategory, deleteCategory, getCategoryAttributes, createCategoryAttribute, updateCategoryAttribute, deleteCategoryAttribute, type Category, type CategoryTree, type CategoryAttribute } from '../api/warehouse';

export function WarehouseCategoriesPage() {
  const [tree, setTree] = useState<CategoryTree[]>([]);
  const [flat, setFlat] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [attrs, setAttrs] = useState<CategoryAttribute[]>([]);
  const [loading, setLoading] = useState(true);

  // Форма категории
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formParentId, setFormParentId] = useState<number | null>(null);
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Форма атрибута
  const [showAttrForm, setShowAttrForm] = useState(false);
  const [attrName, setAttrName] = useState('');
  const [attrType, setAttrType] = useState('string');
  const [attrOptions, setAttrOptions] = useState('');
  const [editAttrId, setEditAttrId] = useState<number | null>(null);

  async function load() {
    try {
      const [treeData, flatData] = await Promise.all([getCategoryTree(), getCategories()]);
      setTree(treeData);
      setFlat(flatData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadAttrs(catId: number) {
    try {
      setAttrs(await getCategoryAttributes(catId));
    } catch (e) { console.error(e); }
  }

  useEffect(() => { load(); }, []);

  const selectCategory = (id: number) => { setSelectedId(id); loadAttrs(id); };

  const openCreate = (parentId: number | null) => {
    setEditCatId(null);
    setFormName('');
    setFormParentId(parentId);
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setEditCatId(cat.id);
    setFormName(cat.name);
    setFormParentId(cat.parent_id);
    setShowForm(true);
  };

  async function saveCategory() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editCatId) {
        await updateCategory(editCatId, { name: formName, parent_id: formParentId });
      } else {
        await createCategory({ name: formName, parent_id: formParentId });
      }
      setShowForm(false);
      await load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleDeleteCategory(id: number) {
    if (!confirm('Удалить категорию? Подкатегории и атрибуты удалятся каскадно.')) return;
    try {
      await deleteCategory(id);
      if (selectedId === id) { setSelectedId(null); setAttrs([]); }
      await load();
    } catch (e: any) { alert(e?.message || 'Ошибка'); }
  }

  async function saveAttribute() {
    if (!attrName.trim() || !selectedId) return;
    setSaving(true);
    try {
      if (editAttrId) {
        await updateCategoryAttribute(editAttrId, {
          name: attrName, attr_type: attrType,
          attr_options: attrType === 'select' ? attrOptions.split(',').map(s => s.trim()).filter(Boolean) : null
        });
      } else {
        await createCategoryAttribute(selectedId, {
          name: attrName, attr_type: attrType,
          attr_options: attrType === 'select' ? attrOptions.split(',').map(s => s.trim()).filter(Boolean) : undefined
        });
      }
      setShowAttrForm(false);
      setAttrName('');
      setAttrOptions('');
      loadAttrs(selectedId);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="loading">Загрузка...</div>;

  const indentedTree = (items: CategoryTree[], depth = 0): React.ReactNode[] =>
    items.flatMap((item): React.ReactNode[] => [
      <div key={item.id} onClick={() => selectCategory(item.id)} style={{
        padding: '6px 12px', paddingLeft: 12 + depth * 20, cursor: 'pointer',
        background: selectedId === item.id ? '#e8f0fe' : 'transparent',
        borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 14
      }}>
        <span style={{ fontWeight: selectedId === item.id ? 600 : 400 }}>{item.name}</span>
        <span style={{ display: 'flex', gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); openCreate(item.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368', padding: 2 }} title="Подкатегория"><Plus size={14} /></button>
          <button onClick={e => { e.stopPropagation(); openEdit({ id: item.id, name: item.name, parent_id: item.parent_id, created_at: '' }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368', padding: 2 }} title="Ред."><Edit3 size={12} /></button>
          <button onClick={e => { e.stopPropagation(); handleDeleteCategory(item.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }} title="Удалить"><Trash2 size={12} /></button>
        </span>
      </div>,
      ...indentedTree(tree.filter(t => t.parent_id === item.id), depth + 1)
    ]);

  const rootItems = tree.filter(t => t.parent_id === null);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <FolderTree size={24} />
          <h2>Категории запчастей</h2>
        </div>
        <button className="btn-primary" onClick={() => openCreate(null)}><Plus size={16} /> Категория</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Дерево */}
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)', padding: 12 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8, color: '#5f6368' }}>Дерево</h3>
          {indentedTree(rootItems)}
          {rootItems.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>Нет категорий</p>}
        </div>

        {/* Атрибуты */}
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)', padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, color: '#5f6368', margin: 0 }}>
              {selectedId ? `Атрибуты: ${flat.find(c => c.id === selectedId)?.name || ''}` : 'Выберите категорию'}
            </h3>
            {selectedId && (
              <button className="btn-primary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { setEditAttrId(null); setAttrName(''); setAttrType('string'); setAttrOptions(''); setShowAttrForm(true); }}>
                <Plus size={12} /> Атрибут
              </button>
            )}
          </div>

          {attrs.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
              <span><strong>{a.name}</strong> <span style={{ color: '#9ca3af' }}>({a.attr_type}{a.is_required ? ', обяз.' : ''})</span></span>
              <span style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => { setEditAttrId(a.id); setAttrName(a.name); setAttrType(a.attr_type); setAttrOptions(a.attr_options?.join(', ') || ''); setShowAttrForm(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368' }}><Edit3 size={12} /></button>
                <button onClick={async () => { if (confirm('Удалить атрибут?')) { await deleteCategoryAttribute(a.id); loadAttrs(selectedId!); } }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={12} /></button>
              </span>
            </div>
          ))}
          {selectedId && attrs.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>Нет атрибутов</p>}
        </div>
      </div>

      {/* Модалка: категория */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowForm(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3>{editCatId ? 'Редактировать' : 'Новая категория'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Название" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, marginBottom: 12 }} />
            <select value={formParentId ?? ''} onChange={e => setFormParentId(e.target.value ? Number(e.target.value) : null)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, marginBottom: 12 }}>
              <option value="">Корневая (без родителя)</option>
              {flat.filter(c => c.id !== editCatId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn-primary" onClick={saveCategory} disabled={saving || !formName.trim()} style={{ width: '100%' }}>{saving ? '...' : 'Сохранить'}</button>
          </div>
        </div>
      )}

      {/* Модалка: атрибут */}
      {showAttrForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowAttrForm(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3>{editAttrId ? 'Редактировать атрибут' : 'Новый атрибут'}</h3>
              <button onClick={() => setShowAttrForm(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <input value={attrName} onChange={e => setAttrName(e.target.value)} placeholder="Название (например: Ёмкость mAh)" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, marginBottom: 12 }} />
            <select value={attrType} onChange={e => setAttrType(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, marginBottom: 12 }}>
              <option value="string">Строка</option>
              <option value="number">Число</option>
              <option value="boolean">Да/Нет</option>
              <option value="select">Выбор из списка</option>
            </select>
            {attrType === 'select' && (
              <input value={attrOptions} onChange={e => setAttrOptions(e.target.value)} placeholder="Варианты через запятую: OLED, LCD, TFT" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, marginBottom: 12 }} />
            )}
            <button className="btn-primary" onClick={saveAttribute} disabled={saving || !attrName.trim()} style={{ width: '100%' }}>{saving ? '...' : 'Сохранить'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
