import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getOrder, type OrderDetail } from '../api';

export function PrintOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getOrder(Number(id)).then(setOrder).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && order) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, order]);

  const statusLabels: Record<string, string> = {
    new: 'Новая заявка', diagnosis: 'Диагностика', waiting_parts: 'Ожидание запчасти',
    repair: 'Ремонт', ready: 'Готов к выдаче', completed: 'Выдан', cancelled: 'Отказ'
  };

  // Скрываем сайдбар через Layout
  useEffect(() => {
    document.body.classList.add('print-mode');
    return () => document.body.classList.remove('print-mode');
  }, []);

  if (loading) return <div className="loading">Загрузка...</div>;
  if (!order) return <div className="error-message">Заказ не найден</div>;

  const finalCost = Math.max(0, Number(order.cost) - Number(order.discount));

  return (
    <div className="print-page">
      <style>{`
        @media print {
          body { margin: 0; padding: 20px; font-family: 'Courier New', monospace; font-size: 12px; }
          .no-print { display: none !important; }
          @page { margin: 15mm; }
          table { width: 100%; border-collapse: collapse; }
          td, th { padding: 6px 8px; border: 1px solid #000; text-align: left; font-size: 11px; }
        }
      `}</style>

      <div className="no-print" style={{ padding: 16, textAlign: 'center' }}>
        <button onClick={() => window.print()} className="btn-primary" style={{ fontSize: 16, padding: '12px 24px' }}>
          🖨️ Печать
        </button>
        <p style={{ marginTop: 8, color: '#5f6368', fontSize: 13 }}>Или нажмите Cmd+P (Ctrl+P)</p>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>АКТ ПРИЁМА-ПЕРЕДАЧИ №{order.id}</h1>
          <p style={{ fontSize: 11, color: '#666' }}>от {new Date(order.created_at).toLocaleDateString()}</p>
        </div>

        <table>
          <tr><td style={{ width: 200 }}><strong>Клиент</strong></td><td>{order.client_name}</td></tr>
          <tr><td><strong>Телефон</strong></td><td>{order.client_phone}</td></tr>
          <tr><td><strong>Устройство</strong></td><td>{order.brand} {order.model}</td></tr>
          <tr><td><strong>IMEI</strong></td><td><code>{order.imei}</code></td></tr>
          <tr><td><strong>Статус</strong></td><td>{statusLabels[order.status_slug]}</td></tr>
          {order.master_name && <tr><td><strong>Мастер</strong></td><td>{order.master_name}</td></tr>}
        </table>

        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14 }}>Описание проблемы:</h3>
          <p style={{ fontSize: 12 }}>{order.issue_description}</p>
        </div>

        {order.diagnosis && (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 14 }}>Диагноз:</h3>
            <p style={{ fontSize: 12 }}>{order.diagnosis}</p>
          </div>
        )}

        {order.parts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14 }}>Запчасти:</h3>
            <table>
              <thead><tr><th>Наименование</th><th>Кол-во</th><th>Цена</th></tr></thead>
              <tbody>
                {order.parts.map(p => (
                  <tr key={p.id}>
                    <td>{p.part_name}</td>
                    <td>{p.quantity_used}</td>
                    <td>{Number(p.selling_price_at_moment).toLocaleString()} ₸</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <table style={{ width: 'auto', marginLeft: 'auto' }}>
            <tr><td><strong>Стоимость</strong></td><td>{Number(order.cost).toLocaleString()} ₸</td></tr>
            {Number(order.discount) > 0 && <tr><td><strong>Скидка</strong></td><td>−{Number(order.discount).toLocaleString()} ₸</td></tr>}
            <tr><td><strong>Итого</strong></td><td><strong>{finalCost.toLocaleString()} ₸</strong></td></tr>
            <tr><td><strong>Предоплата</strong></td><td>{Number(order.prepaid).toLocaleString()} ₸</td></tr>
            <tr><td><strong>К оплате</strong></td><td><strong>{(finalCost - Number(order.prepaid)).toLocaleString()} ₸</strong></td></tr>
          </table>
        </div>

        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <div>Клиент: ___________________</div>
          <div>Мастер: ___________________</div>
        </div>

        <p style={{ marginTop: 24, fontSize: 10, color: '#999', textAlign: 'center' }}>
          Документ создан автоматически в QAZRem CRM
        </p>
      </div>
    </div>
  );
}
