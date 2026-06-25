import { useEffect, useState, useRef } from 'react';
import { X, Plus } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';

type Tag = { id: number; name: string; color: string };

type TagSelectProps = {
  selected: Tag[];
  onChange: (tags: Tag[]) => void;
};

export function TagSelect({ selected, onChange }: TagSelectProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    fetch(`${API}/parts/tags`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setAllTags).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = allTags.filter(t =>
    t.name.toLowerCase().includes(query.toLowerCase()) &&
    !selected.find(s => s.id === t.id)
  );

  const addTag = (tag: Tag) => {
    if (!selected.find(s => s.id === tag.id)) {
      onChange([...selected, tag]);
    }
    setQuery('');
  };

  const removeTag = (id: number) => {
    onChange(selected.filter(s => s.id !== id));
  };

  const createTag = async () => {
    if (!query.trim()) return;
    setCreating(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch(`${API}/parts/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: query.trim() }),
      });
      const newTag = await res.json();
      setAllTags(prev => [...prev, newTag]);
      addTag(newTag);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={{ fontSize: 13, color: '#5f6368', display: 'block', marginBottom: 4 }}>Теги</label>

      {/* Выбранные теги */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {selected.map(tag => (
          <span key={tag.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: tag.color || '#6b7280', color: '#fff',
            borderRadius: 12, padding: '2px 8px', fontSize: 12, fontWeight: 500
          }}>
            {tag.name}
            <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeTag(tag.id)} />
          </span>
        ))}
      </div>

      {/* Поле ввода */}
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
        onFocus={() => setShowDropdown(true)}
        placeholder="Найти или создать тег..."
        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }}
      />

      {/* Выпадающий список */}
      {showDropdown && (query.length > 0) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          background: '#fff', border: '1px solid var(--border)', borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 180, overflow: 'auto'
        }}>
          {filtered.map(tag => (
            <div key={tag.id} onClick={() => addTag(tag)} style={{
              padding: '8px 12px', cursor: 'pointer', fontSize: 14,
              borderBottom: '1px solid #f3f4f6'
            }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: tag.color, marginRight: 8 }} />
              {tag.name}
            </div>
          ))}
          {filtered.length === 0 && (
            <div onClick={createTag} style={{
              padding: '8px 12px', cursor: 'pointer', fontSize: 14,
              color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6
            }}>
              <Plus size={14} />
              {creating ? 'Создание...' : `Создать тег «${query.trim()}»`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
