import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { API_URL as API } from '../config.js';

/* ─── formatters ─────────────────────────────────────────────────────────── */
const fmt = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso.includes('+') || iso.endsWith('Z') ? iso : iso + 'Z');
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(d);
};

const avatarColor = (name) => {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

/* ─── source badge colours ───────────────────────────────────────────────── */
const SOURCE_COLORS = {
  Chamada:   { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  Email:     { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
  Site:      { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Indicação: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
};
const SOURCE_DEFAULT = { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' };

/* ─── column definitions ─────────────────────────────────────────────────── */
const ALL_COLS = [
  { key: 'title',      label: 'Título',       sortField: 'title',      fixed: true  },
  { key: 'stage',      label: 'Etapa',        sortField: null,         fixed: false },
  { key: 'price',      label: 'Valor',        sortField: 'price',      fixed: false },
  { key: 'source',     label: 'Fonte',        sortField: null,         fixed: false },
  { key: 'contacts',   label: 'Contatos',     sortField: null,         fixed: false },
  { key: 'users',      label: 'Responsáveis', sortField: null,         fixed: false },
  { key: 'created_at', label: 'Criado em',    sortField: 'created_at', fixed: false },
  { key: 'updated_at', label: 'Modificado',   sortField: null,         fixed: false },
];
const COL_MAP = Object.fromEntries(ALL_COLS.map(c => [c.key, c]));

const LS_COLS    = 'nexus_lv_cols';
const LS_WIDTHS  = 'nexus_lv_widths';
const DEFAULT_ORDER  = ALL_COLS.map(c => c.key);
const DEFAULT_HIDDEN = [];
const DEFAULT_WIDTHS = {
  title: 240, stage: 130, price: 110, source: 110,
  contacts: 160, users: 180, created_at: 110, updated_at: 110,
};

function loadColConfig() {
  try {
    const raw = localStorage.getItem(LS_COLS);
    if (raw) {
      const parsed = JSON.parse(raw);
      // ensure all keys are present
      const order = parsed.order?.filter(k => COL_MAP[k]) ?? DEFAULT_ORDER;
      // add any missing keys at the end
      DEFAULT_ORDER.forEach(k => { if (!order.includes(k)) order.push(k); });
      return { order, hidden: parsed.hidden ?? DEFAULT_HIDDEN };
    }
  } catch (_) {}
  return { order: [...DEFAULT_ORDER], hidden: [...DEFAULT_HIDDEN] };
}

function loadWidths() {
  try {
    const raw = localStorage.getItem(LS_WIDTHS);
    if (raw) return { ...DEFAULT_WIDTHS, ...JSON.parse(raw) };
  } catch (_) {}
  return { ...DEFAULT_WIDTHS };
}

/* ─── icons ──────────────────────────────────────────────────────────────── */
const IconDownload = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M6.5 1v8M3.5 6.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1.5 11.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const IconFilter = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M1.5 3h10M3.5 6.5h6M5.5 10h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const IconColumns = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <rect x="1" y="2" width="3" height="9" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    <rect x="5" y="2" width="3" height="9" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    <rect x="9" y="2" width="3" height="9" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const IconDrag = () => (
  <svg width="10" height="14" viewBox="0 0 10 14" fill="none" style={{ cursor: 'grab', flexShrink: 0 }}>
    <circle cx="3" cy="3"  r="1.2" fill="currentColor" />
    <circle cx="7" cy="3"  r="1.2" fill="currentColor" />
    <circle cx="3" cy="7"  r="1.2" fill="currentColor" />
    <circle cx="7" cy="7"  r="1.2" fill="currentColor" />
    <circle cx="3" cy="11" r="1.2" fill="currentColor" />
    <circle cx="7" cy="11" r="1.2" fill="currentColor" />
  </svg>
);

/* ─── main component ─────────────────────────────────────────────────────── */
export default function ListView({ cards, stages, onClickCard, onUpdateCard, selectedCardIds, onSelectCard, onSelectAll, onDeselectAll, bulkToolbar }) {
  /* filter / sort state */
  const [filterStage, setFilterStage]     = useState('');
  const [filterUser, setFilterUser]       = useState('');
  const [filterMinVal, setFilterMinVal]   = useState('');
  const [filterMaxVal, setFilterMaxVal]   = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]   = useState('');
  const [sortField, setSortField]         = useState('created_at');
  const [sortDir, setSortDir]             = useState('desc');
  const [showFilters, setShowFilters]     = useState(false);
  const [search, setSearch]               = useState('');

  /* column config */
  const [colConfig, setColConfig]   = useState(loadColConfig);
  const [colWidths, setColWidths]   = useState(loadWidths);
  const [showColPanel, setShowColPanel] = useState(false);
  const colPanelRef = useRef(null);

  /* resize state (not persisted to state to avoid re-renders) */
  const resizeRef = useRef(null);

  /* inline edit state */
  const [editState, setEditState]   = useState(null); // { cardId, field }
  const [editValue, setEditValue]   = useState('');
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState(false);

  /* click vs dblclick */
  const clickTimerRef = useRef(null);

  /* drag for column reorder */
  const dragSrcRef = useRef(null);

  /* ── derive helpers ──────────────────────────────────────────────────── */
  const allUsers = useMemo(() => {
    const map = new Map();
    cards.forEach(c => (c.users || []).forEach(u => map.set(u.id, u)));
    return [...map.values()];
  }, [cards]);

  const stageMap = useMemo(() => {
    const m = {};
    stages.forEach(s => (m[s.id] = s));
    return m;
  }, [stages]);

  /* visible columns in order */
  const visibleCols = useMemo(() => {
    return colConfig.order
      .filter(k => !colConfig.hidden.includes(k))
      .map(k => COL_MAP[k])
      .filter(Boolean);
  }, [colConfig]);

  /* ── persist column config ───────────────────────────────────────────── */
  useEffect(() => {
    localStorage.setItem(LS_COLS, JSON.stringify(colConfig));
  }, [colConfig]);

  useEffect(() => {
    localStorage.setItem(LS_WIDTHS, JSON.stringify(colWidths));
  }, [colWidths]);

  /* ── close col panel on outside click ───────────────────────────────── */
  useEffect(() => {
    if (!showColPanel) return;
    const handler = (e) => {
      if (colPanelRef.current && !colPanelRef.current.contains(e.target)) {
        setShowColPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColPanel]);

  /* ── column resize ───────────────────────────────────────────────────── */
  useEffect(() => {
    const onMove = (e) => {
      if (!resizeRef.current) return;
      const { col, startX, startW } = resizeRef.current;
      const delta = e.clientX - startX;
      const newW = Math.max(80, startW + delta);
      setColWidths(prev => ({ ...prev, [col]: newW }));
    };
    const onUp = () => { resizeRef.current = null; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  /* ── filtered + sorted data ──────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = [...cards];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.title?.toLowerCase().includes(q) ||
        (c.contacts || []).some(ct => `${ct.first_name} ${ct.last_name || ''}`.toLowerCase().includes(q))
      );
    }
    if (filterStage)   list = list.filter(c => c.stage_id === parseInt(filterStage));
    if (filterUser)    list = list.filter(c => (c.users || []).some(u => u.id === parseInt(filterUser)));
    if (filterMinVal !== '') list = list.filter(c => (c.price || 0) >= parseFloat(filterMinVal));
    if (filterMaxVal !== '') list = list.filter(c => (c.price || 0) <= parseFloat(filterMaxVal));
    if (filterDateFrom) list = list.filter(c => c.created_at && c.created_at >= filterDateFrom);
    if (filterDateTo)   list = list.filter(c => c.created_at && c.created_at.slice(0, 10) <= filterDateTo);

    list.sort((a, b) => {
      let va = a[sortField] ?? '';
      let vb = b[sortField] ?? '';
      if (sortField === 'price') { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [cards, search, filterStage, filterUser, filterMinVal, filterMaxVal, filterDateFrom, filterDateTo, sortField, sortDir]);

  const totalValue = filtered.reduce((s, c) => s + (c.price || 0), 0);

  /* ── handlers ────────────────────────────────────────────────────────── */
  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleExportCSV = () => {
    const header = ['ID', 'Título', 'Etapa', 'Valor', 'Fonte', 'Contatos', 'Responsáveis', 'Criado em', 'Modificado'];
    const rows = filtered.map(c => [
      c.id,
      `"${(c.title || '').replace(/"/g, '""')}"`,
      `"${stageMap[c.stage_id]?.name || ''}"`,
      (c.price || 0).toFixed(2).replace('.', ','),
      `"${c.source || ''}"`,
      `"${(c.contacts || []).map(ct => `${ct.first_name} ${ct.last_name || ''}`.trim()).join('; ')}"`,
      `"${(c.users || []).map(u => u.name).join('; ')}"`,
      fmtDate(c.created_at),
      fmtDate(c.updated_at),
    ]);
    const csv = [header, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'negocios.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  /* single vs double click */
  const handleCellClick = useCallback((card, field) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      // double click → enter edit mode
      const val = field === 'price' ? (card.price ?? '') : card.stage_id;
      setEditState({ cardId: card.id, field });
      setEditValue(String(val ?? ''));
      setSaveError(false);
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        onClickCard(card);
      }, 200);
    }
  }, [onClickCard]);

  const cancelEdit = () => {
    setEditState(null);
    setEditValue('');
    setSaveError(false);
  };

  const commitEdit = async (card) => {
    if (!editState) return;
    setSaving(true);
    setSaveError(false);
    try {
      const body = {
        ...card,
        price:    editState.field === 'price'
                    ? (editValue === '' ? null : parseFloat(editValue))
                    : card.price,
        stage_id: editState.field === 'stage'
                    ? parseInt(editValue)
                    : card.stage_id,
      };
      const res = await fetch(`${API}/cards/${card.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');
      const updated = await res.json();
      onUpdateCard?.(updated);
      setEditState(null);
      setEditValue('');
    } catch (_) {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  /* column config panel helpers */
  const toggleHidden = (key) => {
    setColConfig(prev => {
      const hidden = prev.hidden.includes(key)
        ? prev.hidden.filter(k => k !== key)
        : [...prev.hidden, key];
      return { ...prev, hidden };
    });
  };

  const handleDragStart = (key) => { dragSrcRef.current = key; };
  const handleDrop = (targetKey) => {
    const src = dragSrcRef.current;
    if (!src || src === targetKey) return;
    setColConfig(prev => {
      const order = [...prev.order];
      const si = order.indexOf(src);
      const ti = order.indexOf(targetKey);
      order.splice(si, 1);
      order.splice(ti, 0, src);
      return { ...prev, order };
    });
    dragSrcRef.current = null;
  };

  /* ── sub-components ──────────────────────────────────────────────────── */
  const SortArrow = ({ field }) => {
    if (sortField !== field) return <span style={{ opacity: 0.25, marginLeft: 3 }}>↕</span>;
    return <span style={{ marginLeft: 3, color: 'var(--accent)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const activeFilterCount = [filterStage, filterUser, filterMinVal, filterMaxVal, filterDateFrom, filterDateTo].filter(Boolean).length;

  /* ── cell renderers ──────────────────────────────────────────────────── */
  const renderCell = (col, card, rowIdx) => {
    const isEditing = editState?.cardId === card.id && editState?.field === col.key;
    const editBg = saveError ? '#fef2f2' : '#fffbeb';
    const editOutline = saveError ? '2px solid #ef4444' : '2px solid #f59e0b';

    switch (col.key) {
      case 'title': {
        const stage = stageMap[card.stage_id];
        return (
          <td
            key="title"
            style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid #f1f5f9', width: colWidths.title }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: stage?.color || '#94a3b8', flexShrink: 0 }} />
              {card.title}
            </div>
          </td>
        );
      }

      case 'stage': {
        const stage = stageMap[card.stage_id];
        if (isEditing) {
          return (
            <td key="stage" style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', width: colWidths.stage, background: editBg }}>
              {saving ? (
                <span style={{ opacity: 0.6, fontSize: 14 }}>Salvando…</span>
              ) : (
                <select
                  autoFocus
                  value={editValue}
                  onChange={e => { setEditValue(e.target.value); commitEdit({ ...card }); }}
                  onBlur={() => cancelEdit()}
                  onKeyDown={e => e.key === 'Escape' && cancelEdit()}
                  style={{ fontSize: 14, outline: editOutline, borderRadius: 4, border: 'none', background: 'transparent', width: '100%' }}
                  onClick={e => e.stopPropagation()}
                >
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </td>
          );
        }
        return (
          <td
            key="stage"
            style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', width: colWidths.stage }}
            onDoubleClick={e => { e.stopPropagation(); handleCellClick(card, 'stage'); }}
            onClick={e => e.stopPropagation()}
          >
            {stage ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: stage.color + '18', color: stage.color,
                border: `1px solid ${stage.color}40`,
                borderRadius: 20, padding: '2px 8px', fontSize: 13, fontWeight: 600, cursor: 'default'
              }}>
                {stage.name}
              </span>
            ) : '—'}
          </td>
        );
      }

      case 'price': {
        if (isEditing) {
          return (
            <td key="price" style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', width: colWidths.price, background: editBg }}>
              {saving ? (
                <span style={{ opacity: 0.6, fontSize: 14 }}>Salvando…</span>
              ) : (
                <input
                  autoFocus
                  type="number"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(card)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit(card);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%', fontSize: 14, outline: editOutline,
                    border: 'none', borderRadius: 4, background: 'transparent',
                    padding: '2px 4px'
                  }}
                />
              )}
            </td>
          );
        }
        return (
          <td
            key="price"
            style={{ padding: '10px 14px', fontWeight: 700, color: (card.price || 0) > 0 ? 'var(--accent)' : 'var(--text-muted)', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', width: colWidths.price }}
            onDoubleClick={e => { e.stopPropagation(); handleCellClick(card, 'price'); }}
            onClick={e => e.stopPropagation()}
          >
            {(card.price || 0) > 0 ? fmt(card.price) : '—'}
          </td>
        );
      }

      case 'source': {
        const sc = SOURCE_COLORS[card.source] || SOURCE_DEFAULT;
        return (
          <td key="source" style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', width: colWidths.source }}>
            {card.source ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                background: sc.bg, color: sc.color,
                border: `1px solid ${sc.border}`,
                borderRadius: 20, padding: '2px 8px', fontSize: 13, fontWeight: 600
              }}>
                {card.source}
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>—</span>
            )}
          </td>
        );
      }

      case 'contacts': {
        const contacts = card.contacts || [];
        return (
          <td key="contacts" style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', width: colWidths.contacts }}>
            {contacts.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>—</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {contacts.slice(0, 2).map(c => (
                  <span key={c.id} style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                    {c.first_name} {c.last_name || ''}
                  </span>
                ))}
                {contacts.length > 2 && (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>+{contacts.length - 2} mais</span>
                )}
              </div>
            )}
          </td>
        );
      }

      case 'users': {
        const users = card.users || [];
        return (
          <td key="users" style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', width: colWidths.users }}>
            {users.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>—</span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {users.slice(0, 4).map(u => {
                  const initials = u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                  return (
                    <div
                      key={u.id}
                      title={u.name}
                      style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: avatarColor(u.name), color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                        marginLeft: -4, border: '2px solid white'
                      }}
                    >
                      {initials}
                    </div>
                  );
                })}
                {users.length > 4 && (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>+{users.length - 4}</span>
                )}
                <span style={{ fontSize: 14, color: 'var(--text-secondary)', marginLeft: 6 }}>
                  {users[0]?.name}{users.length > 1 ? ` +${users.length - 1}` : ''}
                </span>
              </div>
            )}
          </td>
        );
      }

      case 'created_at':
        return (
          <td key="created_at" style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 14, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', width: colWidths.created_at }}>
            {fmtDate(card.created_at)}
          </td>
        );

      case 'updated_at':
        return (
          <td key="updated_at" style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 14, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', width: colWidths.updated_at }}>
            {fmtDate(card.updated_at)}
          </td>
        );

      default:
        return <td key={col.key} style={{ borderBottom: '1px solid #f1f5f9' }} />;
    }
  };

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
        borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0
      }}>
        <input
          className="search-input"
          placeholder="Buscar negócios ou contatos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 260 }}
        />

        <button
          className={`btn ${showFilters ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={() => setShowFilters(v => !v)}
        >
          <IconFilter />
          Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>

        {activeFilterCount > 0 && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 14, color: '#ef4444' }}
            onClick={() => {
              setFilterStage(''); setFilterUser(''); setFilterMinVal('');
              setFilterMaxVal(''); setFilterDateFrom(''); setFilterDateTo('');
            }}
          >
            Limpar filtros
          </button>
        )}

        {/* Columns button */}
        <div style={{ position: 'relative' }} ref={colPanelRef}>
          <button
            className={`btn ${showColPanel ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={() => setShowColPanel(v => !v)}
          >
            <IconColumns />
            Colunas
          </button>

          {showColPanel && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              minWidth: 220, padding: '8px 0', userSelect: 'none'
            }}>
              <div style={{ padding: '4px 14px 8px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Visibilidade e ordem
              </div>
              {colConfig.order.map(key => {
                const col = COL_MAP[key];
                if (!col) return null;
                const isHidden = colConfig.hidden.includes(key);
                return (
                  <div
                    key={key}
                    draggable={!col.fixed}
                    onDragStart={() => !col.fixed && handleDragStart(key)}
                    onDragOver={e => { e.preventDefault(); }}
                    onDrop={() => !col.fixed && handleDrop(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 14px', cursor: 'default',
                      opacity: dragSrcRef.current === key ? 0.5 : 1,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover, #f1f5f9)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {col.fixed ? (
                      <div style={{ width: 10, flexShrink: 0 }} />
                    ) : (
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        <IconDrag />
                      </span>
                    )}
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      disabled={col.fixed}
                      onChange={() => !col.fixed && toggleHidden(key)}
                      style={{ cursor: col.fixed ? 'not-allowed' : 'pointer', accentColor: 'var(--accent)', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 15, color: col.fixed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      {col.label}
                    </span>
                    {col.fixed && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>fixo</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {filtered.length} negócio{filtered.length !== 1 ? 's' : ''} · <strong style={{ color: 'var(--accent)' }}>{fmt(totalValue)}</strong>
          </span>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={handleExportCSV}
          >
            <IconDownload /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 20px',
          borderBottom: '1px solid var(--border)', background: '#f8fafc', flexShrink: 0
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Etapa</label>
            <select className="form-select" style={{ fontSize: 14, height: 30, padding: '0 8px', minWidth: 140 }} value={filterStage} onChange={e => setFilterStage(e.target.value)}>
              <option value="">Todas</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsável</label>
            <select className="form-select" style={{ fontSize: 14, height: 30, padding: '0 8px', minWidth: 150 }} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="">Todos</option>
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor mínimo</label>
            <input
              type="number" placeholder="R$ 0"
              className="form-input" style={{ fontSize: 14, height: 30, padding: '0 8px', width: 110 }}
              value={filterMinVal} onChange={e => setFilterMinVal(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor máximo</label>
            <input
              type="number" placeholder="Sem limite"
              className="form-input" style={{ fontSize: 14, height: 30, padding: '0 8px', width: 110 }}
              value={filterMaxVal} onChange={e => setFilterMaxVal(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>De</label>
            <input
              type="date"
              className="form-input" style={{ fontSize: 14, height: 30, padding: '0 8px', width: 130 }}
              value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Até</label>
            <input
              type="date"
              className="form-input" style={{ fontSize: 14, height: 30, padding: '0 8px', width: 130 }}
              value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, tableLayout: 'fixed' }}>
          <colgroup>
            {onSelectCard && <col style={{ width: 40 }} />}
            {visibleCols.map(col => (
              <col key={col.key} style={{ width: colWidths[col.key] || 120 }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 2 }}>
              {onSelectCard && (() => {
                const allSel = filtered.length > 0 && filtered.every(c => selectedCardIds?.has(c.id));
                const someSel = !allSel && filtered.some(c => selectedCardIds?.has(c.id));
                return (
                  <th style={{ width: 40, padding: '9px 0 9px 14px', borderBottom: '1px solid var(--border)' }}>
                    <input
                      type="checkbox"
                      checked={allSel}
                      ref={el => { if (el) el.indeterminate = someSel; }}
                      onChange={() => {
                        if (allSel) onDeselectAll?.(filtered);
                        else onSelectAll?.(filtered);
                      }}
                      style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 14, height: 14 }}
                    />
                  </th>
                );
              })()}
              {visibleCols.map(col => (
                <th
                  key={col.key}
                  onClick={col.sortField ? () => toggleSort(col.sortField) : undefined}
                  style={{
                    position: 'relative',
                    padding: '9px 14px', textAlign: 'left',
                    fontWeight: 600, fontSize: 13, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)',
                    cursor: col.sortField ? 'pointer' : 'default',
                    userSelect: 'none', whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {col.label}
                  {col.sortField && <SortArrow field={col.sortField} />}
                  {/* resize handle */}
                  <div
                    onMouseDown={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      resizeRef.current = {
                        col: col.key,
                        startX: e.clientX,
                        startW: colWidths[col.key] || 120,
                      };
                    }}
                    style={{
                      position: 'absolute', right: 0, top: 0, bottom: 0, width: 4,
                      cursor: 'col-resize', background: 'transparent',
                      zIndex: 1,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--accent, #10b981)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length + (onSelectCard ? 1 : 0)} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 16 }}>
                  Nenhum negócio encontrado para os filtros aplicados.
                </td>
              </tr>
            ) : filtered.map((card, i) => {
              const isSelected = selectedCardIds?.has(card.id);
              return (
                <tr
                  key={card.id}
                  onClick={() => {
                    if (onSelectCard && !editState) {
                      onSelectCard(card);
                      return;
                    }
                    if (!editState) {
                      if (clickTimerRef.current) {
                        clearTimeout(clickTimerRef.current);
                        clickTimerRef.current = null;
                      } else {
                        clickTimerRef.current = setTimeout(() => {
                          clickTimerRef.current = null;
                          onClickCard(card);
                        }, 200);
                      }
                    }
                  }}
                  onDoubleClick={() => !editState && onClickCard(card)}
                  style={{
                    background: isSelected ? '#eef2ff' : i % 2 === 0 ? 'white' : '#fafafa',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                    outline: isSelected ? '1px solid #6366f130' : 'none',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f0fdf4'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa'; }}
                >
                  {onSelectCard && (
                    <td style={{ width: 40, padding: '10px 0 10px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}
                      onClick={e => { e.stopPropagation(); onSelectCard(card); }}>
                      <input
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={() => onSelectCard(card)}
                        style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 14, height: 14 }}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                  )}
                  {visibleCols.map(col => renderCell(col, card, i))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer totals */}
        {filtered.length > 0 && (
          <div style={{
            padding: '10px 14px', borderTop: '2px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 20,
            fontSize: 14, color: 'var(--text-muted)', background: '#f8fafc',
            position: 'sticky', bottom: 0
          }}>
            <span><strong>{filtered.length}</strong> negócios</span>
            <span>Total: <strong style={{ color: 'var(--accent)' }}>{fmt(totalValue)}</strong></span>
            <span>Média: <strong>{fmt(totalValue / filtered.length)}</strong></span>
          </div>
        )}
      </div>

      {/* Bulk toolbar — rendered at the bottom when items are selected */}
      {bulkToolbar}
    </div>
  );
}
