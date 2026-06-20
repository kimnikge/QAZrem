import { useEffect, useState } from 'react';
import { Trash2, Wrench, Package } from 'lucide-react';
import { getParts, getServices, type Part, type Service } from '../api';

type SelectedPart = { part_id: number; quantity: number; name: string; sku: string; selling_price: string };
type SelectedService = { service_id: number; quantity: number; name: string; price: string };

interface Props {
  selectedParts: SelectedPart[];
  onPartsChange: (parts: SelectedPart[]) => void;
  selectedServices: SelectedService[];
  onServicesChange: (services: SelectedService[]) => void;
}

export function OrderPartsTab({ selectedParts, onPartsChange, selectedServices, onServicesChange }: Props) {
  const [allParts, setAllParts] = useState<Part[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemType, setItemType] = useState<'part' | 'service'>('part');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getParts().then(setAllParts).catch(() => {}),
      getServices().then(setAllServices).catch(() => {}),
    ]).finally(() => setLoading(false));
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

  function addService(svc: Service) {
    const existing = selectedServices.find(s => s.service_id === svc.id);
    if (existing) {
      onServicesChange(selectedServices.map(s =>
        s.service_id === svc.id ? { ...s, quantity: s.quantity + 1 } : s
      ));
    } else {
      onServicesChange([...selectedServices, {
        service_id: svc.id, quantity: 1,
        name: svc.name, price: svc.price
      }]);
    }
  }

  function removePart(partId: number) {
    onPartsChange(selectedParts.filter(p => p.part_id !== partId));
  }

  function removeService(serviceId: number) {
    onServicesChange(selectedServices.filter(s => s.service_id !== serviceId));
  }

  function updatePartQty(partId: number, qty: number) {
    if (qty < 1) return;
    onPartsChange(selectedParts.map(p =>
      p.part_id === partId ? { ...p, quantity: qty } : p
    ));
  }

  function updateServiceQty(serviceId: number, qty: number) {
    if (qty < 1) return;
    onServicesChange(selectedServices.map(s =>
      s.service_id === serviceId ? { ...s, quantity: qty } : s
    ));
  }

  const partsTotal = selectedParts.reduce((sum, p) => sum + Number(p.selling_price) * p.quantity, 0);
  const servicesTotal = selectedServices.reduce((sum, s) => sum + Number(s.price) * s.quantity, 0);

  if (loading) return <div className="glass-empty">Загрузка...</div>;

  return (
    <div className="glass-card">
      <div className="glass-card-legend">Запчасти и услуги</div>

      {/* Переключатель */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 14, background: '#e8eaed', borderRadius: 8, padding: 3, width: 'fit-content' }}>
        <button type="button"
          onClick={() => setItemType('part')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', border: 'none', borderRadius: 6,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: itemType === 'part' ? 'var(--card-bg)' : 'transparent',
            color: itemType === 'part' ? 'var(--primary)' : 'var(--text-muted)',
            boxShadow: itemType === 'part' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <Package size={13} /> Запчасть
        </button>
        <button type="button"
          onClick={() => setItemType('service')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', border: 'none', borderRadius: 6,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: itemType === 'service' ? 'var(--card-bg)' : 'transparent',
            color: itemType === 'service' ? 'var(--primary)' : 'var(--text-muted)',
            boxShadow: itemType === 'service' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <Wrench size={13} /> Услуга
        </button>
      </div>

      {/* Выпадающий список */}
      {itemType === 'part' ? (
        <div style={{ marginBottom: 14 }}>
          <label className="glass-label">Добавить запчасть</label>
          <select className="glass-select" value=""
            onChange={e => {
              const part = allParts.find(p => p.id === Number(e.target.value));
              if (part) addPart(part);
              e.target.value = '';
            }}>
            <option value="">— Выберите запчасть —</option>
            {allParts.map(p => (
              <option key={p.id} value={p.id} disabled={p.quantity < 1}>
                {p.name} ({p.sku}) — {Number(p.selling_price)} ₸ | Ост: {p.quantity}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <label className="glass-label">Добавить услугу</label>
          <select className="glass-select" value=""
            onChange={e => {
              const svc = allServices.find(s => s.id === Number(e.target.value));
              if (svc) addService(svc);
              e.target.value = '';
            }}>
            <option value="">— Выберите услугу —</option>
            {allServices.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} — {Number(s.price)} ₸{s.master_commission_pct > 0 ? ` (мастеру ${s.master_commission_pct}%)` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Список запчастей */}
      {selectedParts.length > 0 && (
        <>
          {selectedParts.map(p => (
            <div key={`part-${p.part_id}`} className="glass-part-row">
              <Package size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{p.name} <span style={{ color: '#9aa0a6', fontSize: 12 }}>{p.sku}</span></span>
              <span style={{ fontWeight: 500 }}>{Number(p.selling_price)} ₸</span>
              <input type="number" min={1} value={p.quantity}
                onChange={e => updatePartQty(p.part_id, Number(e.target.value))}
                style={{ width: 56, padding: '6px 8px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, fontSize: 13, textAlign: 'center' }} />
              <span style={{ fontWeight: 600 }}>{Number(p.selling_price) * p.quantity} ₸</span>
              <button type="button" onClick={() => removePart(p.part_id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ea4335', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div style={{ textAlign: 'right', marginTop: 8, fontWeight: 600, fontSize: 14, color: 'var(--primary)' }}>
            Итого запчасти: {partsTotal} ₸
          </div>
        </>
      )}

      {/* Список услуг */}
      {selectedServices.length > 0 && (
        <>
          {selectedServices.map(s => (
            <div key={`svc-${s.service_id}`} className="glass-part-row" style={{ marginTop: 4 }}>
              <Wrench size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{s.name}</span>
              <span style={{ fontWeight: 500 }}>{Number(s.price)} ₸</span>
              <input type="number" min={1} value={s.quantity}
                onChange={e => updateServiceQty(s.service_id, Number(e.target.value))}
                style={{ width: 56, padding: '6px 8px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, fontSize: 13, textAlign: 'center' }} />
              <span style={{ fontWeight: 600 }}>{Number(s.price) * s.quantity} ₸</span>
              <button type="button" onClick={() => removeService(s.service_id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ea4335', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div style={{ textAlign: 'right', marginTop: 8, fontWeight: 600, fontSize: 14, color: '#f59e0b' }}>
            Итого услуги: {servicesTotal} ₸
          </div>
        </>
      )}

      {selectedParts.length === 0 && selectedServices.length === 0 && (
        <div className="glass-empty">Ничего не выбрано</div>
      )}
    </div>
  );
}
