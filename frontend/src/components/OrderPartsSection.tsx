import { useEffect, useState } from 'react';
import { Plus, Trash2, Wrench, Package } from 'lucide-react';
import { getParts, assignPartToOrder, deleteOrderPart, getServices, assignServiceToOrder, deleteOrderService, type Part, type Service } from '../api';

type OrderPart = { id: number; part_name: string; sku: string; quantity_used: number; selling_price_at_moment: string };
type OrderService = { service_id: number; service_name: string; quantity: number; price_at_moment: string; master_commission_pct_at_moment: number };

interface Props {
  orderId: number;
  initialParts: OrderPart[];
  initialServices: OrderService[];
  onRefresh: () => void;
  onError: (msg: string) => void;
}

export function OrderPartsSection({ orderId, initialParts, initialServices, onRefresh, onError }: Props) {
  const [allParts, setAllParts] = useState<Part[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [itemType, setItemType] = useState<'part' | 'service'>('part');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getParts().then(setAllParts).catch(() => {}),
      getServices().then(setAllServices).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    try {
      if (itemType === 'part') {
        if (!selectedPartId) return;
        await assignPartToOrder(orderId, Number(selectedPartId), quantity);
        setSelectedPartId('');
      } else {
        if (!selectedServiceId) return;
        await assignServiceToOrder(orderId, Number(selectedServiceId), quantity);
        setSelectedServiceId('');
      }
      setQuantity(1); setShowAdd(false);
      onRefresh();
    } catch (err) { onError(err instanceof Error ? err.message : 'Ошибка добавления'); }
  }

  async function handleRemovePart(partId: number) {
    if (!confirm('Вернуть запчасть на склад?')) return;
    try { await deleteOrderPart(orderId, partId); onRefresh(); }
    catch (err) { onError(err instanceof Error ? err.message : 'Ошибка возврата'); }
  }

  async function handleRemoveService(serviceId: number) {
    if (!confirm('Удалить услугу из заказа?')) return;
    try { await deleteOrderService(orderId, serviceId); onRefresh(); }
    catch (err) { onError(err instanceof Error ? err.message : 'Ошибка удаления'); }
  }

  const hasItems = initialParts.length > 0 || initialServices.length > 0;

  return (
    <div className="modal-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasItems ? 8 : 0 }}>
        <div className="modal-subtitle">Запчасти и услуги</div>
        <button className="modal-btn-icon" onClick={() => setShowAdd(!showAdd)} title="Добавить">
          <Plus size={16} />
        </button>
      </div>

      {showAdd && (
        <div style={{ background: 'var(--bg)', padding: 10, borderRadius: 8, marginBottom: 8 }}>
          {/* Переключатель: запчасть / услуга */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 8, background: '#e8eaed', borderRadius: 6, padding: 2, width: 'fit-content' }}>
            <button
              onClick={() => { setItemType('part'); setSelectedServiceId(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 12px', border: 'none', borderRadius: 5,
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: itemType === 'part' ? 'var(--card-bg)' : 'transparent',
                color: itemType === 'part' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: itemType === 'part' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Package size={12} /> Запчасть
            </button>
            <button
              onClick={() => { setItemType('service'); setSelectedPartId(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 12px', border: 'none', borderRadius: 5,
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: itemType === 'service' ? 'var(--card-bg)' : 'transparent',
                color: itemType === 'service' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: itemType === 'service' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Wrench size={12} /> Услуга
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
            {itemType === 'part' ? (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Запчасть</div>
                <select value={selectedPartId} onChange={e => setSelectedPartId(e.target.value)}
                  style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--card-bg)', color: 'var(--text)', minWidth: 180 }}>
                  <option value="">— Выберите —</option>
                  {allParts.map(p => <option key={p.id} value={p.id} disabled={p.quantity < 1}>{p.name} ({p.sku}) — {p.selling_price} ₸ | {p.quantity} шт</option>)}
                </select>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Услуга</div>
                <select value={selectedServiceId} onChange={e => setSelectedServiceId(e.target.value)}
                  style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--card-bg)', color: 'var(--text)', minWidth: 180 }}>
                  <option value="">— Выберите —</option>
                  {allServices.map(s => <option key={s.id} value={s.id}>{s.name} — {s.price} ₸{s.master_commission_pct > 0 ? ` (мастеру ${s.master_commission_pct}%)` : ''}</option>)}
                </select>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Кол-во</div>
              <input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                style={{ width: 60, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--card-bg)', color: 'var(--text)' }} />
            </div>
            <button className="btn-primary" onClick={handleAdd}
              disabled={itemType === 'part' ? !selectedPartId : !selectedServiceId}
              style={{ padding: '6px 12px', fontSize: 12 }}>
              {itemType === 'part' ? 'Списать' : 'Добавить'}
            </button>
          </div>
        </div>
      )}

      {/* Список запчастей */}
      {initialParts.length > 0 && initialParts.map(p => (
        <div key={`part-${p.id}`} className="modal-field" style={{ padding: '4px 0' }}>
          <span className="modal-label" style={{ fontSize: 12 }}>
            <Package size={11} style={{ marginRight: 4, verticalAlign: 'middle', color: 'var(--primary)' }} />
            {p.part_name} ×{p.quantity_used}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="modal-value" style={{ fontSize: 13 }}>{Math.round(Number(p.selling_price_at_moment))} ₸</span>
            <button onClick={() => handleRemovePart(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2, display: 'flex' }} title="Вернуть на склад">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      {/* Список услуг */}
      {initialServices.length > 0 && initialServices.map(s => (
        <div key={`svc-${s.service_id}`} className="modal-field" style={{ padding: '4px 0' }}>
          <span className="modal-label" style={{ fontSize: 12 }}>
            <Wrench size={11} style={{ marginRight: 4, verticalAlign: 'middle', color: '#f59e0b' }} />
            {s.service_name} ×{s.quantity}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="modal-value" style={{ fontSize: 13 }}>{Math.round(Number(s.price_at_moment))} ₸</span>
            <button onClick={() => handleRemoveService(s.service_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2, display: 'flex' }} title="Удалить услугу">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      {!hasItems && !showAdd && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0' }}>Нет запчастей и услуг</div>
      )}
    </div>
  );
}
