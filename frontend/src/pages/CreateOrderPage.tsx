import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrder, search, type CreateOrderInput } from '../api';

export function CreateOrderPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'search' | 'form' | 'loading'>('search');
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<string>('');
  const [form, setForm] = useState<CreateOrderInput>({
    client: { name: '', phone: '' },
    device: { brand: '', model: '', imei: '' },
    issue_description: ''
  });
  const [error, setError] = useState('');

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setStep('loading');
    setError('');
    try {
      const res = await search(query.trim());
      if (res.matchType === 'no_results') {
        setSearchResult('Клиент не найден. Заполните форму для создания.');
        setForm(prev => ({ ...prev, client: { name: query, phone: '' }, device: { brand: '', model: '', imei: '' } }));
      } else {
        const c = res.clients[0];
        setSearchResult(`Найден: ${c.client.name} (${c.client.phone})`);
        setForm(prev => ({
          ...prev,
          client: { name: c.client.name, phone: c.client.phone },
          device: { brand: '', model: '', imei: '' }
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
      const res = await createOrder(form);
      navigate(`/orders/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    }
  }

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
          <form onSubmit={handleSubmit} className="order-form">
            <fieldset>
              <legend>Клиент</legend>
              <input placeholder="Имя" value={form.client.name} onChange={e => setForm(f => ({ ...f, client: { ...f.client, name: e.target.value } }))} required />
              <input placeholder="Телефон" value={form.client.phone} onChange={e => setForm(f => ({ ...f, client: { ...f.client, phone: e.target.value } }))} required />
            </fieldset>
            <fieldset>
              <legend>Устройство</legend>
              <input placeholder="Бренд (Apple, Samsung...)" value={form.device.brand} onChange={e => setForm(f => ({ ...f, device: { ...f.device, brand: e.target.value } }))} required />
              <input placeholder="Модель" value={form.device.model} onChange={e => setForm(f => ({ ...f, device: { ...f.device, model: e.target.value } }))} required />
              <input placeholder="IMEI" value={form.device.imei} onChange={e => setForm(f => ({ ...f, device: { ...f.device, imei: e.target.value } }))} required />
            </fieldset>
            <fieldset>
              <legend>Проблема</legend>
              <textarea placeholder="Опишите проблему..." value={form.issue_description} onChange={e => setForm(f => ({ ...f, issue_description: e.target.value }))} required rows={3} />
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
