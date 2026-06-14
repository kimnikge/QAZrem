import type { CreateOrderInput, Location } from '../api';
import { PRIORITIES, SOURCES } from '../constants';

interface Props {
  form: CreateOrderInput;
  setForm: (updater: (prev: CreateOrderInput) => CreateOrderInput) => void;
  masters: Array<{ id: number; name: string }>;
  locations: Location[];
}

export function OrderParamsCard({ form, setForm, masters, locations }: Props) {
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="glass-card">
      <div className="glass-card-legend">Параметры заказа</div>
      <div className="glass-grid glass-grid-3">
        <div>
          <label className="glass-label">Мастер</label>
          <select className="glass-select" value={form.master_id || ''} onChange={e => setForm(prev => ({ ...prev, master_id: e.target.value ? Number(e.target.value) : undefined }))}>
            <option value="">— Не назначен —</option>
            {masters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="glass-label">Приоритет</label>
          <select className="glass-select" value={form.priority || 'normal'} onChange={e => setForm(prev => ({ ...prev, priority: e.target.value as CreateOrderInput['priority'] }))}>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="glass-label">Откуда пришёл *</label>
          <select className="glass-select" value={form.source || ''} onChange={e => setForm(prev => ({ ...prev, source: e.target.value }))} required>
            <option value="" disabled>— Выберите —</option>
            {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      {locations.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <label className="glass-label">Локация *</label>
          <select className="glass-select" value={form.location_id || ''} onChange={e => setForm(prev => ({ ...prev, location_id: e.target.value ? Number(e.target.value) : undefined }))} required>
            <option value="" disabled>— Выберите локацию —</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.address ? ` (${l.address})` : ''}</option>)}
          </select>
        </div>
      )}
      <div className="glass-grid glass-grid-3" style={{ marginTop: 10 }}>
        <div>
          <label className="glass-label">Предв. стоимость</label>
          <input className="glass-input" type="number" placeholder="0" value={form.estimated_cost ?? ''} onChange={e => setForm(prev => ({ ...prev, estimated_cost: e.target.value ? Number(e.target.value) : undefined }))} />
        </div>
        <div>
          <label className="glass-label">Скидка</label>
          <input className="glass-input" type="number" placeholder="0" value={form.discount ?? ''} onChange={e => setForm(prev => ({ ...prev, discount: e.target.value ? Number(e.target.value) : undefined }))} />
        </div>
        <div>
          <label className="glass-label">Срок (дедлайн)</label>
          <input className="glass-input" type="date" value={form.deadline || ''} onChange={e => setForm(prev => ({ ...prev, deadline: e.target.value }))} min={today} />
        </div>
      </div>
    </div>
  );
}
