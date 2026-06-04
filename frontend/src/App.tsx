import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Phone, Plus, RefreshCw, Send, Wrench } from 'lucide-react';
import { createRepairRequest, getRepairRequests, RepairRequest } from './api';

const statusLabels: Record<RepairRequest['status'], string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Готово',
  cancelled: 'Отменена'
};

const initialForm = {
  customerName: '',
  phone: '',
  address: '',
  deviceType: '',
  problemDescription: ''
};

export function App() {
  const [requests, setRequests] = useState<RepairRequest[]>([]);
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeRequests = useMemo(
    () => requests.filter((request) => request.status === 'new' || request.status === 'in_progress').length,
    [requests]
  );

  async function loadRequests() {
    setIsLoading(true);
    setError(null);

    try {
      setRequests(await getRepairRequests());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Ошибка загрузки');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const created = await createRepairRequest(form);
      setRequests((current) => [created, ...current]);
      setForm(initialForm);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Ошибка отправки');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="top-band">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Wrench size={24} />
          </div>
          <div>
            <p className="eyebrow">Сервисный центр</p>
            <h1>QAZRem</h1>
          </div>
        </div>

        <div className="stats-grid" aria-label="Сводка заявок">
          <div className="stat">
            <span>{requests.length}</span>
            <p>всего заявок</p>
          </div>
          <div className="stat">
            <span>{activeRequests}</span>
            <p>активных</p>
          </div>
        </div>
      </section>

      <section className="workspace">
        <form className="request-form" onSubmit={handleSubmit}>
          <div className="section-title">
            <Plus size={20} />
            <h2>Новая заявка</h2>
          </div>

          <label>
            Клиент
            <input
              value={form.customerName}
              onChange={(event) => setForm({ ...form, customerName: event.target.value })}
              placeholder="Имя клиента"
              required
              minLength={2}
            />
          </label>

          <label>
            Телефон
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="+7 777 000 00 00"
              required
              minLength={5}
            />
          </label>

          <label>
            Адрес
            <input
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              placeholder="Город, улица, дом"
              required
              minLength={3}
            />
          </label>

          <label>
            Тип техники
            <input
              value={form.deviceType}
              onChange={(event) => setForm({ ...form, deviceType: event.target.value })}
              placeholder="Холодильник, стиральная машина"
              required
              minLength={2}
            />
          </label>

          <label>
            Описание проблемы
            <textarea
              value={form.problemDescription}
              onChange={(event) => setForm({ ...form, problemDescription: event.target.value })}
              placeholder="Что случилось"
              required
              minLength={5}
              rows={5}
            />
          </label>

          <button type="submit" disabled={isSubmitting}>
            <Send size={18} />
            {isSubmitting ? 'Отправка' : 'Отправить заявку'}
          </button>
        </form>

        <section className="requests-panel">
          <div className="panel-header">
            <div className="section-title">
              <ClipboardList size={20} />
              <h2>Заявки</h2>
            </div>
            <button className="icon-button" type="button" onClick={loadRequests} disabled={isLoading} aria-label="Обновить">
              <RefreshCw size={18} />
            </button>
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div className="request-list">
            {requests.map((request) => (
              <article className="request-card" key={request.id}>
                <div className="request-card-header">
                  <strong>{request.customerName}</strong>
                  <span className={`status status-${request.status}`}>{statusLabels[request.status]}</span>
                </div>
                <p className="request-device">{request.deviceType}</p>
                <p>{request.problemDescription}</p>
                <div className="request-meta">
                  <span>
                    <Phone size={14} />
                    {request.phone}
                  </span>
                  <time dateTime={request.createdAt}>{new Date(request.createdAt).toLocaleString('ru-RU')}</time>
                </div>
              </article>
            ))}

            {!isLoading && requests.length === 0 ? (
              <div className="empty-state">Заявок пока нет</div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
