import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { getParts, type Part } from '../api';

interface Props {
  selectedParts: Array<{ part_id: number; quantity: number; name: string; sku: string; selling_price: string }>;
  onPartsChange: (parts: Array<{ part_id: number; quantity: number; name: string; sku: string; selling_price: string }>) => void;
}

export function OrderPartsTab({ selectedParts, onPartsChange }: Props) {
  const [allParts, setAllParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getParts().then(setAllParts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function addPart(part: Part) {
    const existing = selectedParts.find(p => p.part_id === part.id);
    if (existing) {
      onPartsChange(selectedParts.map(p =>
        p.part_id === part.id ? { ...p, quantity: p.quantity + 1 } : p
      ));
    } else {
      onPartsChange([...selectedParts, {
        part_id: part.id, quantity: 1,
        name: part.name, sku: part.sku,
        selling_price: part.selling_price
      }]);
    }
  }

  function removePart(partId: number) {
    onPartsChange(selectedParts.filter(p => p.part_id !== partId));
  }

  function updateQuantity(partId: number, qty: number) {
    if (qty < 1) return;
    onPartsChange(selectedParts.map(p =>
      p.part_id === partId ? { ...p, quantity: qty } : p
    ));
  }

  const total = selectedParts.reduce((sum, p) => sum + Number(p.selling_price) * p.quantity, 0);

  if (loading) return <div className="glass-empty">Загрузка...</div>;

  return (
    <div className="glass-card">
      <div className="glass-card-legend">Запчасти и услуги</div>

      <div style={{ marginBottom: 14 }}>
        <label className="glass-label">Добавить запчасть</label>
        <select
          className="glass-select"
          value=""
          onChange={e => {
            const part = allParts.find(p => p.id === Number(e.target.value));
            if (part) addPart(part);
            e.target.value = '';
          }}
        >
          <option value="">— Выберите запчасть —</option>
          {allParts.map(p => (
            <option key={p.id} value={p.id} disabled={p.quantity < 1}>
              {p.name} ({p.sku}) — {Number(p.selling_price)} ₸ | Ост: {p.quantity}
            </option>
          ))}
        </select>
      </div>

      {selectedParts.length === 0 ? (
        <div className="glass-empty">Запчасти не выбраны</div>
      ) : (
        <>
          {selectedParts.map(p => (
            <div key={p.part_id} className="glass-part-row">
              <span style={{ flex: 1 }}>{p.name} <span style={{ color: '#9aa0a6', fontSize: 12 }}>{p.sku}</span></span>
              <span style={{ fontWeight: 500 }}>{Number(p.selling_price)} ₸</span>
              <input
                type="number" min={1} value={p.quantity}
                onChange={e => updateQuantity(p.part_id, Number(e.target.value))}
                style={{ width: 56, padding: '6px 8px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, fontSize: 13, textAlign: 'center' }}
              />
              <span style={{ fontWeight: 600 }}>{Number(p.selling_price) * p.quantity} ₸</span>
              <button type="button" onClick={() => removePart(p.part_id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ea4335', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div style={{ textAlign: 'right', marginTop: 10, fontWeight: 600, fontSize: 15, color: 'var(--primary)' }}>
            Итого запчасти: {total} ₸
          </div>
        </>
      )}
    </div>
  );
}
