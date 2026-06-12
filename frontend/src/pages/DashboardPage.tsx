import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrders, updateOrderStatus, getOrderGroups, type Order, type OrderGroup } from '../api';
import { useAuth } from '../context/AuthContext';
import { BoardView } from '../components/BoardView';
import { OrderModal } from '../components/OrderModal';
import { LayoutList, Kanban, Download, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';

const apiUrl = import.meta.env.VITE_API_URL || '/api';

function downloadCsv(url: string, filename: string) {
  const token = sessionStorage.getItem('token');
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => res.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    })
    .catch(console.error);
}

const statusLabels: Record<string, string> = {
  new: 'Новая', diagnosis: 'Диагностика', waiting_parts: 'Ожидание запчасти',
  repair: 'Ремонт', ready: 'Готов к выдаче', completed: 'Выдан', cancelled: 'Отказ'
};

const statusColors: Record<string, string> = {
  new: 's-new', diagnosis: 's-diagnosis', waiting_parts: 's-waiting',
  repair: 's-repair', ready: 's-ready', completed: 's-completed', cancelled: 's-cancelled'
};

type ColumnKey = 'id' | 'status' | 'priority' | 'deadline' | 'client' | 'device' | 'issue' | 'master' | 'group' | 'cost';

const defaultColumns: { key: ColumnKey; label: string }[] = [
  { key: 'id', label: '№' },
  { key: 'status', label: 'Статус' },
  { key: 'priority', label: 'Приоритет' },
  { key: 'deadline', label: 'Срок' },
  { key: 'client', label: 'Клиент' },
  { key: 'device', label: 'Устройство' },
  { key: 'issue', label: 'Проблема' },
  { key: 'master', label: 'Мастер' },
  { key: 'group', label: 'Группа' },
  { key: 'cost', label: 'Сумма' },
];

function loadColumnOrder(): ColumnKey[] {
  try {
    const saved = localStorage.getItem('qazrem_columns');
    if (saved) {
      const parsed = JSON.parse(saved) as ColumnKey[];
      // Проверяем что все ключи на месте
      if (defaultColumns.every(c => parsed.includes(c.key)) && parsed.length === defaultColumns.length) {
        return parsed;
      }
    }
  } catch {}
  return defaultColumns.map(c => c.key);
}

