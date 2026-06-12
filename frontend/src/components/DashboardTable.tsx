import { useState } from 'react';
import { type Order } from '../api';

const statusLabels: Record<string, string> = {
  new: 'Новый', diagnosis: 'Диагностика', waiting_parts: 'Ожидание',
  repair: 'Ремонт', ready: 'Готов', completed: 'Выдан', cancelled: 'Отказ'
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
  { key: 'id', label: '№' }, { key: 'status', label: 'Статус' }, { key: 'priority', label: '⚡' },
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

  const [copiedImei, setCopiedImei] = useState<number | null>(null);

  function copyImei(e: React.MouseEvent, orderId: number, imei: string) {
    e.stopPropagation();
    navigator.clipboard.writeText(imei).then(() => {
      setCopiedImei(orderId);
      setTimeout(() => setCopiedImei(null), 1500);
    }).catch(() => {});
  }

  function renderCell(key: ColumnKey, o: Order) {
    const stickyLeft = key === 'id' ? ' sticky-left' : '';
    const stickyRight = key === 'cost' ? ' sticky-right' : '';
    const sticky = stickyLeft || stickyRight;
    switch (key) {
      case 'id':
        return <td key={key} className={`ro-cell-id${sticky}`} style={{ fontWeight: 600 }}>
          №{o.id}{o.is_overdue && <span className="ro-overdue-dot" title="Просрочен">!</span>}
        </td>;
      case 'status': {
        const available = ALL_STATUSES.filter(s => s !== o.status_slug);
        const isOpen = statusDropdownId === o.id;
        return <td key={key} style={{ position: 'relative' }}>
          <div className="ro-status-wrap">
            <span className={`ro-badge ${statusColors[o.status_slug]}${available.length > 0 ? ' clickable' : ''}`}
              onClick={(e) => { e.stopPropagation(); if (available.length > 0) onStatusDropdownChange(isOpen ? null : o.id); }}>
              {statusLabels[o.status_slug]}{available.length > 0 && <span className="ro-badge-arrow">▾</span>}
            </span>
            <span className="ro-meta-line">{o.created_by_name || ''}{o.created_by_name && o.created_at ? ' · ' : ''}{o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}</span>
          </div>
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
        </td>;
      }
      case 'priority':
        return <td key={key} style={{ textAlign: 'center' }}>
          {o.priority === 'urgent' && <span className="ro-priority urgent">!</span>}
          {o.priority === 'critical' && <span className="ro-priority critical">!!</span>}
        </td>;
      case 'deadline':
        return <td key={key} className={`ro-cell-date${o.is_overdue ? ' overdue' : ''}`}>
          {o.deadline ? new Date(o.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '—'}
        </td>;
      case 'client':
        return <td key={key} className="ro-cell-client">
          <div className="ro-client-name">{o.client_name}</div>
          <div className="ro-client-phone">{o.client_phone}</div>
        </td>;
      case 'device':
        return <td key={key} className="ro-cell-device">
          <div className="ro-device-name">{o.brand} {o.model}</div>
          <div className="ro-device-imei" onClick={(e) => copyImei(e, o.id, o.imei)} title="Копировать IMEI">
            {o.imei}
            {copiedImei === o.id ? <span className="ro-imei-copied">Скопировано</span> : <span className="ro-imei-copy-icon">📋</span>}
          </div>
        </td>;
      case 'issue':
        return <td key={key} className="ro-cell-desc">{o.issue_description}</td>;
      case 'master':
        return <td key={key}>
          <span className={o.master_name ? 'ro-master-name' : 'ro-master-empty'}>{o.master_name || '—'}</span>
        </td>;
      case 'group':
        return <td key={key}>
          <span className={o.group_name ? 'ro-group-tag' : 'ro-group-empty'}>{o.group_name || '—'}</span>
        </td>;
      case 'cost':
        return <td key={key} className={`ro-cell-price${sticky}`} style={{ fontWeight: 600 }}>
          {Math.round(Number(o.cost)) > 0 ? `${Math.round(Number(o.cost))} ₸` : '0 ₸'}
        </td>;
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
