import { useDroppable } from '@dnd-kit/core';
import { BoardCard } from './BoardCard';
import type { Order } from '../api';
import { STATUS_COLORS, STATUS_LABELS_PLURAL } from '../constants';

interface Props {
  status: string;
  orders: Order[];
  onCardOpen: (order: Order) => void;
}

export function BoardColumn({ status, orders, onCardOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = STATUS_COLORS[status] || '#6b7280';

  return (
    <div
      ref={setNodeRef}
      className={`board-column${isOver ? ' drag-over' : ''}`}
    >
      <div className="board-column-header">
        <span className="board-column-dot" style={{ background: color }} />
        <span className="board-column-title">{STATUS_LABELS_PLURAL[status] || status}</span>
        <span className="board-column-dash">—</span>
        <span className="board-column-count">{orders.length}</span>
      </div>
      <div className="board-column-body">
        {orders.map(order => (
          <BoardCard key={order.id} order={order} onOpen={onCardOpen} />
        ))}
        {orders.length === 0 && (
          <div className="board-column-empty">Нет заказов</div>
        )}
      </div>
    </div>
  );
}
