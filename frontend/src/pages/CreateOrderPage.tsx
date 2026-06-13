import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrder, getMasters, getLocations, getOrderGroups, type CreateOrderInput, type Location, type OrderGroup } from '../api';
import { Wrench, FileText, Plus, UserPlus } from 'lucide-react';
import { OrderPartsTab } from '../components/OrderPartsTab';
import { OrderParamsCard } from '../components/OrderParamsCard';
import { useOrderAutocomplete } from '../hooks/useOrderAutocomplete';

export function CreateOrderPage() {
  const navigate = useNavigate();
  const [masters, setMasters] = useState<Array<{ id: number; name: string }>>([]);
  const [groups, setGroups] = useState<OrderGroup[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const ac = useOrderAutocomplete();

  const [form, setForm] = useState<CreateOrderInput>({
    client: { name: '', phone: '', email: '', address: '' },
    device: { brand: '', model: '', imei: '', serial_number: '', color: '' },
    issue_description: '',
    source: 'звонок',
  });
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'general' | 'parts'>('general');
  const [selectedParts, setSelectedParts] = useState<Array<{ part_id: number; quantity: number; name: string; sku: string; selling_price: string }>>([]);

  useEffect(() => {
    getMasters().then(setMasters).catch(() => {});
    getOrderGroups().then(setGroups).catch(() => {});
    getLocations().then(setLocations).catch(() => {});
  }, []);

  function setClient(f: 'name' | 'phone' | 'email' | 'address', v: string) {
    setForm(p => ({ ...p, client: { ...p.client, [f]: v } }));
  }
  function setDevice(f: 'brand' | 'model' | 'imei' | 'serial_number' | 'color', v: string) {
    setForm(p => ({ ...p, device: { ...p.device, [f]: v } }));
  }

  type SubmitMode = 'create' | 'create_open' | 'create_new';

  async function handleSubmit(e: FormEvent, mode: SubmitMode) {
    e.preventDefault();
    setError('');
    try {
      const payload: CreateOrderInput = {
        ...form,
        master_id: form.master_id ? Number(form.master_id) : undefined,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : undefined,
        discount: form.discount ? Number(form.discount) : undefined,
        deadline: form.deadline || undefined,
        priority: (form.priority as 'normal' | 'urgent' | 'critical') || undefined,
        source: form.source,
        parts: selectedParts.length > 0 ? selectedParts.map(p => ({ part_id: p.part_id, quantity: p.quantity })) : undefined,
        group_id: form.group_id || undefined,
        location_id: form.location_id || undefined,
        client: { ...form.client, email: form.client.email || undefined, address: form.client.address || undefined },
        device: { ...form.device, serial_number: form.device.serial_number || undefined, color: form.device.color || undefined },
      };
      const res = await createOrder(payload);
      if (mode === 'create_open') {
        navigate('/orders/' + res.id);
      } else {
        setForm({ client: { name: '', phone: '', email: '', address: '' }, device: { brand: '', model: '', imei: '', serial_number: '', color: '' }, issue_description: '', source: 'звонок' });
        setSelectedParts([]);
        ac.clearClient();
        if (mode === 'create') navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    }
  }

  return (
    <div>
      <div className="page-header"><h2>Новый заказ</h2></div>
      {error && <div className="glass-error">⚠ {error}</div>}
      <form onSubmit={(e) => handleSubmit(e, 'create_open')} className="glass-form">
        <div className="glass-tabs">
          <button type="button" className={'glass-tab' + (tab === 'general' ? ' active' : '')} onClick={() => setTab('general')}><FileText size={16} /> Основное</button>
          <button type="button" className={'glass-tab' + (tab === 'parts' ? ' active' : '')} onClick={() => setTab('parts')}><Wrench size={16} /> Запчасти и услуги{selectedParts.length > 0 && <span className="ro-tab-count">{selectedParts.length}</span>}</button>
        </div>
        {tab === 'general' && (<>
        <div className="glass-card">
          <div className="glass-card-legend">Клиент</div>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <input type="text" value={ac.clientQuery} onChange={e => ac.handleClientSearch(e.target.value)}
              onFocus={() => ac.clientSuggestions.length > 0 && ac.hideSuggestions} onBlur={ac.hideSuggestions}
              placeholder="🔍 Введите имя, телефон или IMEI для поиска..." autoFocus className="glass-search" />
            {ac.selectedClientId && <button type="button" onClick={() => { const c = ac.clearClient(); setForm(p => ({ ...p, client: c })); }}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', fontSize: 20, lineHeight: 1 }}>×</button>}
            {ac.showClientSuggestions && <div className="glass-suggestions">{ac.clientSuggestions.map(item => (
              <div key={item.client.id} className="glass-suggestion-item" onMouseDown={() => { const c = ac.selectClient(item); setForm(p => ({ ...p, client: c })); }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{item.client.name}</div>
                <div style={{ fontSize: 12, color: '#5f6368', marginTop: 2 }}>{item.client.phone}{item.devices.length > 0 && <span> · {item.devices.map(d => d.brand + ' ' + d.model).join(', ')}</span>}</div>
              </div>))}</div>}
          </div>
          {ac.selectedClientId && <div className="glass-found-badge"><UserPlus size={14} /> Клиент найден — данные подставлены</div>}
          <div className="glass-grid glass-grid-2">
            <input className="glass-input" placeholder="Имя *" value={form.client.name} onChange={e => setClient('name', e.target.value)} required />
            <input className="glass-input" placeholder="Телефон *" value={form.client.phone} onChange={e => setClient('phone', e.target.value)} required />
            <input className="glass-input" placeholder="Email" type="email" value={form.client.email || ''} onChange={e => setClient('email', e.target.value)} />
            <input className="glass-input" placeholder="Адрес" value={form.client.address || ''} onChange={e => setClient('address', e.target.value)} />
          </div>
        </div>
        <div className="glass-card">
          <div className="glass-card-legend">Устройство и неисправность</div>
          <div className="glass-grid glass-grid-3">
            <div style={{ position: 'relative' }}>
              <input className="glass-input" placeholder="Бренд *" value={form.device.brand}
                onChange={e => { setDevice('brand', e.target.value); ac.handleCatalogInput('brand', e.target.value); }}
                onFocus={() => { if (form.device.brand.length >= 2) ac.handleCatalogInput('brand', form.device.brand); }} onBlur={ac.hideSuggestions} required />
              {ac.showCatalog && ac.catalogField === 'brand' && <div className="glass-suggestions">
                {[...new Set(ac.catalogSuggestions.map(i => i.brand))].map(b => (
                  <div key={b} className="glass-suggestion-item" onMouseDown={() => { const it = ac.catalogSuggestions.find(i => i.brand === b)!; const d = ac.selectCatalog(it); setForm(p => ({ ...p, device: { ...p.device, ...d } })); }}>{b}</div>))}</div>}
            </div>
            <div style={{ position: 'relative' }}>
              <input className="glass-input" placeholder="Модель *" value={form.device.model}
                onChange={e => { setDevice('model', e.target.value); ac.handleCatalogInput('model', e.target.value); }}
                onFocus={() => { if (form.device.model.length >= 2) ac.handleCatalogInput('model', form.device.model); }} onBlur={ac.hideSuggestions} required />
              {ac.showCatalog && ac.catalogField === 'model' && <div className="glass-suggestions">
                {ac.catalogSuggestions.filter(i => i.brand === form.device.brand || !form.device.brand).map((item, idx) => (
                  <div key={idx} className="glass-suggestion-item" onMouseDown={() => { const d = ac.selectCatalog(item); setForm(p => ({ ...p, device: { ...p.device, ...d } })); }}>{item.brand} {item.model}</div>))}</div>}
            </div>
            <div style={{ position: 'relative' }}>
              <input className="glass-input" placeholder="IMEI *" value={form.device.imei}
                onChange={e => { setDevice('imei', e.target.value); ac.handleImeiInput(e.target.value); }}
                onFocus={() => { if (form.device.imei.length >= 4) ac.handleImeiInput(form.device.imei); }} onBlur={ac.hideSuggestions} required />
              {ac.showImei && <div className="glass-suggestions">{ac.imeiSuggestions.map(dev => (
                <div key={dev.device_id} className="glass-suggestion-item" onMouseDown={() => { const d = ac.selectImeiDevice(dev); setForm(p => ({ ...p, client: d.client, device: { ...p.device, ...d.device, serial_number: '', color: '' } })); }}>
                  <strong>{dev.brand} {dev.model}</strong>
                  <div style={{ color: '#5f6368', fontSize: 12 }}>{dev.client_name} · {dev.client_phone} · {dev.imei}</div>
                </div>))}</div>}
            </div>
          </div>
          <div className="glass-grid glass-grid-2" style={{ marginTop: 10 }}>
            <input className="glass-input" placeholder="Серийный номер" value={form.device.serial_number || ''} onChange={e => setDevice('serial_number', e.target.value)} />
            <input className="glass-input" placeholder="Цвет" value={form.device.color || ''} onChange={e => setDevice('color', e.target.value)} />
          </div>
          {groups.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <label className="glass-label">Группа</label>
              <select className="glass-select" value={form.group_id || ''} onChange={e => setForm(prev => ({ ...prev, group_id: e.target.value ? Number(e.target.value) : undefined }))}>
                <option value="">— Без группы —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
          <textarea className="glass-textarea" placeholder="Описание неисправности *" value={form.issue_description}
            onChange={e => setForm(p => ({ ...p, issue_description: e.target.value }))} required rows={2} style={{ marginTop: 10 }} />
        </div>
        <OrderParamsCard form={form} setForm={setForm} masters={masters} locations={locations} />
        </>)}
        {tab === 'parts' && <OrderPartsTab selectedParts={selectedParts} onPartsChange={setSelectedParts} />}
        <div className="glass-actions">
          <button type="button" className="glass-btn glass-btn-ghost" onClick={() => navigate('/')}>Отмена</button>
          <button type="button" className="glass-btn glass-btn-secondary" onClick={(e) => handleSubmit(e, 'create_new')}><Plus size={16} /> Сохранить и создать ещё</button>
          <button type="button" className="glass-btn glass-btn-secondary" onClick={(e) => handleSubmit(e, 'create')}>Создать</button>
          <button type="submit" className="glass-btn glass-btn-primary">Создать и открыть</button>
        </div>
      </form>
    </div>
  );
}