function saveColumnOrder(order: ColumnKey[]) {
  localStorage.setItem('qazrem_columns', JSON.stringify(order));
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState('active');
  const [view, setView] = useState<'table' | 'board'>('table');
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<OrderGroup[]>([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [colOrder, setColOrder] = useState<ColumnKey[]>(loadColumnOrder);
  const [dragCol, setDragCol] = useState<ColumnKey | null>(null);
  const [compact, setCompact] = useState(false);
  const [modalOrder, setModalOrder] = useState<Order | null>(null);

  useEffect(() => {
    setLoading(true);
    const statusMap: Record<string, string | undefined> = {
      active: undefined, new: 'new', diagnosis: 'diagnosis',
      waiting_parts: 'waiting_parts', repair: 'repair',
      ready: 'ready', completed: 'completed', cancelled: 'cancelled',
      overdue: undefined, my: undefined
    };
    const params: { status?: string; limit: number; overdue?: string; my?: string; group_id?: string } = {
      status: statusMap[tab],
      limit: 100
    };
    if (tab === 'overdue') params.overdue = 'true';
    if (tab === 'my') params.my = 'true';
    if (groupFilter) params.group_id = groupFilter;
    getOrders(params)
      .then(res => setOrders(res.orders))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tab, groupFilter]);

  // Загружаем группы
  useEffect(() => {
    getOrderGroups().then(setGroups).catch(() => {});
  }, []);

  const counts = {
    new: orders.filter(o => o.status_slug === 'new').length,
    diagnosis: orders.filter(o => o.status_slug === 'diagnosis').length,
    waiting_parts: orders.filter(o => o.status_slug === 'waiting_parts').length,
    repair: orders.filter(o => o.status_slug === 'repair').length,
    ready: orders.filter(o => o.status_slug === 'ready').length,
    overdue: orders.filter(o => o.is_overdue).length,
  };

  const overdueCount = orders.filter(o => o.is_overdue).length;

  const tabs = [
    { key: 'active', label: 'Активные', count: orders.filter(o => !['completed','cancelled'].includes(o.status_slug)).length },
    { key: 'new', label: 'Новые', count: counts.new },
    { key: 'diagnosis', label: 'Диагностика', count: counts.diagnosis },
    { key: 'repair', label: 'Ремонт', count: counts.repair },
    { key: 'ready', label: 'Готовы', count: counts.ready },
    { key: 'overdue', label: 'Просрочено', count: overdueCount },
    { key: 'completed', label: 'Завершённые', count: orders.filter(o => o.status_slug === 'completed').length },
  ];

  // Вкладка «Мои» только для мастеров
  if (user?.role === 'master') {
    tabs.push({ key: 'my', label: 'Мои', count: 0 });
  }

  const statCards = [
    { label: 'Новые заявки', value: counts.new, color: '#3b82f6' },
    { label: 'В работе', value: counts.diagnosis + counts.repair + counts.waiting_parts, color: '#f59e0b' },
    { label: 'Готовы к выдаче', value: counts.ready, color: '#22c55e' },
    { label: 'Просрочено', value: overdueCount, color: '#ef4444' },
  ];

  function renderCell(key: ColumnKey, o: Order) {
    const stickyLeft = key === 'id' ? ' sticky-left' : '';
    const stickyRight = key === 'cost' ? ' sticky-right' : '';
    const sticky = stickyLeft || stickyRight;
    switch (key) {
      case 'id':
        return <td key={key} className={`ro-cell-id${sticky}`}>#{o.id}{o.is_overdue && <span style={{ color: '#ef4444', marginLeft: 4 }}>⚠</span>}</td>;
      case 'status':
        return <td key={key}>
          <span className={`ro-badge ${statusColors[o.status_slug]}`}>{statusLabels[o.status_slug]}</span>
          <div style={{ fontSize: 11, color: '#9aa0a6', marginTop: 2 }}>
            {o.created_by_name || ''} · {new Date(o.created_at).toLocaleDateString()}
          </div>
        </td>;
      case 'priority':
        return <td key={key}>{o.priority !== 'normal' && <span className={`ro-priority ${o.priority}`}>{o.priority === 'urgent' ? 'Срочно' : 'Критично'}</span>}</td>;
      case 'deadline':
        return <td key={key} className="ro-cell-date">{o.deadline ? new Date(o.deadline).toLocaleDateString() : '-'}</td>;
      case 'client':
        return <td key={key} className="ro-cell-client">
          <strong>{o.client_name}</strong>
          <span>{o.client_phone}</span>
        </td>;
      case 'device':
        return <td key={key}>
          <div>{o.brand} {o.model}</div>
          <div style={{ fontSize: 11, color: '#9aa0a6', fontFamily: 'monospace' }}>{o.imei}</div>
        </td>;
      case 'issue':
        return <td key={key} className="ro-cell-desc">{o.issue_description}</td>;
      case 'master':
        return <td key={key} style={{ fontSize: 13, color: o.master_name ? '#1a73e8' : '#9aa0a6' }}>{o.master_name || '—'}</td>;
      case 'group':
        return <td key={key} style={{ fontSize: 12, color: o.group_name ? '#1a73e8' : '#9aa0a6' }}>{o.group_name || '—'}</td>;
      case 'cost':
        return <td key={key} className={`ro-cell-price${sticky}`}>{Math.round(Number(o.cost))} ₸</td>;
      default:
        return <td key={key}></td>;
    }
  }

  return (
    <div className={`ro-dashboard${compact ? ' compact' : ''}`}>
      <div className="ro-stats">
        {statCards.map(c => (
          <div key={c.label} className="ro-stat-card" style={{ borderLeftColor: c.color }}>
            <span className="ro-stat-value">{c.value}</span>
            <span className="ro-stat-label">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="ro-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`ro-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.count > 0 && <span className="ro-tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="ro-actions">
        <button className="ro-btn-primary" onClick={() => navigate('/create-order')}>+ Заказ</button>
        {user?.role === 'admin' && (
        <button className="btn-secondary" onClick={() => {
          const params = new URLSearchParams();
          if (tab !== 'active' && tab !== 'overdue' && tab !== 'my') params.set('status', tab);
          if (tab === 'overdue') params.set('overdue', 'true');
          if (groupFilter) params.set('group_id', groupFilter);
          downloadCsv(`${apiUrl}/orders/export?${params}`, `orders_${new Date().toISOString().split('T')[0]}.csv`);
        }}>
          <Download size={14} /> Экспорт
        </button>
        )}
        {groups.length > 0 && (
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--card-bg)', minWidth: 160 }}
          >
            <option value="">Все группы</option>
            <option value="null">Без группы</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name} ({g.order_count})</option>
            ))}
          </select>
        )}
        <div className="view-toggle">
          <button
            className={`view-toggle-btn${view === 'table' ? ' active' : ''}`}
            onClick={() => setView('table')}
          >
            <LayoutList size={14} /> Таблица
          </button>
          <button
            className={`view-toggle-btn${view === 'board' ? ' active' : ''}`}
            onClick={() => setView('board')}
          >
            <Kanban size={14} /> Доска
          </button>
        </div>
        {view === 'table' && (
          <>
            <button className="btn-reset-cols" onClick={() => {
              const def = defaultColumns.map(c => c.key);
              setColOrder(def);
              saveColumnOrder(def);
            }} title="Вернуть порядок колонок по умолчанию">
              <RotateCcw size={12} /> Сбросить
            </button>
            <button className="btn-reset-cols" onClick={() => setCompact(!compact)} title={compact ? 'Обычный режим' : 'Компактный режим'}>
              {compact ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
              {compact ? ' Обычный' : ' Компактно'}
            </button>
          </>
        )}
      </div>

      {loading ? <div className="loading">Загрузка...</div> : (
        view === 'board' ? (
          <BoardView orders={orders} onOrderUpdated={() => {
            const statusMap: Record<string, string | undefined> = {
              active: undefined, new: 'new', diagnosis: 'diagnosis',
              waiting_parts: 'waiting_parts', repair: 'repair',
              ready: 'ready', completed: 'completed', cancelled: 'cancelled',
              overdue: undefined, my: undefined
            };
            const params: { status?: string; limit: number; overdue?: string; my?: string } = {
              status: statusMap[tab],
              limit: 100
            };
            if (tab === 'overdue') params.overdue = 'true';
            if (tab === 'my') params.my = 'true';
            getOrders(params).then(res => setOrders(res.orders)).catch(console.error);
          }} onCardOpen={(o) => setModalOrder(o)} />
        ) : (
        <div className="ro-table-wrap">
          <table className={`ro-table${compact ? ' compact' : ''}`}>
            <thead>
              <tr>
                {colOrder.map(key => {
                  const col = defaultColumns.find(c => c.key === key)!;
                  const stickyLeft = key === 'id' ? ' sticky-left' : '';
                  const stickyRight = key === 'cost' ? ' sticky-right' : '';
                  return (
                    <th
                      key={key}
                      className={`${stickyLeft}${stickyRight}`}
                      draggable
                      onDragStart={() => setDragCol(key)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => {
                        if (dragCol && dragCol !== key) {
                          const newOrder = [...colOrder];
                          const fromIdx = newOrder.indexOf(dragCol);
                          const toIdx = newOrder.indexOf(key);
                          newOrder.splice(fromIdx, 1);
                          newOrder.splice(toIdx, 0, dragCol);
                          setColOrder(newOrder);
                          saveColumnOrder(newOrder);
                        }
                        setDragCol(null);
                      }}
                      onDragEnd={() => setDragCol(null)}
                      style={{
                        cursor: 'grab',
                        opacity: dragCol === key ? 0.4 : 1,
                        transition: 'opacity 0.15s',
                      }}
                      title="Перетащите чтобы изменить порядок"
                    >
                      {col.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => {
                const priClass = o.priority !== 'normal' ? ` priority-${o.priority}` : '';
                return (
                <tr key={o.id} className={`ro-row${o.is_overdue ? ' overdue' : ''}${priClass}`} onClick={() => setModalOrder(o)}>
                  {colOrder.map(key => renderCell(key, o))}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )
      )}

      {!loading && orders.length === 0 && view === 'table' && <div className="empty-state"><p>Нет заказов</p></div>}

      {modalOrder && (
        <OrderModal orderId={modalOrder.id} preload={modalOrder} onClose={() => setModalOrder(null)} />
      )}
    </div>
  );
}
