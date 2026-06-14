import { useDraggable } from '@dnd-kit/core';
import { Clock, User, Wrench, GripVertical } from 'lucide-react';
import type { Order } from '../api';
import { STATUS_LABELS_SHORT } from '../constants';

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
      {/* Верх: номер заказа + статус */}
      <div className="board-card-top">
        <div className="board-card-left">
          <span className="board-card-id">Заказ №{order.id}</span>
          <span className={`board-card-status status-${order.status_slug}`}>
            {STATUS_LABELS_SHORT[order.status_slug] || order.status_name}
          </span>
        </div>
        <div className="board-card-drag" {...listeners}>
          <GripVertical size={14} />
        </div>
      </div>

      {/* Клиент */}
      <div className="board-card-row">
        <User size={12} />
        <span>{order.client_name}</span>
      </div>

      {/* Устройство + IMEI */}
      <div className="board-card-row">
        <Wrench size={12} />
        <div className="board-card-device-info">
          <span className="board-card-device-name">{order.brand} {order.model}</span>
          <span className="board-card-imei">{order.imei}</span>
        </div>
      </div>

      {/* Мастер */}
      {order.master_name && (
        <div className="board-card-row board-card-master">
          <span className="board-card-label">Исполнитель</span>
          <span>{order.master_name}</span>
        </div>
      )}

      {/* Низ: срок + сумма */}
      <div className="board-card-bottom">
        {order.deadline ? (
          <span className={`board-card-deadline${order.is_overdue ? ' overdue' : ''}`}>
            <Clock size={11} />
            {new Date(order.deadline).toLocaleDateString()}
          </span>
        ) : <span />}
        <span className="board-card-cost">
          {Math.round(Number(order.cost)) > 0 ? `${Math.round(Number(order.cost))} ₸` : '0 ₸'}
        </span>
      </div>
    </div>
  );
}
