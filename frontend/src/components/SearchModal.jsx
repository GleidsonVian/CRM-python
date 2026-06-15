import React, { useState, useEffect, useRef, useCallback } from 'react';

const API = 'http://localhost:8001';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function Highlight({ text = '', query = '' }) {
  if (!query.trim()) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark style={{ background: '#fef08a', color: '#0f172a', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  );
}

// SVG Icons
const Icons = {
  card: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 7h8M4 10h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  lead: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  contact: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M3.5 13c.7-2 2.5-3.2 4.5-3.2s3.8 1.2 4.5 3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  company: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 14V5l6-3 6 3v9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="6" y="10" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="4" y="7" width="2" height="2" rx="0.3" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="10" y="7" width="2" height="2" rx="0.3" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  search: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M13 13l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
};

const SECTIONS = [
  {
    key: 'cards',
    label: 'Negócios',
    badge: { bg: '#eef2ff', color: '#4338ca' },
    iconBg: '#eef2ff',
    iconColor: '#4338ca',
  },
  {
    key: 'leads',
    label: 'Leads',
    badge: { bg: '#fef3c7', color: '#92400e' },
    iconBg: '#fef3c7',
    iconColor: '#92400e',
  },
  {
    key: 'contacts',
    label: 'Contatos',
    badge: { bg: '#dcfce7', color: '#166534' },
    iconBg: '#dcfce7',
    iconColor: '#166534',
  },
  {
    key: 'companies',
    label: 'Empresas',
    badge: { bg: '#fce7f3', color: '#9d174d' },
    iconBg: '#fce7f3',
    iconColor: '#9d174d',
  },
];

export function useSearchShortcut(onOpen) {
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}

export default function SearchModal({ onSelect, onClose }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor]   = useState(0);
  const inputRef              = useRef(null);
  const listRef               = useRef(null);

  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    fetch(`${API}/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => r.json())
      .then(data => { setResults(data); setCursor(0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  // Flatten results for keyboard nav
  const flatItems = results
    ? SECTIONS.flatMap(s => (results[s.key] || []).map(item => ({ ...item, _section: s.key })))
    : [];

  const handleSelect = useCallback((item) => {
    onSelect?.(item);
    onClose?.();
  }, [onSelect, onClose]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { onClose?.(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, flatItems.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === 'Enter' && flatItems[cursor]) { handleSelect(flatItems[cursor]); }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const total = flatItems.length;
  const hasResults = results && total > 0;
  const noResults  = results && total === 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(15,23,42,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 600, maxHeight: '70vh', background: '#fff',
          borderRadius: 14, boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
        }}>
          <span style={{ color: loading ? '#6366f1' : '#94a3b8', flexShrink: 0 }}>
            {Icons.search}
          </span>
          <input
            ref={inputRef}
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 18,
              color: '#1e293b', background: 'transparent', fontFamily: 'inherit',
            }}
            placeholder="Buscar cards, leads, contatos, empresas..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20, lineHeight: 1, padding: 0 }}
            >×</button>
          )}
          <kbd style={{ fontSize: 10, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, padding: '2px 6px', flexShrink: 0 }}>Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto' }}>

          {/* Empty state */}
          {!query.trim() && (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#64748b' }}>Busca global</div>
              <div style={{ fontSize: 12 }}>Digite pelo menos 2 caracteres para buscar</div>
              <div style={{ fontSize: 11, marginTop: 10, color: '#cbd5e1' }}>
                ↑↓ para navegar · Enter para abrir · Esc para fechar
              </div>
            </div>
          )}

          {/* Skeleton loading */}
          {loading && (
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f1f5f9', flexShrink: 0, animation: 'pulse 1.4s ease-in-out infinite' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ height: 12, borderRadius: 4, background: '#f1f5f9', width: `${60 + i * 10}%`, animation: 'pulse 1.4s ease-in-out infinite' }} />
                    <div style={{ height: 10, borderRadius: 4, background: '#f8fafc', width: '40%', animation: 'pulse 1.4s ease-in-out infinite' }} />
                  </div>
                </div>
              ))}
              <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
            </div>
          )}

          {/* No results */}
          {noResults && !loading && (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>😶</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Sem resultados para "{query}"</div>
            </div>
          )}

          {/* Grouped results */}
          {hasResults && !loading && (() => {
            let globalIdx = 0;
            return SECTIONS
              .filter(s => (results[s.key] || []).length > 0)
              .map(section => {
                const items = results[section.key] || [];
                return (
                  <div key={section.key}>
                    {/* Section header */}
                    <div style={{
                      padding: '7px 18px 5px', fontSize: 10, fontWeight: 700, color: '#94a3b8',
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                    }}>
                      <span style={{ color: section.badge.color }}>{section.label}</span>
                      <span style={{
                        marginLeft: 4, background: section.badge.bg, color: section.badge.color,
                        borderRadius: 8, padding: '1px 7px', fontWeight: 700, fontSize: 10,
                      }}>{items.length}</span>
                    </div>

                    {/* Items */}
                    {items.map(item => {
                      const idx = globalIdx++;
                      const active = cursor === idx;
                      return (
                        <div
                          key={`${section.key}-${item.id}`}
                          data-idx={idx}
                          onClick={() => handleSelect({ ...item, _section: section.key })}
                          onMouseEnter={() => setCursor(idx)}
                          style={{
                            padding: '10px 18px', cursor: 'pointer',
                            background: active ? '#f1f5f9' : '#fff',
                            borderBottom: '1px solid #f8fafc',
                            display: 'flex', alignItems: 'center', gap: 12,
                            transition: 'background 0.08s',
                          }}
                        >
                          {/* Icon */}
                          <div style={{
                            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                            background: active ? section.badge.bg : '#f1f5f9',
                            color: active ? section.badge.color : '#64748b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.08s, color 0.08s',
                          }}>
                            {Icons[item.type] || Icons.card}
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <Highlight text={item.title || ''} query={query} />
                            </div>
                            {item.subtitle && (
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <Highlight text={item.subtitle} query={query} />
                              </div>
                            )}
                          </div>

                          {/* Type badge */}
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
                            background: section.badge.bg, color: section.badge.color, flexShrink: 0,
                          }}>
                            {section.label}
                          </span>

                          {/* Arrow */}
                          <span style={{ color: active ? '#6366f1' : '#e2e8f0', fontSize: 14, flexShrink: 0 }}>→</span>
                        </div>
                      );
                    })}
                  </div>
                );
              });
          })()}
        </div>

        {/* Footer */}
        {hasResults && (
          <div style={{
            padding: '8px 18px', borderTop: '1px solid #e2e8f0',
            display: 'flex', gap: 14, alignItems: 'center',
            background: '#f8fafc', fontSize: 10, color: '#94a3b8',
          }}>
            <span>↑↓ navegar</span>
            <span>Enter abrir</span>
            <span>Esc fechar</span>
            <span style={{ marginLeft: 'auto' }}>{total} resultado{total !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}
