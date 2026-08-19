import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrders, updateOrderStatus, getOrderGroups, getAllUsers, type Order, type OrderGroup } from '../api';
import { useAuth } from '../context/AuthContext';
import { BoardView } from '../components/BoardView';
import { OrderModal } from '../components/OrderModal';
import { DashboardTable, loadColumnOrder, type ColumnKey } from '../components/DashboardTable';
import { QuickFilters } from '../components/QuickFilters';
import { OrderSummary } from '../components/OrderSummary';
import { LayoutList, Kanban, Download, RotateCcw, Maximize2, Minimize2, Filter, X } from 'lucide-react';
import { STATUS_LABELS } from '../constants';

const apiUrl = import.meta.env.VITE_API_URL || '/api';

function downloadCsv(url: string, filename: string) {
  const token = sessionStorage.getItem('token');
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.blob()).then(blob => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  }).catch(console.error);
}

const statusMap: Record<string, string | undefined> = {
  active: undefined, new: 'new', diagnosis: 'diagnosis', waiting_parts: 'waiting_parts',
  repair: 'repair', ready: 'ready', completed: 'completed', cancelled: 'cancelled', overdue: undefined, my: undefined
};

export function DashboardPage() {
  const navigate = useNavigate(); const { user } = useAuth();
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
  const [statusDropdownId, setStatusDropdownId] = useState<number | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [brandFilter, setBrandFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [masterFilter, setMasterFilter] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [masters, setMasters] = useState<Array<{ id: number; name: string }>>([]);

  // Собрать уникальные бренды из заказов для фильтра
  const brands = [...new Set(orders.map(o => o.brand).filter(Boolean))].sort();
  const models = [...new Set(orders.map(o => o.model).filter(Boolean))].sort();
  const topBrands = (() => {
    const freq: Record<string, number> = {};
    orders.forEach(o => { if (o.brand) freq[o.brand] = (freq[o.brand] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k);
  })();

  function buildParams(): Record<string, string> {
    const p: Record<string, string> = { limit: '100' };
    if (statusMap[tab]) p.status = statusMap[tab]!;
    if (tab === 'overdue') p.overdue = 'true';
    if (tab === 'my') p.my = 'true';
    if (groupFilter) p.group_id = groupFilter;
    if (brandFilter) p.brand = brandFilter;
    if (modelFilter) p.model = modelFilter;
    if (masterFilter) p.master_id = masterFilter;
    if (createdFrom) p.created_from = createdFrom;
    if (createdTo) p.created_to = createdTo;
    return p;
  }

  useEffect(() => {
    setLoading(true);
    getOrders(buildParams()).then(res => setOrders(res.orders)).catch(console.error).finally(() => setLoading(false));
  }, [tab, groupFilter, brandFilter, modelFilter, masterFilter, createdFrom, createdTo]);

  useEffect(() => { getOrderGroups().then(setGroups).catch(() => {}); }, []);
  useEffect(() => { getAllUsers().then(u => setMasters(u.filter(x => x.role === 'master'))).catch(() => {}); }, []);

  useEffect(() => {
    if (statusDropdownId === null) return;
    function onClick() { setStatusDropdownId(null); }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [statusDropdownId]);

  async function handleQuickStatusChange(orderId: number, slug: string) {
    try {
      await updateOrderStatus(orderId, slug);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status_slug: slug, status_name: STATUS_LABELS[slug] || slug } : o));
      setStatusDropdownId(null);
    } catch (err) { console.error('Ошибка смены статуса:', err); }
  }

  function handleModalRefresh() {
    getOrders(buildParams()).then(res => setOrders(res.orders)).catch(console.error);
  }

  function resetFilters() {
    setBrandFilter(''); setModelFilter(''); setMasterFilter('');
    setCreatedFrom(''); setCreatedTo(''); setShowFilters(false);
  }

  const hasActiveFilters = brandFilter || modelFilter || masterFilter || createdFrom || createdTo;

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
    { key: 'new', label: 'Новые', count: counts.new }, { key: 'diagnosis', label: 'Диагностика', count: counts.diagnosis },
    { key: 'repair', label: 'Ремонт', count: counts.repair }, { key: 'ready', label: 'Готовы', count: counts.ready },
    { key: 'overdue', label: 'Просрочено', count: overdueCount }, { key: 'completed', label: 'Завершённые', count: orders.filter(o => o.status_slug === 'completed').length },
  ];
  if (user?.role === 'master') tabs.push({ key: 'my', label: 'Мои', count: 0 });

  const statCards = [
    { label: 'Новые заявки', value: counts.new, color: '#3b82f6' },
    { label: 'В работе', value: counts.diagnosis + counts.repair + counts.waiting_parts, color: '#f59e0b' },
    { label: 'Готовы к выдаче', value: counts.ready, color: '#22c55e' },
    { label: 'Просрочено', value: overdueCount, color: '#ef4444' },
  ];

  return (
    <div className={`ro-dashboard${compact ? ' compact' : ''}`}>
      <OrderSummary orders={orders} currentUserId={user?.id} currentUserRole={user?.role} />
      <div className="ro-stats">{statCards.map(c => (
        <div key={c.label} className="ro-stat-card" style={{ '--stat-color': c.color } as React.CSSProperties}>
          <span className="ro-stat-value">{c.value}</span><span className="ro-stat-label">{c.label}</span>
        </div>))}</div>

      <div className="ro-tabs">{tabs.map(t => (
        <button key={t.key} className={`ro-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
          {t.label}{t.count > 0 && <span className="ro-tab-count">{t.count}</span>}
        </button>))}</div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <button className="btn-secondary" onClick={() => setShowFilters(!showFilters)} style={{ padding: '6px 10px', fontSize: 12 }}>
          <Filter size={13} /> Фильтр{hasActiveFilters ? ` (активен)` : ''}
        </button>
        {hasActiveFilters && (
          <button onClick={resetFilters} style={{ padding: '6px 10px', fontSize: 12, background: 'none', border: '1px solid var(--danger)', borderRadius: 6, color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <X size={13} /> Сбросить
          </button>
        )}
      </div>

      {showFilters && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <FilterSelect label="Бренд" value={brandFilter} onChange={setBrandFilter} options={brands} />
          <FilterSelect label="Модель" value={modelFilter} onChange={setModelFilter} options={models} />
          <FilterSelect label="Мастер" value={masterFilter} onChange={setMasterFilter}
            options={masters.map(m => ({ value: String(m.id), label: m.name }))} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Создано с</div>
            <input type="date" value={createdFrom} onChange={e => setCreatedFrom(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--card-bg)', color: 'var(--text)' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Создано по</div>
            <input type="date" value={createdTo} onChange={e => setCreatedTo(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--card-bg)', color: 'var(--text)' }} />
          </div>
        </div>
      )}

      {/* Quick chips — brands + masters */}
      <QuickFilters brands={topBrands} masters={masters} brandFilter={brandFilter} masterFilter={masterFilter}
        onBrandChange={setBrandFilter} onMasterChange={setMasterFilter} />

      <div className="ro-actions">
        <button className="ro-btn-primary" onClick={() => navigate('/create-order')}>+ Заказ</button>
        {user?.role === 'admin' && (
          <button className="btn-secondary" onClick={() => {
            const params = new URLSearchParams();
            if (tab !== 'active' && tab !== 'overdue' && tab !== 'my') params.set('status', tab);
            if (tab === 'overdue') params.set('overdue', 'true');
            if (groupFilter) params.set('group_id', groupFilter);
            downloadCsv(`${apiUrl}/orders/export?${params}`, `orders_${new Date().toISOString().split('T')[0]}.csv`);
          }}><Download size={14} /> Экспорт</button>)}
        {groups.length > 0 && (
          <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--card-bg)', minWidth: 160 }}>
            <option value="">Все группы</option><option value="null">Без группы</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.order_count})</option>)}
          </select>)}
        <div className="view-toggle">
          <button className={`view-toggle-btn${view === 'table' ? ' active' : ''}`} onClick={() => setView('table')}><LayoutList size={14} /> Таблица</button>
          <button className={`view-toggle-btn${view === 'board' ? ' active' : ''}`} onClick={() => setView('board')}><Kanban size={14} /> Доска</button>
        </div>
        {view === 'table' && (<>
          <button className="btn-reset-cols" onClick={() => { const def = loadColumnOrder(); setColOrder(def); }} title="Вернуть порядок колонок по умолчанию"><RotateCcw size={12} /> Сбросить</button>
          <button className="btn-reset-cols" onClick={() => setCompact(!compact)} title={compact ? 'Обычный режим' : 'Компактный режим'}>
            {compact ? <Maximize2 size={12} /> : <Minimize2 size={12} />}{compact ? ' Обычный' : ' Компактно'}</button>
        </>)}
      </div>

      {loading ? <div className="loading">Загрузка...</div> : (
        view === 'board' ? (
          <BoardView orders={orders} onOrderUpdated={handleModalRefresh} onCardOpen={o => setModalOrder(o)} />
        ) : (
          <DashboardTable orders={orders} compact={compact} colOrder={colOrder} dragCol={dragCol}
            statusDropdownId={statusDropdownId} onColOrderChange={setColOrder} onDragColChange={setDragCol}
            onStatusDropdownChange={setStatusDropdownId} onStatusChange={handleQuickStatusChange} onRowClick={o => setModalOrder(o)} />
        )
      )}

      {!loading && orders.length === 0 && view === 'table' && <div className="empty-state"><p>Нет заказов</p></div>}
      {modalOrder && <OrderModal orderId={modalOrder.id} preload={modalOrder} onClose={() => setModalOrder(null)} onOrderUpdated={handleModalRefresh} />}
    </div>
  );
}

// Маленький переиспользуемый компонент для фильтра-селекта
function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<string | { value: string; label: string }>;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--card-bg)', color: 'var(--text)', minWidth: 120 }}>
        <option value="">Все</option>
        {options.map((opt, i) => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lbl = typeof opt === 'string' ? opt : opt.label;
          return <option key={i} value={val}>{lbl}</option>;
        })}
      </select>
    </div>
  );
}
