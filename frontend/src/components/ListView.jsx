import React, { useState, useMemo } from 'react';

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

const SORT_FIELDS = { title: 'Título', price: 'Valor', created_at: 'Data' };

export default function ListView({ cards, stages, onClickCard }) {
  const [filterStage, setFilterStage] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterMinVal, setFilterMinVal] = useState('');
  const [filterMaxVal, setFilterMaxVal] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');

  // derive unique users from all cards
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

  const filtered = useMemo(() => {
    let list = [...cards];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.title?.toLowerCase().includes(q) ||
        (c.contacts || []).some(ct => `${ct.first_name} ${ct.last_name || ''}`.toLowerCase().includes(q))
      );
    }
    if (filterStage) list = list.filter(c => c.stage_id === parseInt(filterStage));
    if (filterUser) list = list.filter(c => (c.users || []).some(u => u.id === parseInt(filterUser)));
    if (filterMinVal !== '') list = list.filter(c => (c.price || 0) >= parseFloat(filterMinVal));
    if (filterMaxVal !== '') list = list.filter(c => (c.price || 0) <= parseFloat(filterMaxVal));
    if (filterDateFrom) list = list.filter(c => c.created_at && c.created_at >= filterDateFrom);
    if (filterDateTo) list = list.filter(c => c.created_at && c.created_at.slice(0, 10) <= filterDateTo);

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

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleExportCSV = () => {
    const header = ['ID', 'Título', 'Etapa', 'Valor', 'Contatos', 'Responsáveis', 'Criado em'];
    const rows = filtered.map(c => [
      c.id,
      `"${(c.title || '').replace(/"/g, '""')}"`,
      `"${stageMap[c.stage_id]?.name || ''}"`,
      (c.price || 0).toFixed(2).replace('.', ','),
      `"${(c.contacts || []).map(ct => `${ct.first_name} ${ct.last_name || ''}`.trim()).join('; ')}"`,
      `"${(c.users || []).map(u => u.name).join('; ')}"`,
      fmtDate(c.created_at),
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

  const activeFilterCount = [filterStage, filterUser, filterMinVal, filterMaxVal, filterDateFrom, filterDateTo].filter(Boolean).length;

  const SortArrow = ({ field }) => {
    if (sortField !== field) return <span style={{ opacity: 0.25, marginLeft: 3 }}>↕</span>;
    return <span style={{ marginLeft: 3, color: 'var(--accent)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

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
          style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={() => setShowFilters(v => !v)}
        >
          <IconFilter />
          Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>

        {activeFilterCount > 0 && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, color: '#ef4444' }}
            onClick={() => { setFilterStage(''); setFilterUser(''); setFilterMinVal(''); setFilterMaxVal(''); setFilterDateFrom(''); setFilterDateTo(''); }}
          >
            Limpar filtros
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {filtered.length} negócio{filtered.length !== 1 ? 's' : ''} · <strong style={{ color: 'var(--accent)' }}>{fmt(totalValue)}</strong>
          </span>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
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
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Etapa</label>
            <select className="form-select" style={{ fontSize: 12, height: 30, padding: '0 8px', minWidth: 140 }} value={filterStage} onChange={e => setFilterStage(e.target.value)}>
              <option value="">Todas</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsável</label>
            <select className="form-select" style={{ fontSize: 12, height: 30, padding: '0 8px', minWidth: 150 }} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="">Todos</option>
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor mínimo</label>
            <input
              type="number" placeholder="R$ 0"
              className="form-input" style={{ fontSize: 12, height: 30, padding: '0 8px', width: 110 }}
              value={filterMinVal} onChange={e => setFilterMinVal(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor máximo</label>
            <input
              type="number" placeholder="Sem limite"
              className="form-input" style={{ fontSize: 12, height: 30, padding: '0 8px', width: 110 }}
              value={filterMaxVal} onChange={e => setFilterMaxVal(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>De</label>
            <input
              type="date"
              className="form-input" style={{ fontSize: 12, height: 30, padding: '0 8px', width: 130 }}
              value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Até</label>
            <input
              type="date"
              className="form-input" style={{ fontSize: 12, height: 30, padding: '0 8px', width: 130 }}
              value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 2 }}>
              {[
                { label: 'Título', field: 'title', w: '26%' },
                { label: 'Etapa', field: null, w: '14%' },
                { label: 'Valor', field: 'price', w: '11%' },
                { label: 'Contatos', field: null, w: '18%' },
                { label: 'Responsáveis', field: null, w: '18%' },
                { label: 'Criado em', field: 'created_at', w: '13%' },
              ].map(col => (
                <th
                  key={col.label}
                  onClick={col.field ? () => toggleSort(col.field) : undefined}
                  style={{
                    width: col.w, padding: '9px 14px', textAlign: 'left',
                    fontWeight: 600, fontSize: 11, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)',
                    cursor: col.field ? 'pointer' : 'default',
                    userSelect: 'none', whiteSpace: 'nowrap'
                  }}
                >
                  {col.label}
                  {col.field && <SortArrow field={col.field} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                  Nenhum negócio encontrado para os filtros aplicados.
                </td>
              </tr>
            ) : filtered.map((card, i) => {
              const stage = stageMap[card.stage_id];
              const contacts = card.contacts || [];
              const users = card.users || [];

              return (
                <tr
                  key={card.id}
                  onClick={() => onClickCard(card)}
                  style={{
                    background: i % 2 === 0 ? 'white' : '#fafafa',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa'}
                >
                  {/* Título */}
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: stage?.color || '#94a3b8', flexShrink: 0
                      }} />
                      {card.title}
                    </div>
                  </td>

                  {/* Etapa */}
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                    {stage ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: stage.color + '18', color: stage.color,
                        border: `1px solid ${stage.color}40`,
                        borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600
                      }}>
                        {stage.name}
                      </span>
                    ) : '—'}
                  </td>

                  {/* Valor */}
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: (card.price || 0) > 0 ? 'var(--accent)' : 'var(--text-muted)', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                    {(card.price || 0) > 0 ? fmt(card.price) : '—'}
                  </td>

                  {/* Contatos */}
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                    {contacts.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {contacts.slice(0, 2).map(c => (
                          <span key={c.id} style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                            {c.first_name} {c.last_name || ''}
                          </span>
                        ))}
                        {contacts.length > 2 && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{contacts.length - 2} mais</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Responsáveis */}
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                    {users.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
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
                                fontSize: 9, fontWeight: 700, flexShrink: 0,
                                marginLeft: -4, border: '2px solid white'
                              }}
                            >
                              {initials}
                            </div>
                          );
                        })}
                        {users.length > 4 && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>+{users.length - 4}</span>
                        )}
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 6 }}>
                          {users[0]?.name}{users.length > 1 ? ` +${users.length - 1}` : ''}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Data */}
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                    {fmtDate(card.created_at)}
                  </td>
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
            fontSize: 12, color: 'var(--text-muted)', background: '#f8fafc',
            position: 'sticky', bottom: 0
          }}>
            <span><strong>{filtered.length}</strong> negócios</span>
            <span>Total: <strong style={{ color: 'var(--accent)' }}>{fmt(totalValue)}</strong></span>
            <span>Média: <strong>{fmt(totalValue / filtered.length)}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
