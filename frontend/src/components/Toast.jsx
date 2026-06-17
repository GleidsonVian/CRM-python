import React, { useState, useCallback, useRef } from 'react';

let _addToast = null;

export function toast(message, { type = 'success', duration = 3000 } = {}) {
  _addToast?.({ message, type, duration });
}

const ICONS = {
  success: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5 8.5l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 7v5M8 5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
};

const STYLES = {
  success: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  error:   { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  info:    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  _addToast = useCallback(({ message, type, duration }) => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, message, type, visible: true }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
    }, duration);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: 10,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const s = STYLES[t.type] || STYLES.info;
        return (
          <div
            key={t.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 16px',
              background: '#fff',
              border: `1px solid ${s.border}`,
              borderLeft: `4px solid ${s.color}`,
              borderRadius: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              minWidth: 240, maxWidth: 360,
              fontSize: 13.5, fontWeight: 500, color: '#1e293b',
              transform: t.visible ? 'translateY(0)' : 'translateY(16px)',
              opacity: t.visible ? 1 : 0,
              transition: 'opacity 0.3s ease, transform 0.3s ease',
              pointerEvents: 'auto',
            }}
          >
            <span style={{ color: s.color, flexShrink: 0 }}>{ICONS[t.type]}</span>
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
