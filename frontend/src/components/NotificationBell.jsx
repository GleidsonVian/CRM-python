import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL as API } from '../config.js';

const SEV = {
  danger:  { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', label: 'Urgente' },
  warning: { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', label: 'Atenção' },
  info:    { color: '#6366f1', bg: '#eff6ff', border: '#c7d2fe', label: 'Info' },
};

const TYPE_LABEL = {
  overdue_task: 'Tarefa vencida',
  stalled_card: 'Negócio parado',
  mention:      'Menção',
};

const relTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
  const diff = Math.floor((Date.now() - d) / 60000);
  if (diff < 1) return 'agora';
  if (diff < 60) return `há ${diff}min`;
  if (diff < 1440) return `há ${Math.floor(diff / 60)}h`;
  return `há ${Math.floor(diff / 1440)}d`;
};

export default function NotificationBell({ onNavigateToCard }) {
  const [open, setOpen]           = useState(false);
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('nexus_dismissed_notifs') || '[]')); }
    catch { return new Set(); }
  });
  const wrapRef = useRef(null);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('nexus_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const data = await fetch(`${API}/notifications`, { headers }).then(r => r.json());
      setItems(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchNotifs();
    const t = setInterval(fetchNotifs, 60000);
    return () => clearInterval(t);
  }, [open, fetchNotifs]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const dismiss = (id, e) => {
    e.stopPropagation();
    const next = new Set([...dismissed, id]);
    setDismissed(next);
    localStorage.setItem('nexus_dismissed_notifs', JSON.stringify([...next]));
  };

  const clearAll = () => {
    const next = new Set(items.map(n => n.id));
    setDismissed(next);
    localStorage.setItem('nexus_dismissed_notifs', JSON.stringify([...next]));
    setOpen(false);
  };

  const visible = items.filter(n => !dismissed.has(n.id));
  const count   = visible.length;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Nav-item style button — matches sidebar items */}
      <div
        onClick={() => setOpen(v => !v)}
        className={`nav-item${open ? ' active' : ''}`}
        style={{ justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6v2.5l-1 2h11l-1-2V6A4.5 4.5 0 0 0 8 1.5Z"
              stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M6.5 10.5a1.5 1.5 0 0 0 3 0"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Notificações
        </div>
        {count > 0 && (
          <span style={{
            background: '#ef4444', color: '#fff',
            fontSize: 10, fontWeight: 700, borderRadius: 10,
            padding: '1px 6px', lineHeight: 1.4,
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </div>

      {/* Dropdown — opens upward to the right of sidebar */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 60,
          left: 'var(--sidebar-width)',
          marginLeft: 8,
          width: 380,
          maxHeight: 520,
          overflowY: 'auto',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          zIndex: 9999,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 16px', borderBottom: '1px solid #f1f5f9',
            position: 'sticky', top: 0, background: '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Notificações</span>
              {count > 0 && (
                <span style={{
                  background: '#ef4444', color: '#fff',
                  fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 7px',
                }}>
                  {count}
                </span>
              )}
            </div>
            {count > 0 && (
              <button onClick={clearAll} style={{
                fontSize: 12, color: '#6366f1', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
              }}>
                Limpar tudo
              </button>
            )}
          </div>

          {/* Body */}
          {loading && items.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
              Carregando...
            </div>
          ) : visible.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>Tudo em dia!</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>Nenhuma notificação pendente</div>
            </div>
          ) : (
            visible.map(n => {
              const s = SEV[n.severity] || SEV.info;
              return (
                <div
                  key={n.id}
                  onClick={() => { if (n.card_id) { onNavigateToCard?.(n.card_id); setOpen(false); } }}
                  style={{
                    display: 'flex', gap: 12, padding: '12px 16px',
                    borderBottom: '1px solid #f8fafc',
                    cursor: n.card_id ? 'pointer' : 'default',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (n.card_id) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: s.bg, border: `1px solid ${s.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                  }}>
                    {n.type === 'overdue_task' ? '⏰' : n.type === 'stalled_card' ? '⚠️' : '💬'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: s.color,
                        background: s.bg, border: `1px solid ${s.border}`,
                        borderRadius: 4, padding: '1px 6px',
                      }}>
                        {TYPE_LABEL[n.type] || n.type}
                      </span>
                      <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                        {relTime(n.created_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.45 }}>
                      {n.body}
                    </div>
                    {n.card_id && (
                      <div style={{ fontSize: 11.5, color: '#6366f1', marginTop: 3, fontWeight: 500 }}>
                        Abrir negócio →
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => dismiss(n.id, e)}
                    title="Dispensar"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#cbd5e1', fontSize: 16, padding: '0 2px',
                      flexShrink: 0, alignSelf: 'flex-start', lineHeight: 1,
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
                    onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
