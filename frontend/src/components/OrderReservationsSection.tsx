import { useEffect, useState } from 'react';
import { Lock, XCircle } from 'lucide-react';
import { getReservations, reservePart, cancelReservation, type Reservation } from '../api/orders';
import { getParts, type Part } from '../api/parts';

const STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  used: 'Использован',
  cancelled: 'Снят',
  expired: 'Истёк',
};

/**
 * Резервы запчастей под заказ (ТЗ Блок 6.1: active → used при списании).
 * Резерв уменьшает доступный остаток, но не списывает со склада.
 */
export function OrderReservationsSection({ orderId }: { orderId: number }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [partId, setPartId] = useState<number>(0);
  const [qty, setQty] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [r, p] = await Promise.all([getReservations(orderId), getParts()]);
      setReservations(r);
      setParts(p);
    } catch {
      setReservations([]);
      setParts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [orderId]);

  async function handleReserve() {
    if (!partId || qty <= 0) return;
    setBusy(true);
    setError('');
    try {
      await reservePart(orderId, { part_id: partId, quantity: qty });
      setPartId(0);
      setQty(1);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось зарезервировать');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(reservationId: number) {
    setBusy(true);
    setError('');
    try {
      await cancelReservation(orderId, reservationId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось снять резерв');
    } finally {
      setBusy(false);
    }
  }

  const activeReservations = reservations.filter(r => r.status === 'active');

  return (
    <div>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Lock size={18} /> Резервы запчастей
        {activeReservations.length > 0 && (
          <span className="badge" style={{ background: '#2563eb' }}>{activeReservations.length}</span>
        )}
      </h3>

      {loading ? (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>Загрузка...</p>
      ) : (
        <>
          {/* Форма резервирования */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 2 }}>Запчасть</label>
              <select
                value={partId || ''}
                onChange={e => setPartId(Number(e.target.value) || 0)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: 'var(--card-bg)' }}
              >
                <option value="">— Выберите запчасть —</option>
                {parts.map(p => (
                  <option key={p.id} value={p.id} disabled={p.quantity <= 0}>
                    {p.name} ({p.sku}) — {p.quantity} шт
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 2 }}>Кол-во</label>
              <input
                type="number" min={1}
                value={qty || ''}
                onChange={e => setQty(Math.max(1, Math.round(Number(e.target.value))))}
                style={{ width: 80, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <button
              className="btn-primary"
              onClick={handleReserve}
              disabled={busy || !partId || qty <= 0}
              style={{ padding: '8px 14px', fontSize: 13 }}
            >
              {busy ? '...' : 'Зарезервировать'}
            </button>
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 8px' }}>{error}</p>}

          {/* Список резервов */}
          {reservations.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>Нет резервов по этому заказу.</p>
          ) : (
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Запчасть</th>
                  <th>Кол-во</th>
                  <th>Партия</th>
                  <th>Кто</th>
                  <th>Действует до</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reservations.map(r => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.part_name || '—'}</strong>
                      {r.sku && <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.sku}</div>}
                    </td>
                    <td>{r.quantity}</td>
                    <td>{r.batch_number || '—'}</td>
                    <td>{r.reserved_by_name || '—'}</td>
                    <td>{r.expires_at ? new Date(r.expires_at).toLocaleString() : '—'}</td>
                    <td>
                      <span className="badge" style={{ background: r.status === 'active' ? '#2563eb' : '#6b7280' }}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td>
                      {r.status === 'active' && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          disabled={busy}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                          title="Снять резерв"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
