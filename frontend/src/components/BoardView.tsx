import { useState } from 'react';
import { DndContext, type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { BoardColumn } from './BoardColumn';
import { updateOrderStatus } from '../api';
import type { Order } from '../api';

const BOARD_STATUSES = ['new', 'diagnosis', 'waiting_parts', 'repair', 'ready'];

interface Props {
  orders: Order[];
  onOrderUpdated: () => void;
  onCardOpen: (order: Order) => void;
}

export function BoardView({ orders, onOrderUpdated, onCardOpen }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;

    const orderId = String(active.id).replace('order-', '');
    const newStatus = String(over.id);

    const order = orders.find(o => o.id === Number(orderId));
    if (!order) return;
    if (order.status_slug === newStatus) return;

    try {
      await updateOrderStatus(Number(orderId), newStatus);
      onOrderUpdated();
    } catch (err) {
      console.error('Ошибка смены статуса:', err);
    }
  }

  const columns = BOARD_STATUSES.map(status => ({
    status,
    orders: orders.filter(o => o.status_slug === status)
  }));

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="board">
        {columns.map(col => (
          <BoardColumn key={col.status} status={col.status} orders={col.orders} onCardOpen={onCardOpen} />
        ))}
      </div>
    </DndContext>
  );
}
