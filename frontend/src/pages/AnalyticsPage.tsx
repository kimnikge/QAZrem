import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrders, getFinanceReport, getAllUsers, type Order, type FinanceReport } from '../api';

const palette = ['#1a4fba','#137333','#b45309','#6b21a8','#c5221f','#038a8a','#e37400','#1a73e8'];

const statusLabels: Record<string, string> = {
  new: 'Новая', diagnosis: 'Диагностика', waiting_parts: 'Ожидание',
  repair: 'Ремонт', ready: 'Готов', completed: 'Выдан', cancelled: 'Отказ'
};

export function AnalyticsPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [selectedMasters, setSelectedMasters] = useState<number[]>([]);
  const [masterNames, setMasterNames] = useState<Record<number, string>>({});

  useEffect(() => {
    const now = new Date();
    const from = `${now.getFullYear()}-01-01`;
    const to = `${now.getFullYear()}-12-31`;
    Promise.all([
      getOrders({ limit: 200 }),
      getFinanceReport(from, to),
      getAllUsers().catch(() => [])
    ]).then(([o, r, users]) => {
      setOrders(o.orders);
      setReport(r);
      const names: Record<number, string> = {};
      (users as Array<{id:number;name:string}>).forEach((u: {id:number;name:string}) => { names[u.id] = u.name; });
      setMasterNames(names);
    }).catch(console.error);
  }, []);

  // Мастера из данных + цвета
  const allMasterIds = [...new Set(orders.map(o => o.master_id).filter(Boolean) as number[])];
  const masterList = allMasterIds.map((id, i) => ({
    id,
    name: masterNames[id] || `Мастер #${id}`,
    color: palette[i % palette.length],
    bg: palette[i % palette.length] + '18'
  }));

  const effectiveMasters = selectedMasters.length > 0 ? selectedMasters : allMasterIds;
  const filteredOrders = orders.filter(o => o.master_id && effectiveMasters.includes(o.master_id));

  // Группировка по мастерам
  const byMaster: Record<number, { masterName: string; orders: Order[]; color: string; bg: string }> = {};
  filteredOrders.forEach(o => {
    if (!o.master_id) return;
    if (!byMaster[o.master_id]) {
      const m = masterList.find(x => x.id === o.master_id);
      byMaster[o.master_id] = {
        masterName: m?.name || `Мастер #${o.master_id}`,
        orders: [],
        color: m?.color || '#5f6368',
        bg: m?.bg || '#f1f3f4'
      };
    }
    byMaster[o.master_id].orders.push(o);
  });

  const totalCost = filteredOrders.reduce((s, o) => s + Number(o.cost), 0);
  const urgentCount = filteredOrders.filter(o => o.priority === 'urgent' || o.priority === 'critical').length;
  const overdueCount = filteredOrders.filter(o => o.deadline && new Date(o.deadline) < new Date() && !['completed', 'cancelled'].includes(o.status_slug)).length;
  const completedCount = filteredOrders.filter(o => o.status_slug === 'completed').length;

  function toggleMaster(id: number) {
    setSelectedMasters(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }

  function selectAll() { setSelectedMasters([]); }

  return (
    <div className="ro-dashboard">
      <div className="page-header"><h2>Аналитика</h2></div>

      {/* Общая статистика */}
      <div className="ro-stats">
        <div className="ro-stat-card" style={{ borderLeftColor: '#3b82f6' }}>
          <span className="ro-stat-value">{filteredOrders.length}</span>
          <span className="ro-stat-label">Заказов выбрано</span>
        </div>
        <div className="ro-stat-card" style={{ borderLeftColor: '#22c55e' }}>
          <span className="ro-stat-value">{completedCount}</span>
          <span className="ro-stat-label">Завершено</span>
        </div>
        <div className="ro-stat-card" style={{ borderLeftColor: '#ef4444' }}>
          <span className="ro-stat-value">{urgentCount}</span>
          <span className="ro-stat-label">Срочных</span>
        </div>
        <div className="ro-stat-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="ro-stat-value">{overdueCount}</span>
          <span className="ro-stat-label">Просрочено</span>
        </div>
        <div className="ro-stat-card" style={{ borderLeftColor: '#8b5cf6' }}>
          <span className="ro-stat-value">{totalCost.toLocaleString()} ₸</span>
          <span className="ro-stat-label">Общая сумма</span>
        </div>
        {report && (
          <div className="ro-stat-card" style={{ borderLeftColor: '#06b6d4' }}>
            <span className="ro-stat-value">{report.profit.toLocaleString()} ₸</span>
            <span className="ro-stat-label">Прибыль за год</span>
          </div>
        )}
      </div>

      {/* Фильтр по мастерам */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#5f6368', fontWeight: 500 }}>Мастера:</span>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
          borderRadius: 6, cursor: 'pointer', fontSize: 13,
          background: selectedMasters.length === 0 ? '#e8f0fe' : '#f1f3f4',
          border: `1px solid ${selectedMasters.length === 0 ? '#1a73e8' : '#e0e0e0'}`,
        }}>
          <input type="checkbox" checked={selectedMasters.length === 0} onChange={selectAll} style={{ accentColor: '#1a73e8' }} />
          Все
        </label>
        {masterList.map(m => (
          <label key={m.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
            borderRadius: 6, cursor: 'pointer', fontSize: 13,
            background: selectedMasters.includes(m.id) ? m.bg : '#f1f3f4',
            border: `1px solid ${selectedMasters.includes(m.id) ? m.color : '#e0e0e0'}`,
            color: selectedMasters.includes(m.id) ? m.color : '#5f6368',
            fontWeight: selectedMasters.includes(m.id) ? 500 : 400,
          }}>
            <input type="checkbox" checked={selectedMasters.includes(m.id)} onChange={() => toggleMaster(m.id)} style={{ accentColor: m.color }} />
            {m.name}
          </label>
        ))}
      </div>

      {/* Карточки мастеров */}
      {Object.keys(byMaster).length > 0 && (
        <>
          <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 600 }}>По мастерам</h3>
          <div className="ro-stats">
            {Object.entries(byMaster).map(([id, data]) => {
              const active = data.orders.filter(o => !['completed', 'cancelled'].includes(o.status_slug)).length;
              const cost = data.orders.reduce((s, o) => s + Number(o.cost), 0);
              return (
                <div key={id} className="ro-stat-card" style={{ borderLeftColor: data.color, background: data.bg }}>
                  <span className="ro-stat-value" style={{ color: data.color, fontSize: 18 }}>{data.masterName}</span>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <div><span style={{ fontSize: 22, fontWeight: 700 }}>{data.orders.length}</span><span style={{ fontSize: 12, color: '#5f6368', marginLeft: 4 }}>всего</span></div>
                    <div><span style={{ fontSize: 22, fontWeight: 700 }}>{active}</span><span style={{ fontSize: 12, color: '#5f6368', marginLeft: 4 }}>в работе</span></div>
                  </div>
                  <div style={{ fontSize: 13, color: '#5f6368', marginTop: 4 }}>{cost.toLocaleString()} ₸</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Таблица заказов — кликабельные строки */}
      <div className="ro-table-wrap" style={{ marginTop: 16 }}>
        <table className="ro-table">
          <thead>
            <tr>
              <th>Заказ</th>
              <th>Мастер</th>
              <th>Статус</th>
              <th>Приоритет</th>
              <th>Клиент</th>
              <th>Устройство</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(o => {
              const m = masterList.find(x => x.id === o.master_id);
              return (
                <tr
                  key={o.id}
                  className="ro-row"
                  style={{ cursor: 'pointer', borderLeft: m ? `3px solid ${m.color}` : undefined }}
                  onClick={() => navigate(`/orders/${o.id}`)}
                >
                  <td className="ro-cell-id">#{o.id}</td>
                  <td style={m ? { color: m.color, fontWeight: 500 } : {}}>{m?.name || '—'}</td>
                  <td><span className={`ro-badge s-${o.status_slug}`}>{statusLabels[o.status_slug]}</span></td>
                  <td>{o.priority !== 'normal' && <span className={`ro-priority ${o.priority}`}>{o.priority === 'urgent' ? 'Срочно' : 'Критично'}</span>}</td>
                  <td className="ro-cell-client"><strong>{o.client_name}</strong><span>{o.client_phone}</span></td>
                  <td>{o.brand} {o.model}</td>
                  <td className="ro-cell-price">{Number(o.cost).toLocaleString()} ₸</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
