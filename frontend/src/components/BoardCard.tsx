import { useDraggable } from '@dnd-kit/core';
import { Clock, User, Wrench, GripVertical } from 'lucide-react';
import type { Order } from '../api';

const statusColors: Record<string, string> = {
  new: '#3b82f6', diagnosis: '#f59e0b', waiting_parts: '#8b5cf6',
  repair: '#f97316', ready: '#22c55e', completed: '#6b7280', cancelled: '#ef4444'
};

interface Props {
  order: Order;
  onOpen: (order: Order) => void;
}

export function BoardCard({ order, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `order-${order.id}`,
    data: { order }
  });

  const style = transform ? {
    transform: `translate(${transform.x}px, ${transform.y}px)`,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : undefined,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      style={style}
      className="board-card"
      onClick={() => onOpen(order)}
    >
      <div className="board-card-header">
        <span className="board-card-id">#{order.id}</span>
        <div className="board-card-drag" {...listeners}>
          <GripVertical size={14} />
        </div>
        {order.priority !== 'normal' && (
          <span className={`ro-priority ${order.priority}`}>
            {order.priority === 'urgent' ? 'Срочно' : 'Критично'}
          </span>
        )}
      </div>
      <div className="board-card-client">
        <User size={12} />
        <span>{order.client_name}</span>
      </div>
      <div className="board-card-device">
        <Wrench size={12} />
        <div>
          <div>{order.brand} {order.model}</div>
          <div style={{ fontSize: 10, color: '#9aa0a6', fontFamily: 'monospace' }}>{order.imei}</div>
        </div>
      </div>
      <div className="board-card-issue">{order.issue_description}</div>
      <div className="board-card-footer">
        {order.deadline && (
          <span className={`board-card-deadline${order.is_overdue ? ' overdue' : ''}`}>
            <Clock size={11} />
            {new Date(order.deadline).toLocaleDateString()}
          </span>
        )}
        <span className="board-card-cost">
          {Math.round(Number(order.cost)) > 0 ? `${Math.round(Number(order.cost))} ₸` : ''}
        </span>
      </div>
    </div>
  );
}
