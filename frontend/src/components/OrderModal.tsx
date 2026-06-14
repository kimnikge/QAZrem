import { useNavigate } from 'react-router-dom';
import { X, Printer, Edit3, Save, Loader2 } from 'lucide-react';
import { type Order } from '../api';
import { useOrderModal } from '../hooks/useOrderModal';
import { OrderPartsSection } from './OrderPartsSection';
import { STATUS_LABELS } from '../constants';

interface Props { orderId: number; preload?: Order; onClose: () => void; onOrderUpdated?: () => void; }

export function OrderModal({ orderId, preload, onClose, onOrderUpdated }: Props) {
  const navigate = useNavigate();
  const m = useOrderModal({ orderId, preload, onOrderUpdated });

  const order = m.order;
  const finalCost = order ? Math.max(0, Math.round(Number(order.cost)) - Math.round(Number(order.discount))) : 0;
  const totalPaid = order ? order.payments.reduce((s, p) => s + Math.round(Number(p.amount)), 0) : 0;
  const remaining = finalCost - totalPaid;

  return (
    <div className="modal-overlay" onClick={() => { if (!m.editing) onClose(); }}>
      <div className="modal-glow">
        <div className="modal-content" onClick={e => e.stopPropagation()}>
        {m.loading ? (
          <div className="modal-loading"><Loader2 size={24} className="spin" /> Загрузка...</div>
        ) : m.error ? (
          <div className="modal-error">{m.error}</div>
        ) : order ? (<>
          <div className="modal-header">
            <div className="modal-header-left">
              <span className="modal-order-id">Заказ №{order.id}</span>
              <span className={`modal-status-badge status-${order.status_slug}`}>{STATUS_LABELS[order.status_slug]}</span>
              {order.priority !== 'normal' && <span className={`modal-priority ${order.priority}`}>{order.priority === 'urgent' ? '⚡ Срочно' : '🔥 Критично'}</span>}
            </div>
            <div className="modal-header-right">
              <button className="modal-btn-icon" onClick={() => navigate(`/print-order/${order.id}`)} title="Печать"><Printer size={16} /></button>
              {m.editing ? (
                <button className="modal-btn-icon" onClick={m.handleSave} disabled={m.saving} title="Сохранить" style={{ color: 'var(--primary)' }}><Save size={16} /></button>
              ) : (
                <button className="modal-btn-icon" onClick={() => m.setEditing(true)} title="Редактировать"><Edit3 size={16} /></button>
              )}
              <button className="modal-btn-icon" onClick={onClose} title="Закрыть"><X size={18} /></button>
            </div>
          </div>

          <div className="modal-body">
            <div className="modal-section">
              <div className="modal-field"><span className="modal-label">Клиент</span>
                {m.editing ? <input value={m.editClientName} onChange={e => m.setEditClientName(e.target.value)} className="modal-input-inline" placeholder="Имя клиента" /> : <span className="modal-value">{order.client_name}</span>}</div>
              <div className="modal-field"><span className="modal-label">Телефон</span>
                {m.editing ? <input value={m.editClientPhone} onChange={e => m.setEditClientPhone(e.target.value)} className="modal-input-inline" placeholder="+7..." /> : <span className="modal-value">{order.client_phone}</span>}</div>
            </div>
            <div className="modal-section">
              <div className="modal-field"><span className="modal-label">Бренд</span>
                {m.editing ? <input value={m.editBrand} onChange={e => m.setEditBrand(e.target.value)} className="modal-input-inline" placeholder="Apple" /> : <span className="modal-value">{order.brand}</span>}</div>
              <div className="modal-field"><span className="modal-label">Модель</span>
                {m.editing ? <input value={m.editModel} onChange={e => m.setEditModel(e.target.value)} className="modal-input-inline" placeholder="iPhone 15" /> : <span className="modal-value">{order.model}</span>}</div>
              <div className="modal-field"><span className="modal-label">IMEI</span>
                {m.editing ? <input value={m.editImei} onChange={e => m.setEditImei(e.target.value)} className="modal-input-inline mono" placeholder="000000000000000" /> : <code className="modal-value-mono">{order.imei}</code>}</div>
              <div className="modal-field"><span className="modal-label">Серийный №</span>
                {m.editing ? <input value={m.editSerialNumber} onChange={e => m.setEditSerialNumber(e.target.value)} className="modal-input-inline mono" placeholder="SN..." /> : (
                  order.serial_number ? <code className="modal-value-mono">{order.serial_number}</code> : <span className="modal-value" style={{ color: 'var(--text-muted)' }}>—</span>
                )}</div>
            </div>

            {m.editing ? (
              <div className="modal-section"><div className="modal-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}><span className="modal-label">Диагноз</span>
                <textarea value={m.editDiagnosis} onChange={e => m.setEditDiagnosis(e.target.value)} rows={2} className="modal-input" placeholder="Опишите диагноз..." /></div></div>
            ) : order.diagnosis ? (
              <div className="modal-section"><div className="modal-field"><span className="modal-label">Диагноз</span><span className="modal-value">{order.diagnosis}</span></div></div>
            ) : null}

            <div className="modal-section"><div className="modal-field" style={m.editing ? { flexDirection: 'column', alignItems: 'stretch', gap: 4 } : undefined}>
              <span className="modal-label">Проблема</span>
              {m.editing ? <textarea value={m.editIssue} onChange={e => m.setEditIssue(e.target.value)} rows={2} className="modal-input" placeholder="Опишите проблему..." /> : <span className="modal-value">{order.issue_description}</span>}</div></div>

            <div className="modal-section modal-finance">
              <div className="modal-field"><span className="modal-label">Стоимость</span>
                {m.editing ? <input type="number" value={m.editCost} onChange={e => m.setEditCost(e.target.value)} className="modal-input-num" /> : <span className="modal-value">{Math.round(Number(order.cost))} ₸</span>}</div>
              {m.editing ? (
                <div className="modal-field"><span className="modal-label">Скидка</span><input type="number" value={m.editDiscount} onChange={e => m.setEditDiscount(e.target.value)} className="modal-input-num" /></div>
              ) : Math.round(Number(order.discount)) > 0 ? (
                <div className="modal-field"><span className="modal-label">Скидка</span><span className="modal-value" style={{ color: 'var(--danger)' }}>−{Math.round(Number(order.discount))} ₸</span></div>
              ) : null}
              <div className="modal-field"><span className="modal-label">Итого</span><span className="modal-value" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                {m.editing ? `${Math.max(0, Math.round(Number(m.editCost)) - Math.round(Number(m.editDiscount)))} ₸` : `${finalCost} ₸`}</span></div>
              <div className="modal-field"><span className="modal-label">Оплачено</span><span className="modal-value">{totalPaid} ₸</span></div>
              <div className="modal-field"><span className="modal-label">Остаток</span><span className="modal-value" style={{ color: remaining > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {remaining > 0 ? `${remaining} ₸` : '0 ₸ ✓'}</span></div>
            </div>

            {m.editing && m.groups.length > 0 && (
              <div className="modal-section"><div className="modal-field"><span className="modal-label">Группа</span>
                <select value={m.editGroupId} onChange={e => m.setEditGroupId(e.target.value)} className="modal-select">
                  <option value="">— Без группы —</option>{m.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div></div>
            )}

            {m.editing ? (
              <div className="modal-section"><div className="modal-field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}><span className="modal-label">Комментарий</span>
                <input value={m.editComment} onChange={e => m.setEditComment(e.target.value)} className="modal-input" placeholder="Внутренний комментарий..." /></div></div>
            ) : order.internal_comment ? (
              <div className="modal-section"><div className="modal-field"><span className="modal-label">Комментарий</span><span className="modal-value" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{order.internal_comment}</span></div></div>
            ) : null}

            <OrderPartsSection orderId={order.id} initialParts={order.parts} onRefresh={m.refresh} onError={m.setError} />
          </div>

          {m.statuses.length > 0 && (
            <div className="modal-footer">{m.statuses.map(s => <button key={s.slug} className="btn-status" onClick={() => m.handleStatus(s.slug)}>{STATUS_LABELS[s.slug] || s.name}</button>)}</div>
          )}
        </>) : null}
      </div>
      </div>
    </div>
  );
}
