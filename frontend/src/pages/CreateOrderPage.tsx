import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrder, search, getMasters, searchDeviceCatalog, searchDeviceByImei, getParts, getOrderGroups,
  type CreateOrderInput, type CatalogItem, type ImeiSearchResult, type Part, type SearchResult, type OrderGroup } from '../api';
import { Wrench, FileText, Plus, Trash2, UserPlus } from 'lucide-react';

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

export function CreateOrderPage() {
  const navigate = useNavigate();
  const [masters, setMasters] = useState<Array<{ id: number; name: string }>>([]);

  // Инлайн-поиск клиента (как в RO App)
  const [clientQuery, setClientQuery] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<SearchResult['clients']>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const clientTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [form, setForm] = useState<CreateOrderInput>({
    client: { name: '', phone: '', email: '', address: '' },
    device: { brand: '', model: '', imei: '', serial_number: '', color: '' },
    issue_description: '',
    source: 'звонок',
  });
  const [error, setError] = useState('');

  // Вкладки: основное / запчасти
  const [tab, setTab] = useState<'general' | 'parts'>('general');

  // Запчасти
  const [allParts, setAllParts] = useState<Part[]>([]);
  const [selectedParts, setSelectedParts] = useState<Array<{ part_id: number; quantity: number; name: string; sku: string; selling_price: string }>>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [groups, setGroups] = useState<OrderGroup[]>([]);

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
    getOrderGroups().then(setGroups).catch(() => {});
  }, []);

  // Загружаем запчасти при переходе на вкладку
  useEffect(() => {
    if (tab === 'parts' && allParts.length === 0) {
      setPartsLoading(true);
      getParts().then(setAllParts).catch(() => {}).finally(() => setPartsLoading(false));
    }
  }, [tab]);

  function addPart(part: Part) {
    const existing = selectedParts.find(p => p.part_id === part.id);
    if (existing) {
      setSelectedParts(prev => prev.map(p =>
        p.part_id === part.id ? { ...p, quantity: p.quantity + 1 } : p
      ));
    } else {
      setSelectedParts(prev => [...prev, {
        part_id: part.id,
        quantity: 1,
        name: part.name,
        sku: part.sku,
        selling_price: part.selling_price
      }]);
    }
  }

  function removePart(partId: number) {
    setSelectedParts(prev => prev.filter(p => p.part_id !== partId));
  }

  function updatePartQuantity(partId: number, qty: number) {
    if (qty < 1) return;
    setSelectedParts(prev => prev.map(p =>
      p.part_id === partId ? { ...p, quantity: qty } : p
    ));
  }

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
    setSelectedClientId(dev.client_id);
    setClientQuery(`${dev.client_name} · ${dev.client_phone}`);
    setShowImei(false);
  }

  function setClient(field: 'name' | 'phone' | 'email' | 'address', value: string) {
    setForm(prev => ({ ...prev, client: { ...prev.client, [field]: value } }));
  }
  function setDevice(field: 'brand' | 'model' | 'imei' | 'serial_number' | 'color', value: string) {
    setForm(prev => ({ ...prev, device: { ...prev.device, [field]: value } }));
  }

  // Инлайн-поиск клиента (по имени, телефону, IMEI)
  function handleClientSearch(value: string) {
    setClientQuery(value);
    if (clientTimer.current) clearTimeout(clientTimer.current);
    if (value.trim().length < 2) { setShowClientSuggestions(false); return; }
    clientTimer.current = setTimeout(async () => {
      try {
        const res = await search(value.trim());
        if (res.clients.length > 0) {
          setClientSuggestions(res.clients);
          setShowClientSuggestions(true);
        } else {
          setShowClientSuggestions(false);
        }
      } catch { setShowClientSuggestions(false); }
    }, 350);
  }

  function selectClient(clientItem: SearchResult['clients'][0]) {
    const c = clientItem.client;
    setForm(prev => ({
      ...prev,
      client: { name: c.name, phone: c.phone, email: (c as any).email || '', address: (c as any).address || '' }
    }));
    setSelectedClientId(c.id);
    setClientQuery(`${c.name} · ${c.phone}`);
    setShowClientSuggestions(false);
  }

  function clearClientSelection() {
    setSelectedClientId(null);
    setClientQuery('');
    setForm(prev => ({
      ...prev,
      client: { name: '', phone: '', email: '', address: '' }
    }));
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

      if (mode === 'create_open') {
        navigate(`/orders/${res.id}`);
      } else {
        // Сброс формы для нового заказа
        setForm({
          client: { name: '', phone: '', email: '', address: '' },
          device: { brand: '', model: '', imei: '', serial_number: '', color: '' },
          issue_description: '',
          source: 'звонок',
        });
        setSelectedParts([]);
        setClientQuery('');
        setSelectedClientId(null);
        if (mode === 'create') {
          navigate('/');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    }
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      <div className="page-header"><h2>Новый заказ</h2></div>

      {error && <div className="glass-error">⚠ {error}</div>}

      <form onSubmit={(e) => handleSubmit(e, 'create_open')} className="glass-form">
        {/* Вкладки */}
        <div className="glass-tabs">
          <button type="button" className={`glass-tab${tab === 'general' ? ' active' : ''}`} onClick={() => setTab('general')}>
            <FileText size={16} /> Основное
          </button>
          <button type="button" className={`glass-tab${tab === 'parts' ? ' active' : ''}`} onClick={() => setTab('parts')}>
            <Wrench size={16} /> Запчасти и услуги
            {selectedParts.length > 0 && <span className="ro-tab-count">{selectedParts.length}</span>}
          </button>
        </div>

        {tab === 'general' && (
        <>
        {/* Клиент */}
        <div className="glass-card">
          <div className="glass-card-legend">Клиент</div>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <input
              type="text"
              value={clientQuery}
              onChange={e => handleClientSearch(e.target.value)}
              onFocus={() => clientSuggestions.length > 0 && setShowClientSuggestions(true)}
              onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
              placeholder="🔍 Введите имя, телефон или IMEI для поиска..."
              autoFocus
              className="glass-search"
            />
            {selectedClientId && (
              <button
                type="button"
                onClick={clearClientSelection}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', fontSize: 20, lineHeight: 1 }}
                title="Очистить выбор клиента"
              >×</button>
            )}
            {showClientSuggestions && (
              <div className="glass-suggestions">
                {clientSuggestions.map(item => (
                  <div
                    key={item.client.id}
                    className="glass-suggestion-item"
                    onMouseDown={() => selectClient(item)}
                  >
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{item.client.name}</div>
                    <div style={{ fontSize: 12, color: '#5f6368', marginTop: 2 }}>
                      {item.client.phone}
                      {item.devices.length > 0 && (
                        <span> · {item.devices.map(d => `${d.brand} ${d.model}`).join(', ')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedClientId && (
            <div className="glass-found-badge">
              <UserPlus size={14} /> Клиент найден — данные подставлены
            </div>
          )}
          <div className="glass-grid glass-grid-2">
            <input className="glass-input" placeholder="Имя *" value={form.client.name} onChange={e => setClient('name', e.target.value)} required />
            <input className="glass-input" placeholder="Телефон *" value={form.client.phone} onChange={e => setClient('phone', e.target.value)} required />
            <input className="glass-input" placeholder="Email" type="email" value={form.client.email || ''} onChange={e => setClient('email', e.target.value)} />
            <input className="glass-input" placeholder="Адрес" value={form.client.address || ''} onChange={e => setClient('address', e.target.value)} />
          </div>
        </div>

        {/* Устройство */}
        <div className="glass-card">
          <div className="glass-card-legend">Устройство и неисправность</div>
          <div className="glass-grid glass-grid-3">
            <div style={{ position: 'relative' }}>
              <input className="glass-input" placeholder="Бренд *" value={form.device.brand} onChange={e => handleCatalogInput('brand', e.target.value)} onFocus={() => form.device.brand.length >= 2 && setShowCatalog(true)} onBlur={() => setTimeout(() => setShowCatalog(false), 200)} required />
              {showCatalog && catalogField === 'brand' && (
                <div className="glass-suggestions">
                  {[...new Set(catalogSuggestions.map(i => i.brand))].map(b => (
                    <div key={b} className="glass-suggestion-item" onMouseDown={() => selectCatalog(catalogSuggestions.find(i => i.brand === b)!)}>{b}</div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input className="glass-input" placeholder="Модель *" value={form.device.model} onChange={e => handleCatalogInput('model', e.target.value)} onFocus={() => form.device.model.length >= 2 && setShowCatalog(true)} onBlur={() => setTimeout(() => setShowCatalog(false), 200)} required />
              {showCatalog && catalogField === 'model' && (
                <div className="glass-suggestions">
                  {catalogSuggestions.filter(i => i.brand === form.device.brand || !form.device.brand).map((item, idx) => (
                    <div key={idx} className="glass-suggestion-item" onMouseDown={() => selectCatalog(item)}>{item.brand} {item.model}</div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input className="glass-input" placeholder="IMEI *" value={form.device.imei} onChange={e => handleImeiInput(e.target.value)} onFocus={() => showImei && setShowImei(true)} onBlur={() => setTimeout(() => setShowImei(false), 200)} required />
              {showImei && (
                <div className="glass-suggestions">
                  {imeiSuggestions.map(dev => (
                    <div key={dev.device_id} className="glass-suggestion-item" onMouseDown={() => selectImeiDevice(dev)}>
                      <strong>{dev.brand} {dev.model}</strong>
                      <div style={{ color: '#5f6368', fontSize: 12 }}>{dev.client_name} · {dev.client_phone} · {dev.imei}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="glass-grid glass-grid-2" style={{ marginTop: 10 }}>
            <input className="glass-input" placeholder="Серийный номер" value={form.device.serial_number || ''} onChange={e => setDevice('serial_number', e.target.value)} />
            <input className="glass-input" placeholder="Цвет" value={form.device.color || ''} onChange={e => setDevice('color', e.target.value)} />
          </div>
          <textarea
            className="glass-textarea"
            placeholder="Описание неисправности *"
            value={form.issue_description}
            onChange={e => setForm(prev => ({ ...prev, issue_description: e.target.value }))}
            required
            rows={2}
            style={{ marginTop: 10 }}
          />
        </div>

        {/* Параметры */}
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
          {groups.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <label className="glass-label">Группа</label>
              <select className="glass-select" value={form.group_id || ''} onChange={e => setForm(prev => ({ ...prev, group_id: e.target.value ? Number(e.target.value) : undefined }))}>
                <option value="">— Без группы —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
        </div>
        </>
        )}

        {tab === 'parts' && (
        <div className="glass-card">
          <div className="glass-card-legend">Запчасти и услуги</div>
          {partsLoading ? <div className="glass-empty">Загрузка...</div> : (
            <>
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
                        type="number"
                        min={1}
                        value={p.quantity}
                        onChange={e => updatePartQuantity(p.part_id, Number(e.target.value))}
                        style={{ width: 56, padding: '6px 8px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, fontSize: 13, textAlign: 'center' }}
                      />
                      <span style={{ fontWeight: 600 }}>{Number(p.selling_price) * p.quantity} ₸</span>
                      <button type="button" onClick={() => removePart(p.part_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ea4335', padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', marginTop: 10, fontWeight: 600, fontSize: 15, color: 'var(--primary)' }}>
                    Итого запчасти: {selectedParts.reduce((sum, p) => sum + Number(p.selling_price) * p.quantity, 0)} ₸
                  </div>
                </>
              )}
            </>
          )}
        </div>
        )}

        <div className="glass-actions">
          <button type="button" className="glass-btn glass-btn-ghost" onClick={() => navigate('/')}>Отмена</button>
          <button type="button" className="glass-btn glass-btn-secondary" onClick={(e) => handleSubmit(e, 'create_new')}>
            <Plus size={16} /> Сохранить и создать ещё
          </button>
          <button type="button" className="glass-btn glass-btn-secondary" onClick={(e) => handleSubmit(e, 'create')}>
            Создать
          </button>
          <button type="submit" className="glass-btn glass-btn-primary">
            Создать и открыть
          </button>
        </div>
      </form>
    </div>
  );
}
