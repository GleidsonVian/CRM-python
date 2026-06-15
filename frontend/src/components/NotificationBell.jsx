import React, { useState, useEffect, useRef, useCallback } from 'react';

const API = 'http://localhost:8001';

const SEV = {
  danger:  { bg: '#fef2f2', border: '#fecaca', icon: '🔴', color: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '🟡', color: '#d97706' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', icon: '🔵', color: '#2563eb' },
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
  const panelRef = useRef(null);
  const fetchRef = useRef(null);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(`${API}/notifications`).then(r => r.json());
      setItems(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  // Fetch on open; also poll every 60 s while open
  useEffect(() => {
    if (!open) return;
    fetchNotifs();
    fetchRef.current = setInterval(fetchNotifs, 60000);
    return () => clearInterval(fetchRef.current);
  }, [open, fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
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
  };

  const visible = items.filter(n => !dismissed.has(n.id));
  const count   = visible.length;

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Notificações"
        style={{
          position: 'relative', background: open ? '#eef2ff' : 'none',
          border: `1px solid ${open ? '#c7d2fe' : 'transparent'}`,
          borderRadius: 8, cursor: 'pointer', padding: '5px 8px',
          display: 'flex', alignItems: 'center', color: open ? '#6366f1' : '#64748b',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = '#f1f5f9'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'none'; }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6v2.5l-1 2h11l-1-2V6A4.5 4.5 0 0 0 8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          <path d="M6.5 10.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        {count > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: '#ef4444', color: '#fff',
            fontSize: 9, fontWeight: 700, borderRadius: '50%',
            width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, pointerEvents: 'none',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 360, maxHeight: 480, overflowY: 'auto',
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 9999,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Notificações</span>
              {count > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 7px' }}>
                  {count}
                </span>
              )}
            </div>
            {count > 0 && (
              <button onClick={clearAll} style={{
                fontSize: 11, color: '#6366f1', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, padding: 0,
              }}>
                Limpar tudo
              </button>
            )}
          </div>

          {/* Body */}
          {loading && items.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
              Carregando...
            </div>
          ) : visible.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>Nenhuma notificação</div>
            </div>
          ) : (
            <div>
              {visible.map(n => {
                const s = SEV[n.severity] || SEV.info;
                return (
                  <div
                    key={n.id}
                    onClick={() => { if (n.card_id) { onNavigateToCard?.(n.card_id); setOpen(false); } }}
                    style={{
                      display: 'flex', gap: 10, padding: '11px 16px',
                      borderBottom: '1px solid #f8fafc', cursor: n.card_id ? 'pointer' : 'default',
                      transition: 'background 0.1s',
                      background: '#fff',
                    }}
                    onMouseEnter={e => { if (n.card_id) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    {/* Severity dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: s.color, flexShrink: 0, marginTop: 5,
                    }} />

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: s.color,
                          background: s.bg, border: `1px solid ${s.border}`,
                          borderRadius: 4, padding: '1px 6px', flexShrink: 0,
                        }}>
                          {n.type === 'overdue_task'  ? 'Tarefa vencida' :
                           n.type === 'stalled_card'  ? 'Negócio parado' :
                           'Menção'}
                        </span>
                        <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 'auto', flexShrink: 0 }}>
                          {relTime(n.created_at)}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.body}
                      </div>
                      {n.card_id && (
                        <div style={{ fontSize: 11, color: '#6366f1', marginTop: 2 }}>
                          Abrir negócio #{n.card_id} →
                        </div>
                      )}
                    </div>

                    {/* Dismiss */}
                    <button
                      onClick={(e) => dismiss(n.id, e)}
                      title="Dispensar"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#cbd5e1', fontSize: 14, padding: '0 2px', flexShrink: 0,
                        lineHeight: 1, alignSelf: 'flex-start', marginTop: 1,
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                      onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
