import { useEffect, useState } from 'react';
import { ClipboardCheck, Plus, Wrench, CheckCircle, XCircle } from 'lucide-react';
import { getInventorySheets, createInventorySheet, getInventorySheet, updateSheetStatus, updateInventoryItem, getEquipment, createEquipment, deleteEquipment, type InventorySheet } from '../api/warehouse';

type Tab = 'sheets' | 'equipment';

export function WarehouseInventoryPage() {
  const [tab, setTab] = useState<Tab>('sheets');
  const [sheets, setSheets] = useState<InventorySheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<any>(null);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Форма оборудования
  const [showEquipForm, setShowEquipForm] = useState(false);
  const [equipName, setEquipName] = useState('');
  const [equipMasterId, setEquipMasterId] = useState('');
  const [equipQty, setEquipQty] = useState(1);

  useEffect(() => { loadData(); }, [tab]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'sheets') {
        setSheets(await getInventorySheets());
      } else {
        setEquipment(await getEquipment());
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleCreateSheet() {
    setSaving(true);
    try {
      await createInventorySheet({});
      await loadData();
    } catch (e: any) { alert(e?.message || 'Ошибка'); }
    finally { setSaving(false); }
  }

  async function openSheet(id: number) {
    try {
      setSelectedSheet(await getInventorySheet(id));
    } catch (e) { console.error(e); }
  }

  async function saveItem(itemId: number, actualQty: number | null) {
    try {
      await updateInventoryItem(itemId, { actual_quantity: actualQty });
      if (selectedSheet) openSheet(selectedSheet.id);
    } catch (e) { console.error(e); }
  }

  async function changeStatus(id: number, status: string) {
    try {
      await updateSheetStatus(id, status);
      await loadData();
      if (selectedSheet?.id === id) openSheet(id);
    } catch (e) { console.error(e); }
  }

  async function addEquipment() {
    if (!equipName.trim() || !equipMasterId) return;
    try {
      await createEquipment({ name: equipName, master_id: Number(equipMasterId), quantity: equipQty });
      setShowEquipForm(false);
      setEquipName(''); setEquipMasterId(''); setEquipQty(1);
      await loadData();
    } catch (e: any) { alert(e?.message || 'Ошибка'); }
  }

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = { draft: '#6b7280', in_progress: '#f59e0b', completed: '#10b981', cancelled: '#ef4444' };
    const labels: Record<string, string> = { draft: 'Черновик', in_progress: 'В процессе', completed: 'Завершена', cancelled: 'Отменена' };
    return <span style={{ background: colors[s] || '#6b7280', color: '#fff', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>{labels[s] || s}</span>;
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <ClipboardCheck size={24} />
          <h2>Инвентаризация</h2>
        </div>
        {tab === 'sheets' && (
          <button className="btn-primary" onClick={handleCreateSheet} disabled={saving}>
            <Plus size={16} /> Новая ведомость
          </button>
        )}
        {tab === 'equipment' && (
          <button className="btn-primary" onClick={() => setShowEquipForm(true)}>
            <Plus size={16} /> Добавить оборудование
          </button>
        )}
      </div>

      {/* Табы */}
      <div className="ro-tabs" style={{ marginBottom: 16 }}>
        <button className={`ro-tab${tab === 'sheets' ? ' active' : ''}`} onClick={() => { setTab('sheets'); setSelectedSheet(null); }}>
          <ClipboardCheck size={14} /> Ведомости
        </button>
        <button className={`ro-tab${tab === 'equipment' ? ' active' : ''}`} onClick={() => { setTab('equipment'); setSelectedSheet(null); }}>
          <Wrench size={14} /> Оборудование
        </button>
      </div>

      {/* Ведомости */}
      {tab === 'sheets' && !selectedSheet && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Статус</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Создал</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Дата</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--bg)' }}>
                  <td style={{ padding: '10px 16px' }}><strong>#{s.id}</strong></td>
                  <td style={{ padding: '10px 16px' }}>{statusBadge(s.status)}</td>
                  <td style={{ padding: '10px 16px' }}>{s.created_by_name}</td>
                  <td style={{ padding: '10px 16px' }}>{new Date(s.created_at).toLocaleDateString('ru-RU')}</td>
                  <td style={{ padding: '10px 16px', display: 'flex', gap: 6 }}>
                    <button className="btn-primary" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => openSheet(s.id)}>Открыть</button>
                    {s.status === 'draft' && <button style={{ fontSize: 12, padding: '4px 8px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }} onClick={() => changeStatus(s.id, 'in_progress')}>Начать</button>}
                    {s.status === 'in_progress' && <button style={{ fontSize: 12, padding: '4px 8px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }} onClick={() => changeStatus(s.id, 'completed')}>Завершить</button>}
                  </td>
                </tr>
              ))}
              {sheets.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Нет ведомостей</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Детали ведомости */}
      {tab === 'sheets' && selectedSheet && (
        <div>
          <button onClick={() => setSelectedSheet(null)} style={{ marginBottom: 12, background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 14 }}>← Назад к списку</button>
          <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Запчасть</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Учёт</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Факт</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Отклонение</th>
                </tr>
              </thead>
              <tbody>
                {selectedSheet.items?.map((item: any) => {
                  const disc = (item.actual_quantity ?? item.expected_quantity) - item.expected_quantity;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--bg)' }}>
                      <td style={{ padding: '10px 16px' }}>{item.part_name} <code style={{ fontSize: 11 }}>{item.sku}</code></td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>{item.expected_quantity}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <input type="number" defaultValue={item.actual_quantity ?? ''} onBlur={e => {
                          const raw = e.target.value.trim();
                          const prev = item.actual_quantity;
                          if (raw === '') {
                            // Пустой факт = «не считали» → null, а не 0 (иначе фиктивная недостача)
                            if (prev !== null && prev !== undefined) saveItem(item.id, null);
                            return;
                          }
                          const v = Math.round(Number(raw));
                          if (v !== prev) saveItem(item.id, v);
                        }} style={{ width: 60, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: disc === 0 ? '#10b981' : disc > 0 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
                        {disc > 0 ? '+' : ''}{disc}
                        {disc === 0 ? <CheckCircle size={14} style={{ marginLeft: 4 }} /> : <XCircle size={14} style={{ marginLeft: 4 }} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Оборудование */}
      {tab === 'equipment' && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)', padding: 16 }}>
          {Array.from(new Set(equipment.map(e => e.master_name))).map(master => (
            <div key={master} style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 14, marginBottom: 8 }}>{master}</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {equipment.filter(e => e.master_name === master).map(eq => (
                  <div key={eq.id} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <Wrench size={14} />
                    <span>{eq.name} ×{eq.quantity}</span>
                    <button onClick={async () => { if (confirm('Удалить?')) { await deleteEquipment(eq.id); loadData(); } }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                      <XCircle size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {equipment.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>Нет оборудования</p>}
        </div>
      )}

      {/* Модалка: добавить оборудование */}
      {showEquipForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowEquipForm(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12 }}>Добавить оборудование</h3>
            <input value={equipName} onChange={e => setEquipName(e.target.value)} placeholder="Название (например: Паяльник)" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, marginBottom: 8 }} />
            <input value={equipMasterId} onChange={e => setEquipMasterId(e.target.value)} placeholder="ID мастера" type="number" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, marginBottom: 8 }} />
            <input value={equipQty} onChange={e => setEquipQty(Math.round(Number(e.target.value)))} placeholder="Количество" type="number" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, marginBottom: 12 }} />
            <button className="btn-primary" onClick={addEquipment} style={{ width: '100%' }}>Добавить</button>
          </div>
        </div>
      )}
    </div>
  );
}
