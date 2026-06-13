import type { CreateOrderInput } from '../api';

const priorities = [
  { value: 'normal', label: 'Обычный' },
  { value: 'urgent', label: 'Срочный' },
  { value: 'critical', label: 'Критичный' },
];

const sources = [
  { value: 'звонок', label: 'Звонок' },
  { value: 'сайт', label: 'Сайт' },
  { value: 'instagram', label: 'Instagram' },
  { value: '2gis', label: '2GIS' },
  { value: 'реклама', label: 'Реклама' },
  { value: 'постоянный', label: 'Постоянный клиент' },
  { value: 'другое', label: 'Другое' },
];

interface Props {
  form: CreateOrderInput;
  setForm: (updater: (prev: CreateOrderInput) => CreateOrderInput) => void;
  masters: Array<{ id: number; name: string }>;
}

export function OrderParamsCard({ form, setForm, masters }: Props) {
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
            {priorities.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="glass-label">Откуда пришёл *</label>
          <select className="glass-select" value={form.source || ''} onChange={e => setForm(prev => ({ ...prev, source: e.target.value }))} required>
            <option value="" disabled>— Выберите —</option>
            {sources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
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
