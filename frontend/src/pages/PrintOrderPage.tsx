import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getOrder, previewPrintTemplate, getPrintTemplates, type OrderDetail, type PrintTemplateListItem } from '../api';

export function PrintOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [html, setHtml] = useState('');
  const [templates, setTemplates] = useState<PrintTemplateListItem[]>([]);
  const [lang, setLang] = useState<'ru' | 'kz'>('ru');
  const [loading, setLoading] = useState(true);

  const orderId = id ? Math.round(Number(id)) : 0;

  useEffect(() => {
    if (!orderId) return;
    Promise.all([
      getOrder(orderId),
      getPrintTemplates().catch(() => [] as PrintTemplateListItem[]),
    ]).then(([o, t]) => {
      setOrder(o);
      setTemplates(t);
      const defaultTpl = t.find(tp => tp.is_default && tp.lang === lang);
      const tplId = defaultTpl?.id || t.find(tp => tp.is_default)?.id;
      return previewPrintTemplate(orderId, tplId);
    }).then(res => {
      if (res) setHtml(res.html);
    }).catch(console.error).finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (!loading && order) setTimeout(() => window.print(), 500);
  }, [loading, order]);

  useEffect(() => {
    document.body.classList.add('print-mode');
    return () => document.body.classList.remove('print-mode');
  }, []);

  async function handleTemplateChange(tplId: number | undefined) {
    try {
      const res = await previewPrintTemplate(orderId, tplId);
      setHtml(res.html);
    } catch (err) { console.error(err); }
  }

  async function handleLangChange(newLang: 'ru' | 'kz') {
    setLang(newLang);
    const defaultTpl = templates.find(tp => tp.is_default && tp.lang === newLang);
    try {
      const res = await previewPrintTemplate(orderId, defaultTpl?.id);
      setHtml(res.html);
    } catch (err) { console.error(err); }
  }

  if (loading) return <div className="loading">Загрузка...</div>;
  if (!order) return <div className="error-message">Заказ не найден</div>;

  const filteredTemplates = templates.filter(t => t.lang === lang);

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
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
          <button onClick={() => handleLangChange('ru')}
            style={{ padding: '8px 20px', border: '1px solid var(--border)', borderRadius: '6px 0 0 6px', cursor: 'pointer', fontSize: 14, fontWeight: lang === 'ru' ? 700 : 400, background: lang === 'ru' ? '#1a73e8' : '#fff', color: lang === 'ru' ? '#fff' : '#333' }}
          >🇷🇺 Русский</button>
          <button onClick={() => handleLangChange('kz')}
            style={{ padding: '8px 20px', border: '1px solid var(--border)', borderLeft: 'none', borderRadius: '0 6px 6px 0', cursor: 'pointer', fontSize: 14, fontWeight: lang === 'kz' ? 700 : 400, background: lang === 'kz' ? '#1a73e8' : '#fff', color: lang === 'kz' ? '#fff' : '#333' }}
          >🇰🇿 Қазақша</button>
        </div>
        {filteredTemplates.length > 0 && (
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#5f6368' }}>Шаблон:</span>
            <select onChange={e => handleTemplateChange(e.target.value ? Number(e.target.value) : undefined)}
              style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}>
              <option value="">По умолчанию</option>
              {filteredTemplates.map(t => <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (по умолч.)' : ''}</option>)}
            </select>
          </div>
        )}
        <button onClick={() => window.print()} className="btn-primary" style={{ fontSize: 16, padding: '12px 24px' }}>🖨️ Печать</button>
        <p style={{ marginTop: 8, color: '#5f6368', fontSize: 13 }}>Или нажмите Cmd+P (Ctrl+P)</p>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}
        dangerouslySetInnerHTML={{ __html: html || '<p style="text-align:center;color:#999">Загрузка шаблона...</p>' }} />
    </div>
  );
}
