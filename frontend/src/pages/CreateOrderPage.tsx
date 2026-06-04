import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrder, search, getMasters, searchDeviceCatalog, searchDeviceByImei,
  type CreateOrderInput, type CatalogItem, type ImeiSearchResult } from '../api';

const priorities = [
  { value: 'normal', label: 'Обычный' },
  { value: 'urgent', label: 'Срочный' },
  { value: 'critical', label: 'Критичный' },
];

const sources = [
  { value: '', label: '—' },
  { value: 'сайт', label: 'Сайт' },
  { value: 'звонок', label: 'Звонок' },
  { value: 'instagram', label: 'Instagram' },
  { value: '2gis', label: '2GIS' },
  { value: 'реклама', label: 'Реклама' },
  { value: 'постоянный', label: 'Постоянный клиент' },
  { value: 'другое', label: 'Другое' },
];

export function CreateOrderPage() {
  const navigate = useNavigate();
  const [masters, setMasters] = useState<Array<{ id: number; name: string }>>([]);

  const [step, setStep] = useState<'search' | 'form' | 'loading'>('search');
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<string>('');
  const [searchClientId, setSearchClientId] = useState<number | null>(null);

  const [form, setForm] = useState<CreateOrderInput>({
    client: { name: '', phone: '', email: '', address: '' },
    device: { brand: '', model: '', imei: '', serial_number: '', color: '' },
    issue_description: '',
  });
  const [error, setError] = useState('');

  // Autocomplete for device brand/model
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogItem[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogField, setCatalogField] = useState<'brand' | 'model' | null>(null);
  const catalogTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // IMEI autocomplete
  const [imeiSuggestions, setImeiSuggestions] = useState<ImeiSearchResult[]>([]);
  const [showImei, setShowImei] = useState(false);
  const imeiTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    getMasters().then(setMasters).catch(() => {});
  }, []);

  function handleCatalogInput(field: 'brand' | 'model', value: string) {
    setDevice(field, value);
    if (catalogTimer.current) clearTimeout(catalogTimer.current);
    if (value.length < 2) { setShowCatalog(false); return; }
    catalogTimer.current = setTimeout(async () => {
      try {
        const res = await searchDeviceCatalog(value);
        setCatalogSuggestions(res);
        setShowCatalog(res.length > 0);
        setCatalogField(field);
      } catch { setShowCatalog(false); }
    }, 300);
  }

  function selectCatalog(item: CatalogItem) {
    setForm(prev => ({
      ...prev,
      device: { ...prev.device, brand: item.brand, model: item.model }
    }));
    setShowCatalog(false);
  }

  function handleImeiInput(value: string) {
    setDevice('imei', value);
    if (imeiTimer.current) clearTimeout(imeiTimer.current);
    const last4 = value.replace(/\D/g, '').slice(-4);
    if (last4.length < 4) { setShowImei(false); return; }
    imeiTimer.current = setTimeout(async () => {
      try {
        const res = await searchDeviceByImei(last4);
        setImeiSuggestions(res);
        setShowImei(res.length > 0);
      } catch { setShowImei(false); }
    }, 400);
  }

  function selectImeiDevice(dev: ImeiSearchResult) {
    setForm(prev => ({
      ...prev,
      client: { name: dev.client_name, phone: dev.client_phone, email: '', address: '' },
      device: { brand: dev.brand, model: dev.model, imei: dev.imei, serial_number: '', color: '' }
    }));
    setSearchResult(`Найден: ${dev.client_name} (${dev.client_phone}) — устройство ${dev.brand} ${dev.model}`);
    setSearchClientId(dev.client_id);
    setShowImei(false);
  }

  function setClient(field: 'name' | 'phone' | 'email' | 'address', value: string) {
    setForm(prev => ({ ...prev, client: { ...prev.client, [field]: value } }));
  }
  function setDevice(field: 'brand' | 'model' | 'imei' | 'serial_number' | 'color', value: string) {
    setForm(prev => ({ ...prev, device: { ...prev.device, [field]: value } }));
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setStep('loading');
    setError('');
    try {
      const res = await search(query.trim());
      if (res.matchType === 'no_results') {
        setSearchResult('Клиент не найден. Заполните форму.');
        setSearchClientId(null);
        setForm(prev => ({
          ...prev,
          client: { name: query, phone: '', email: '', address: '' },
          device: { brand: '', model: '', imei: '', serial_number: '', color: '' },
        }));
      } else {
        const c = res.clients[0];
        setSearchResult(`Найден: ${c.client.name} (${c.client.phone})`);
        setSearchClientId(c.client.id);
        setForm(prev => ({
          ...prev,
          client: { name: c.client.name, phone: c.client.phone, email: c.client.email || '', address: (c.client as any).address || '' },
          device: { brand: '', model: '', imei: '', serial_number: '', color: '' },
        }));
      }
      setStep('form');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка поиска');
      setStep('search');
    }
  }

  async function handleSubmit(e: FormEvent) {
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
        source: form.source || undefined,
        client: {
          ...form.client,
          email: form.client.email || undefined,
          address: form.client.address || undefined,
        },
        device: {
          ...form.device,
          serial_number: form.device.serial_number || undefined,
          color: form.device.color || undefined,
        },
      };
      const res = await createOrder(payload);
      navigate(`/orders/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    }
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      <div className="page-header"><h2>Новый заказ</h2></div>

      {step === 'search' || step === 'loading' ? (
        <form onSubmit={handleSearch} className="search-form">
          <label>Поиск клиента по имени, телефону или IMEI</label>
          <div className="search-row">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Телефон, имя или IMEI..."
              autoFocus
              required
            />
            <button type="submit" className="btn-primary" disabled={step === 'loading'}>
              {step === 'loading' ? 'Поиск...' : 'Найти'}
            </button>
          </div>
        </form>
      ) : null}

      {error && <div className="error-message">{error}</div>}

      {step === 'form' && (
        <>
          {searchResult && <div className="search-result">{searchResult}</div>}
          {searchClientId && (
            <div style={{ fontSize: 13, color: '#5f6368', marginBottom: 12 }}>
              ID клиента: <code>{searchClientId}</code>
            </div>
          )}

          <form onSubmit={handleSubmit} className="order-form">
            {/* Клиент */}
            <fieldset>
              <legend>Клиент</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input placeholder="Имя *" value={form.client.name} onChange={e => setClient('name', e.target.value)} required />
                <input placeholder="Телефон *" value={form.client.phone} onChange={e => setClient('phone', e.target.value)} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input placeholder="Email" type="email" value={form.client.email || ''} onChange={e => setClient('email', e.target.value)} />
                <input placeholder="Адрес" value={form.client.address || ''} onChange={e => setClient('address', e.target.value)} />
              </div>
            </fieldset>

            {/* Устройство */}
            <fieldset>
              <legend>Устройство</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <input placeholder="Бренд *" value={form.device.brand} onChange={e => handleCatalogInput('brand', e.target.value)} onFocus={() => form.device.brand.length >= 2 && setShowCatalog(true)} onBlur={() => setTimeout(() => setShowCatalog(false), 200)} required />
                  {showCatalog && catalogField === 'brand' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 6, zIndex: 10, maxHeight: 180, overflow: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      {[...new Set(catalogSuggestions.map(i => i.brand))].map(b => (
                        <div key={b} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14 }} onMouseDown={() => selectCatalog(catalogSuggestions.find(i => i.brand === b)!)} onMouseOver={e => (e.currentTarget.style.background = '#f5f5f5')} onMouseOut={e => (e.currentTarget.style.background = '')}>{b}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input placeholder="Модель *" value={form.device.model} onChange={e => handleCatalogInput('model', e.target.value)} onFocus={() => form.device.model.length >= 2 && setShowCatalog(true)} onBlur={() => setTimeout(() => setShowCatalog(false), 200)} required />
                  {showCatalog && catalogField === 'model' && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 6, zIndex: 10, maxHeight: 180, overflow: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      {catalogSuggestions
                        .filter(i => i.brand === form.device.brand || !form.device.brand)
                        .map((item, idx) => (
                          <div key={idx} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14 }} onMouseDown={() => selectCatalog(item)} onMouseOver={e => (e.currentTarget.style.background = '#f5f5f5')} onMouseOut={e => (e.currentTarget.style.background = '')}>
                            {item.brand} {item.model}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input placeholder="IMEI *" value={form.device.imei} onChange={e => handleImeiInput(e.target.value)} onFocus={() => showImei && setShowImei(true)} onBlur={() => setTimeout(() => setShowImei(false), 200)} required />
                  {showImei && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 6, zIndex: 10, maxHeight: 200, overflow: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      {imeiSuggestions.map(dev => (
                        <div key={dev.device_id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }} onMouseDown={() => selectImeiDevice(dev)} onMouseOver={e => (e.currentTarget.style.background = '#e8f0fe')} onMouseOut={e => (e.currentTarget.style.background = '')}>
                          <strong>{dev.brand} {dev.model}</strong>
                          <div style={{ color: '#5f6368' }}>{dev.client_name} · {dev.client_phone} · {dev.imei}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input placeholder="Серийный номер" value={form.device.serial_number || ''} onChange={e => setDevice('serial_number', e.target.value)} />
                <input placeholder="Цвет" value={form.device.color || ''} onChange={e => setDevice('color', e.target.value)} />
              </div>
            </fieldset>

            {/* Заказ */}
            <fieldset>
              <legend>Заказ</legend>
              <textarea
                placeholder="Описание проблемы *"
                value={form.issue_description}
                onChange={e => setForm(prev => ({ ...prev, issue_description: e.target.value }))}
                required rows={3}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Мастер</label>
                  <select value={form.master_id || ''} onChange={e => setForm(prev => ({ ...prev, master_id: e.target.value ? Number(e.target.value) : undefined }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}>
                    <option value="">— Не назначен —</option>
                    {masters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Приоритет</label>
                  <select value={form.priority || ''} onChange={e => setForm(prev => ({ ...prev, priority: e.target.value as CreateOrderInput['priority'] }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}>
                    {priorities.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Откуда пришёл</label>
                  <select value={form.source || ''} onChange={e => setForm(prev => ({ ...prev, source: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}>
                    {sources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Предвар. стоимость</label>
                  <input type="number" placeholder="0" value={form.estimated_cost ?? ''} onChange={e => setForm(prev => ({ ...prev, estimated_cost: e.target.value ? Number(e.target.value) : undefined }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Скидка</label>
                  <input type="number" placeholder="0" value={form.discount ?? ''} onChange={e => setForm(prev => ({ ...prev, discount: e.target.value ? Number(e.target.value) : undefined }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Срок (дедлайн)</label>
                  <input type="date" value={form.deadline || ''} onChange={e => setForm(prev => ({ ...prev, deadline: e.target.value }))} min={today} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
                </div>
              </div>
            </fieldset>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate('/')}>Отмена</button>
              <button type="submit" className="btn-primary">Создать заказ</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
