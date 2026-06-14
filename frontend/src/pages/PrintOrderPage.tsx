import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getOrder, previewPrintTemplate, getPrintTemplates, type OrderDetail, type PrintTemplateListItem } from '../api';

export function PrintOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [html, setHtml] = useState('');
  const [templates, setTemplates] = useState<PrintTemplateListItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(
    searchParams.get('templateId') ? Number(searchParams.get('templateId')) : undefined
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const orderId = Math.round(Number(id));

    Promise.all([
      getOrder(orderId),
      getPrintTemplates().catch(() => [] as PrintTemplateListItem[]),
    ]).then(([o, t]) => {
      setOrder(o);
      setTemplates(t);

      // Если не выбран шаблон — берём дефолтный
      const tplId = selectedTemplateId || t.find(tp => tp.is_default)?.id;
      return previewPrintTemplate(orderId, tplId);
    }).then(res => {
      if (res) setHtml(res.html);
    }).catch(console.error).finally(() => setLoading(false));
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

  async function handleTemplateChange(tplId: number | undefined) {
    setSelectedTemplateId(tplId);
    try {
      const orderId = Math.round(Number(id));
      const res = await previewPrintTemplate(orderId, tplId);
      setHtml(res.html);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="print-page">
      <style>{`
        @media print {
          body { margin: 0; padding: 20px; font-family: Arial, sans-serif; font-size: 12px; }
          .no-print { display: none !important; }
          @page { margin: 15mm; }
          table { width: 100%; border-collapse: collapse; }
          td, th { padding: 6px 8px; border: 1px solid #000; text-align: left; font-size: 11px; }
        }
      `}</style>

      <div className="no-print" style={{ padding: 16, textAlign: 'center' }}>
        {templates.length > 0 && (
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#5f6368' }}>Шаблон:</span>
            <select value={selectedTemplateId || ''} onChange={e => handleTemplateChange(e.target.value ? Number(e.target.value) : undefined)}
              style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}>
              <option value="">По умолчанию</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <button onClick={() => window.print()} className="btn-primary" style={{ fontSize: 16, padding: '12px 24px' }}>
          🖨️ Печать
        </button>
        <p style={{ marginTop: 8, color: '#5f6368', fontSize: 13 }}>Или нажмите Cmd+P (Ctrl+P)</p>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}
        dangerouslySetInnerHTML={{ __html: html || '<p style="text-align:center;color:#999">Загрузка шаблона...</p>' }} />
    </div>
  );
}
