import { useDroppable } from '@dnd-kit/core';
import { BoardCard } from './BoardCard';
import type { Order } from '../api';

const colColors: Record<string, string> = {
  new: '#3b82f6', diagnosis: '#f59e0b', waiting_parts: '#8b5cf6',
  repair: '#f97316', ready: '#22c55e', completed: '#6b7280', cancelled: '#ef4444'
};

const colLabels: Record<string, string> = {
  new: 'Новые', diagnosis: 'Диагностика', waiting_parts: 'Ожидание',
  repair: 'Ремонт', ready: 'Готовы', completed: 'Выдано', cancelled: 'Отказы'
};

interface Props {
  status: string;
  orders: Order[];
  onCardOpen: (order: Order) => void;
}

export function BoardColumn({ status, orders, onCardOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = colColors[status] || '#6b7280';

  return (
    <div
      ref={setNodeRef}
      className={`board-column${isOver ? ' drag-over' : ''}`}
    >
      <div className="board-column-header">
        <span className="board-column-dot" style={{ background: color }} />
        <span className="board-column-title">{colLabels[status] || status}</span>
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
