import type { Order } from '../api';

interface Props {
  orders: Order[];
  currentUserId?: number;
  currentUserRole?: string;
}

/** Три кликабельных блока сводки — как в ROApp: Мои заказы / Просроченные / Ждут оплаты */
export function OrderSummary({ orders, currentUserId, currentUserRole }: Props) {
  const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status_slug));
  const overdueOrders = orders.filter(o => o.is_overdue);
  const myOrders = currentUserId
    ? orders.filter(o => o.master_id === currentUserId && !['completed', 'cancelled'].includes(o.status_slug))
    : [];

  // Неоплаченная сумма: cost - discount - prepaid (приблизительно, без учёта платежей)
  const unpaidTotal = orders
    .filter(o => !['completed', 'cancelled'].includes(o.status_slug))
    .reduce((sum, o) => {
      const total = Math.round(Number(o.cost)) - Math.round(Number(o.discount || 0));
      const paid = Math.round(Number(o.prepaid || 0));
      return sum + Math.max(0, total - paid);
    }, 0);

  const formatMoney = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.0', '')}M ₸`;
    return v.toLocaleString('ru-RU') + ' ₸';
  };

  const cards = [
    ...(currentUserRole === 'master' ? [{
      key: 'my', label: 'Мои заказы', value: `${myOrders.length} заказа`, color: '#1a73e8'
    }] : []),
    { key: 'overdue', label: 'Просроченные', value: `${overdueOrders.length} заказа`, color: '#ef4444' },
    { key: 'unpaid', label: 'Ждут оплаты', value: formatMoney(unpaidTotal), color: '#f59e0b' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cards.length}, 1fr)`, gap: 12, marginBottom: 12 }}>
      {cards.map(c => (
        <div key={c.key} style={{
          background: 'var(--card-bg)', borderRadius: 10, padding: '14px 18px',
          border: '1px solid var(--border)',
          cursor: 'pointer', transition: 'box-shadow 0.15s',
          position: 'relative', overflow: 'hidden',
          '--stat-color': c.color,
        } as React.CSSProperties}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
          {/* thin top stripe — signature element */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.color, borderTopLeftRadius: 10, borderTopRightRadius: 10 }} />
          <div style={{ fontSize: 22, fontWeight: 700, color: c.color, lineHeight: 1.2, fontFamily: 'var(--font-mono)' }}>{c.value}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}
