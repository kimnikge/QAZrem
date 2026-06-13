import type { OrderDetail, OrderGroup } from '../api';

const statusLabels: Record<string, string> = {
  new: 'Новая', diagnosis: 'Диагностика', waiting_parts: 'Ожидание запчасти',
  repair: 'Ремонт', ready: 'Готов к выдаче', completed: 'Выдан', cancelled: 'Отказ'
};

interface Props {
  order: OrderDetail;
  editing: boolean;
  editCost: string; onEditCost: (v: string) => void;
  editDiscount: string; onEditDiscount: (v: string) => void;
  editDiagnosis: string; onEditDiagnosis: (v: string) => void;
  editComment: string; onEditComment: (v: string) => void;
  editGroupId: string; onEditGroupId: (v: string) => void;
  groups: OrderGroup[];
}

export function OrderInfoCard({ order, editing, editCost, onEditCost, editDiscount, onEditDiscount,
  editDiagnosis, onEditDiagnosis, editComment, onEditComment, editGroupId, onEditGroupId, groups }: Props) {

  const finalCost = Math.max(0, Math.round(Number(order.cost)) - Math.round(Number(order.discount)));
  const totalPaid = order.payments.reduce((s, p) => s + Math.round(Number(p.amount)), 0);
  const remaining = finalCost - totalPaid;

  return (
    <div className="detail-card">
      <h3>Информация</h3>
      <div className="detail-row"><span>Клиент</span><strong>{order.client_name}</strong></div>
      <div className="detail-row"><span>Телефон</span><strong>{order.client_phone}</strong></div>
      <div className="detail-row"><span>Устройство</span><strong>{order.brand} {order.model}</strong></div>
      <div className="detail-row"><span>IMEI</span><code>{order.imei}</code></div>
      <div className="detail-row"><span>Статус</span><strong>{statusLabels[order.status_slug]}</strong></div>
      <div className="detail-row"><span>Мастер</span><strong>{order.master_name || '—'}</strong></div>
      <div className="detail-row"><span>Локация</span><strong>{order.location_name || '—'}</strong></div>
      <div className="detail-row">
        <span>Группа</span>
        {editing ? (
          <select value={editGroupId} onChange={e => onEditGroupId(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, minWidth: 180 }}>
            <option value="">— Без группы —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        ) : (
          <strong style={{ color: order.group_name ? '#1a73e8' : '#9aa0a6' }}>{order.group_name || '—'}</strong>
        )}
      </div>

      {editing ? (
        <>
          <div className="detail-row"><span>Диагноз</span>
            <input value={editDiagnosis} onChange={e => onEditDiagnosis(e.target.value)}
              style={{ width: '60%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
          </div>
          <div className="detail-row"><span>Стоимость</span>
            <input value={editCost} onChange={e => onEditCost(e.target.value)} type="number"
              style={{ width: '40%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, textAlign: 'right' }} />
          </div>
          <div className="detail-row"><span>Скидка</span>
            <input value={editDiscount} onChange={e => onEditDiscount(e.target.value)} type="number"
              style={{ width: '40%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, textAlign: 'right' }} />
          </div>
          <div className="detail-row"><span>Комментарий</span>
            <input value={editComment} onChange={e => onEditComment(e.target.value)}
              style={{ width: '60%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
          </div>
        </>
      ) : (
        <>
          {order.diagnosis && <div className="detail-row"><span>Диагноз</span>{order.diagnosis}</div>}
          <div className="detail-row"><span>Стоимость</span><strong>{Math.round(Number(order.cost))} ₸</strong></div>
          {Math.round(Number(order.discount)) > 0 && <div className="detail-row"><span>Скидка</span><strong style={{ color: '#ef4444' }}>−{Math.round(Number(order.discount))} ₸</strong></div>}
          <div className="detail-row"><span>Итого</span><strong style={{ color: '#1a73e8', fontSize: 18 }}>{finalCost} ₸</strong></div>
          <div className="detail-row"><span>Предоплата</span><strong>{Math.round(Number(order.prepaid))} ₸</strong></div>
          <div className="detail-row"><span>Оплачено всего</span><strong style={{ color: totalPaid > 0 ? '#1a73e8' : '#5f6368' }}>{totalPaid} ₸</strong></div>
          {remaining > 0 ? (
            <div className="detail-row"><span style={{ color: '#ef4444', fontWeight: 500 }}>Остаток</span><strong style={{ color: '#ef4444', fontSize: 16 }}>{remaining} ₸</strong></div>
          ) : (
            <div className="detail-row"><span>Остаток</span><strong style={{ color: '#22c55e' }}>0 ₸ ✓</strong></div>
          )}
          {order.internal_comment && <div className="detail-row"><span>Комментарий</span>{order.internal_comment}</div>}
        </>
      )}
    </div>
  );
}
