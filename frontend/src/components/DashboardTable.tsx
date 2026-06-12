import { type Order } from '../api';

const statusLabels: Record<string, string> = {
  new: 'Новая', diagnosis: 'Диагностика', waiting_parts: 'Ожидание запчасти',
  repair: 'Ремонт', ready: 'Готов к выдаче', completed: 'Выдан', cancelled: 'Отказ'
};

const statusColors: Record<string, string> = {
  new: 's-new', diagnosis: 's-diagnosis', waiting_parts: 's-waiting',
  repair: 's-repair', ready: 's-ready', completed: 's-completed', cancelled: 's-cancelled'
};

const statusHexColors: Record<string, string> = {
  new: '#3b82f6', diagnosis: '#f59e0b', waiting_parts: '#8b5cf6',
  repair: '#f97316', ready: '#22c55e', completed: '#6b7280', cancelled: '#ef4444'
};

const ALL_STATUSES = ['new', 'diagnosis', 'waiting_parts', 'repair', 'ready', 'completed', 'cancelled'];

export type ColumnKey = 'id' | 'status' | 'priority' | 'deadline' | 'client' | 'device' | 'issue' | 'master' | 'group' | 'cost';

export const defaultColumns: { key: ColumnKey; label: string }[] = [
  { key: 'id', label: '№' }, { key: 'status', label: 'Статус' }, { key: 'priority', label: 'Приоритет' },
  { key: 'deadline', label: 'Срок' }, { key: 'client', label: 'Клиент' }, { key: 'device', label: 'Устройство' },
  { key: 'issue', label: 'Проблема' }, { key: 'master', label: 'Мастер' }, { key: 'group', label: 'Группа' },
  { key: 'cost', label: 'Сумма' },
];

export function loadColumnOrder(): ColumnKey[] {
  try {
    const saved = localStorage.getItem('qazrem_columns');
    if (saved) {
      const parsed = JSON.parse(saved) as ColumnKey[];
      if (defaultColumns.every(c => parsed.includes(c.key)) && parsed.length === defaultColumns.length) return parsed;
    }
  } catch {}
  return defaultColumns.map(c => c.key);
}

export function saveColumnOrder(order: ColumnKey[]) { localStorage.setItem('qazrem_columns', JSON.stringify(order)); }

interface Props {
  orders: Order[];
  compact: boolean;
  colOrder: ColumnKey[];
  dragCol: ColumnKey | null;
  statusDropdownId: number | null;
  onColOrderChange: (order: ColumnKey[]) => void;
  onDragColChange: (key: ColumnKey | null) => void;
  onStatusDropdownChange: (id: number | null) => void;
  onStatusChange: (orderId: number, slug: string) => void;
  onRowClick: (order: Order) => void;
}

export function DashboardTable({ orders, compact, colOrder, dragCol, statusDropdownId,
  onColOrderChange, onDragColChange, onStatusDropdownChange, onStatusChange, onRowClick }: Props) {

  function renderCell(key: ColumnKey, o: Order) {
    const stickyLeft = key === 'id' ? ' sticky-left' : '';
    const stickyRight = key === 'cost' ? ' sticky-right' : '';
    const sticky = stickyLeft || stickyRight;
    switch (key) {
      case 'id':
        return <td key={key} className={`ro-cell-id${sticky}`}>#{o.id}{o.is_overdue && <span style={{ color: '#ef4444', marginLeft: 4 }}>⚠</span>}</td>;
      case 'status': {
        const available = ALL_STATUSES.filter(s => s !== o.status_slug);
        const isOpen = statusDropdownId === o.id;
        return <td key={key} style={{ position: 'relative' }}>
          <span className={`ro-badge ${statusColors[o.status_slug]}`}
            style={{ cursor: available.length > 0 ? 'pointer' : 'default' }}
            onClick={(e) => { e.stopPropagation(); onStatusDropdownChange(isOpen ? null : o.id); }}>
            {statusLabels[o.status_slug]}{available.length > 0 && <span style={{ marginLeft: 4, fontSize: 10 }}>▾</span>}
          </span>
          {isOpen && available.length > 0 && (
            <div className="status-dropdown" onClick={e => e.stopPropagation()}>
              {available.map(slug => (
                <button key={slug} className="status-dropdown-item"
                  style={{ borderLeft: `3px solid ${statusHexColors[slug] || '#6b7280'}` }}
                  onClick={() => onStatusChange(o.id, slug)}>
                  <span className="status-dropdown-dot" style={{ background: statusHexColors[slug] || '#6b7280' }} />{statusLabels[slug]}
                </button>))}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#9aa0a6', marginTop: 2 }}>{o.created_by_name || ''} · {new Date(o.created_at).toLocaleDateString()}</div>
        </td>;
      }
      case 'priority':
        return <td key={key}>{o.priority !== 'normal' && <span className={`ro-priority ${o.priority}`}>{o.priority === 'urgent' ? 'Срочно' : 'Критично'}</span>}</td>;
      case 'deadline':
        return <td key={key} className="ro-cell-date">{o.deadline ? new Date(o.deadline).toLocaleDateString() : '-'}</td>;
      case 'client':
        return <td key={key} className="ro-cell-client"><strong>{o.client_name}</strong><span>{o.client_phone}</span></td>;
      case 'device':
        return <td key={key}><div>{o.brand} {o.model}</div><div style={{ fontSize: 11, color: '#9aa0a6', fontFamily: 'monospace' }}>{o.imei}</div></td>;
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
    <div className="ro-table-wrap">
      <table className={`ro-table${compact ? ' compact' : ''}`}>
        <thead><tr>
          {colOrder.map(key => {
            const col = defaultColumns.find(c => c.key === key)!;
            const sl = key === 'id' ? ' sticky-left' : '';
            const sr = key === 'cost' ? ' sticky-right' : '';
            return <th key={key} className={`${sl}${sr}`} draggable
              onDragStart={() => onDragColChange(key)} onDragOver={e => e.preventDefault()}
              onDrop={() => {
                if (dragCol && dragCol !== key) {
                  const no = [...colOrder]; const fi = no.indexOf(dragCol); const ti = no.indexOf(key);
                  no.splice(fi, 1); no.splice(ti, 0, dragCol);
                  onColOrderChange(no); saveColumnOrder(no);
                }
                onDragColChange(null);
              }}
              onDragEnd={() => onDragColChange(null)}
              style={{ cursor: 'grab', opacity: dragCol === key ? 0.4 : 1, transition: 'opacity 0.15s' }}
              title="Перетащите чтобы изменить порядок">{col.label}</th>;
          })}
        </tr></thead>
        <tbody>
          {orders.map(o => {
            const priClass = o.priority !== 'normal' ? ` priority-${o.priority}` : '';
            return <tr key={o.id} className={`ro-row${o.is_overdue ? ' overdue' : ''}${priClass}`}
              onClick={() => onRowClick(o)}>{colOrder.map(key => renderCell(key, o))}</tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}
