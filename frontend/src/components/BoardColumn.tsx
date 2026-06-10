import { useDroppable } from '@dnd-kit/core';
import { BoardCard } from './BoardCard';
import type { Order } from '../api';

const colColors: Record<string, string> = {
  new: '#3b82f6', diagnosis: '#f59e0b', waiting_parts: '#8b5cf6',
  repair: '#f97316', ready: '#22c55e'
};

const colLabels: Record<string, string> = {
  new: 'Новые', diagnosis: 'Диагностика', waiting_parts: 'Ожидание',
  repair: 'Ремонт', ready: 'Готовы'
};

interface Props {
  status: string;
  orders: Order[];
}

export function BoardColumn({ status, orders }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = colColors[status] || '#6b7280';

  return (
    <div
      ref={setNodeRef}
      className={`board-column${isOver ? ' drag-over' : ''}`}
      style={{ borderTopColor: color }}
    >
      <div className="board-column-header" style={{ color }}>
        <span>{colLabels[status] || status}</span>
        <span className="board-column-count">{orders.length}</span>
      </div>
      <div className="board-column-body">
        {orders.map(order => (
          <BoardCard key={order.id} order={order} />
        ))}
        {orders.length === 0 && (
          <div className="board-column-empty">Нет заказов</div>
        )}
      </div>
    </div>
  );
}
