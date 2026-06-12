import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { getParts, assignPartToOrder, deleteOrderPart, type Part } from '../api';

interface Props {
  orderId: number;
  initialParts: Array<{ id: number; part_name: string; sku: string; quantity_used: number; selling_price_at_moment: string }>;
  onRefresh: () => void;
  onError: (msg: string) => void;
}

export function OrderPartsSection({ orderId, initialParts, onRefresh, onError }: Props) {
  const [allParts, setAllParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setLoading(true);
    getParts().then(setAllParts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!selectedPartId) return;
    try {
      await assignPartToOrder(orderId, Number(selectedPartId), quantity);
      setSelectedPartId(''); setQuantity(1); setShowAdd(false);
      onRefresh();
    } catch (err) { onError(err instanceof Error ? err.message : 'Ошибка списания'); }
  }

  async function handleRemove(partId: number) {
    if (!confirm('Вернуть запчасть на склад?')) return;
    try { await deleteOrderPart(orderId, partId); onRefresh(); }
    catch (err) { onError(err instanceof Error ? err.message : 'Ошибка возврата'); }
  }

  return (
    <div className="modal-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: initialParts.length > 0 ? 8 : 0 }}>
        <div className="modal-subtitle">Запчасти и услуги</div>
        <button className="modal-btn-icon" onClick={() => setShowAdd(!showAdd)} title="Добавить запчасть">
          <Plus size={16} />
        </button>
      </div>

      {showAdd && (
        <div style={{ background: 'var(--bg)', padding: 10, borderRadius: 8, marginBottom: 8, display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Запчасть</div>
            <select value={selectedPartId} onChange={e => setSelectedPartId(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--card-bg)', color: 'var(--text)', minWidth: 180 }}>
              <option value="">— Выберите —</option>
              {allParts.map(p => <option key={p.id} value={p.id} disabled={p.quantity < 1}>{p.name} ({p.sku}) — {p.selling_price} ₸ | {p.quantity} шт</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Кол-во</div>
            <input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
              style={{ width: 60, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--card-bg)', color: 'var(--text)' }} />
          </div>
          <button className="btn-primary" onClick={handleAdd} disabled={!selectedPartId} style={{ padding: '6px 12px', fontSize: 12 }}>Списать</button>
        </div>
      )}

      {initialParts.length > 0 && initialParts.map(p => (
        <div key={p.id} className="modal-field" style={{ padding: '4px 0' }}>
          <span className="modal-label" style={{ fontSize: 12 }}>{p.part_name} ×{p.quantity_used}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="modal-value" style={{ fontSize: 13 }}>{Math.round(Number(p.selling_price_at_moment))} ₸</span>
            <button onClick={() => handleRemove(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2, display: 'flex' }} title="Вернуть на склад">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      {initialParts.length === 0 && !showAdd && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0' }}>Нет запчастей</div>
      )}
    </div>
  );
}
