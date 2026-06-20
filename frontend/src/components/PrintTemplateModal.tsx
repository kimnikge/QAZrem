import { useEffect, useRef, useState } from 'react';
import {
  getPrintTemplate, getTemplateVariables,
  createPrintTemplate, updatePrintTemplate,
  samplePreviewPrintTemplate,
  type TemplateVariable
} from '../api';

type Props = {
  mode: 'create' | 'edit';
  templateId?: number;
  onClose: () => void;
  onSaved: () => void;
};

export function PrintTemplateModal({ mode, templateId, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [lang, setLang] = useState<'ru' | 'kz'>('ru');
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [previewHtml, setPreviewHtml] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(mode === 'edit');
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getTemplateVariables().then(setVariables).catch(() => {});
    if (mode === 'edit' && templateId) {
      getPrintTemplate(templateId).then(t => {
        setName(t.name);
        setContent(t.content);
        setIsDefault(t.is_default);
        setLang((t.lang as 'ru' | 'kz') || 'ru');
      }).catch(err => setError(err.message)).finally(() => setLoading(false));
    }
  }, [mode, templateId]);

  // Debounced live preview
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      if (!content.trim()) { setPreviewHtml(''); return; }
      try {
        const res = await samplePreviewPrintTemplate(content);
        setPreviewHtml(res.html);
      } catch { /* игнорируем */ }
    }, 400);
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
  }, [content]);

  const groupedVars: Record<string, TemplateVariable[]> = {};
  for (const v of variables) {
    if (!groupedVars[v.group]) groupedVars[v.group] = [];
    groupedVars[v.group].push(v);
  }

  function insertVariable(key: string) {
    setContent(prev => prev + key);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (mode === 'create') {
        await createPrintTemplate({ name, content, is_default: isDefault, lang } as any);
      } else if (templateId) {
        await updatePrintTemplate(templateId, { name, content, is_default: isDefault, lang } as any);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28 }}>Загрузка...</div>
    </div>
  );

  const langLabels: Record<string, string> = { ru: '🇷🇺 Русский', kz: '🇰🇿 Қазақша' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, padding: 28, width: '95vw', maxWidth: 1200, maxHeight: '92vh', overflow: 'auto',
        display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <h3 style={{ margin: 0 }}>{mode === 'create' ? 'Новый шаблон' : 'Редактировать шаблон'}</h3>
        {error && <div className="error-message">{error}</div>}

        {/* Язык + Название + По умолчанию */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Язык</label>
            <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {(['ru', 'kz'] as const).map(l => (
                <button key={l} type="button"
                  onClick={() => setLang(l)}
                  style={{
                    padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13,
                    background: lang === l ? '#1a73e8' : '#fff',
                    color: lang === l ? '#fff' : '#333',
                    fontWeight: lang === l ? 600 : 400,
                  }}
                >{langLabels[l]}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Название</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
              По умолчанию
            </label>
          </div>
        </div>

        {/* Редактор + Переменные + Предпросмотр */}
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 450 }}>
          <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>HTML-шаблон</label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              style={{
                flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6,
                fontSize: 12, fontFamily: 'monospace', resize: 'vertical', minHeight: 400, lineHeight: 1.5
              }}
              placeholder="<div>АКТ №#ЗАКАЗ-НОМЕР</div>..."
            />
          </div>

          <div style={{ width: 200, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: '#5f6368', marginBottom: 8, fontWeight: 600 }}>Переменные</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, maxHeight: 420, overflow: 'auto', background: '#f8f9fa' }}>
              {Object.entries(groupedVars).map(([group, vars]) => (
                <div key={group} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#5f6368', marginBottom: 4, textTransform: 'uppercase' }}>{group}</div>
                  {vars.map(v => (
                    <button key={v.key} type="button" onClick={() => insertVariable(v.key)} title={v.label}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '3px 6px',
                        border: 'none', borderRadius: 4, background: 'transparent', cursor: 'pointer',
                        fontSize: 11, fontFamily: 'monospace', color: '#1a73e8', marginBottom: 1
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#e8f0fe')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >{v.key}</button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Предпросмотр</label>
            <div style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden', background: '#fff', minHeight: 400 }}>
              {previewHtml ? (
                <iframe
                  srcDoc={`<html><head><style>body{font-family:Arial,sans-serif;font-size:12px;padding:16px;color:#1f2937}table{width:100%;border-collapse:collapse;margin:8px 0}td,th{padding:6px 8px;border:1px solid #d1d5db;text-align:left;font-size:11px}code{background:#f3f4f6;padding:1px 4px;border-radius:3px}h1{font-size:18px}h3{font-size:14px}</style></head><body>${previewHtml}</body></html>`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="Предпросмотр"
                />
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  Начните вводить HTML-шаблон с переменными — здесь появится живой предпросмотр документа
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'end', marginTop: 8 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Сохранение...' : mode === 'create' ? 'Создать' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}
