import React, { useState, useRef, useEffect } from 'react';

const PRESET_FILTERS = [
  { id: 'open',   label: 'Em andamento',   icon: '▶', filter: { status: 'open' } },
  { id: 'closed', label: 'Fechados',        icon: '✓', filter: { status: 'closed' } },
  { id: 'mine',   label: 'Meus registros', icon: '★', filter: { mine: true } },
];

const DATE_PRESETS = [
  { value: '',           label: 'Qualquer data' },
  { value: 'today',      label: 'Hoje' },
  { value: 'this_week',  label: 'Esta semana' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_30',    label: 'Últimos 30 dias' },
  { value: 'custom',     label: 'Personalizado' },
];

const AMOUNT_OPS = [
  { value: 'eq',      label: 'Valor exato' },
  { value: 'gt',      label: 'Maior que' },
  { value: 'lt',      label: 'Menor que' },
  { value: 'between', label: 'Entre' },
];

const SOURCES = ['Site', 'Indicação', 'Cold call', 'Email', 'Redes sociais', 'Evento', 'Outro'];

const INPUT = {
  width: '100%', padding: '12px 14px', fontSize: 16,
  border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none',
  fontFamily: 'inherit', background: '#f8fafc', boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const SELECT = {
  ...INPUT, appearance: 'none', backgroundImage:
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
  paddingRight: 32, cursor: 'pointer',
};

function FilterChip({ label, onRemove }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: '#e0f2fe', color: '#0369a1', borderRadius: 20,
      padding: '4px 12px 4px 10px', fontSize: 15, fontWeight: 500,
    }}>
      {label}
      <button onClick={onRemove} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1',
        padding: 0, lineHeight: 1, fontSize: 18, display: 'flex', alignItems: 'center',
      }}>×</button>
    </span>
  );
}

function FilterField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: 14, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function FilterBar({ isLead, stages, activeFilters, onApply, users }) {
  const [open, setOpen]               = useState(false);
  const [draft, setDraft]             = useState({ ...activeFilters });
  const [activePreset, setActivePreset] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const handler = e => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const applyPreset = (preset) => {
    setActivePreset(preset.id);
    onApply({ ...preset.filter });
    setOpen(false);
  };

  const apply = () => { onApply({ ...draft }); setOpen(false); };

  const reset = () => { setDraft({}); setActivePreset(null); onApply({}); setOpen(false); };

  const set = (key, val) => setDraft(prev => ({ ...prev, [key]: val }));

  // Build active chips
  const chips = [];
  if (activeFilters.status === 'open')   chips.push({ key: 'status',         label: 'Em andamento' });
  if (activeFilters.status === 'closed') chips.push({ key: 'status',         label: 'Fechados' });
  if (activeFilters.name)                chips.push({ key: 'name',           label: `Nome: ${activeFilters.name}` });
  if (activeFilters.source)              chips.push({ key: 'source',         label: `Fonte: ${activeFilters.source}` });
  if (activeFilters.stage_id) {
    const st = stages.find(s => s.id === parseInt(activeFilters.stage_id));
    if (st) chips.push({ key: 'stage_id', label: `Etapa: ${st.name}` });
  }
  if (activeFilters.responsible_id) {
    const u = (users || []).find(u => u.id === parseInt(activeFilters.responsible_id));
    chips.push({ key: 'responsible_id', label: `Responsável: ${u ? u.name : activeFilters.responsible_id}` });
  }
  if (activeFilters.amount_op && activeFilters.amount_val) {
    const op = AMOUNT_OPS.find(o => o.value === activeFilters.amount_op)?.label || '';
    chips.push({ key: 'amount', label: `Total: ${op} ${activeFilters.amount_val}${activeFilters.amount_val2 ? ` – ${activeFilters.amount_val2}` : ''}` });
  }
  if (activeFilters.date_preset && activeFilters.date_preset !== '') {
    const dp = DATE_PRESETS.find(d => d.value === activeFilters.date_preset);
    chips.push({ key: 'date_preset', label: `Criado: ${dp?.label || activeFilters.date_preset}` });
  }
  if (activeFilters.date_from) chips.push({ key: 'date_from', label: `De: ${activeFilters.date_from}` });
  if (activeFilters.date_to)   chips.push({ key: 'date_to',   label: `Até: ${activeFilters.date_to}` });

  const removeChip = (key) => {
    const next = { ...activeFilters };
    if (key === 'amount') { delete next.amount_op; delete next.amount_val; delete next.amount_val2; }
    else delete next[key];
    setActivePreset(null);
    onApply(next);
  };

  const hasFilters = chips.length > 0;

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>

      {/* ── Trigger row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 0' }}>
        <button
          onClick={() => { setDraft({ ...activeFilters }); setOpen(v => !v); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px',
            border: `1px solid ${hasFilters ? '#0ea5e9' : '#e2e8f0'}`,
            borderRadius: 8,
            background: hasFilters ? '#f0f9ff' : 'white',
            color: hasFilters ? '#0369a1' : '#64748b',
            cursor: 'pointer', fontSize: 15, fontWeight: 500, fontFamily: 'inherit',
            boxShadow: open ? '0 0 0 3px rgba(14,165,233,0.15)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 2.5h12M3.5 7h7M6 11.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Filtro
          {hasFilters && (
            <span style={{
              background: '#0ea5e9', color: 'white', borderRadius: 12,
              padding: '1px 7px', fontSize: 13, fontWeight: 700,
            }}>{chips.length}</span>
          )}
        </button>

        {chips.map(c => (
          <FilterChip key={c.key} label={c.label} onRemove={() => removeChip(c.key)} />
        ))}

        {hasFilters && (
          <button onClick={reset} style={{
            background: 'none', border: 'none', color: '#94a3b8',
            cursor: 'pointer', fontSize: 14, padding: '2px 6px',
          }}>
            Limpar filtros
          </button>
        )}
      </div>

      {/* ── Dropdown panel ── */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300,
          display: 'flex', background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          boxShadow: '0 16px 56px rgba(0,0,0,0.2)',
          width: 920,
          overflow: 'hidden',
        }}>

          {/* Left sidebar */}
          <div style={{
            width: 260, flexShrink: 0,
            borderRight: '1px solid #f1f5f9',
            background: '#f8fafc',
            padding: '22px 0',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <div style={{ padding: '0 22px 12px', fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Filtros rápidos
            </div>
            {PRESET_FILTERS.map(p => (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '11px 22px', border: 'none',
                  background: activePreset === p.id ? '#e0f2fe' : 'transparent',
                  color: activePreset === p.id ? '#0369a1' : '#334155',
                  cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', textAlign: 'left',
                  fontWeight: activePreset === p.id ? 600 : 400,
                  borderRadius: 0,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (activePreset !== p.id) e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={e => { if (activePreset !== p.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 14, width: 18, textAlign: 'center', opacity: 0.55 }}>{p.icon}</span>
                {p.label}
              </button>
            ))}

            <div style={{ borderTop: '1px solid #e2e8f0', margin: '14px 0' }} />

            <div style={{ padding: '0 22px 12px', fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Por etapa
            </div>
            {stages.map(s => (
              <button
                key={s.id}
                onClick={() => setDraft(prev => ({ ...prev, stage_id: draft.stage_id === s.id ? undefined : s.id }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 22px', border: 'none',
                  background: draft.stage_id === s.id ? '#e0f2fe' : 'transparent',
                  color: draft.stage_id === s.id ? '#0369a1' : '#334155',
                  cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', textAlign: 'left',
                  fontWeight: draft.stage_id === s.id ? 600 : 400,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (draft.stage_id !== s.id) e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={e => { if (draft.stage_id !== s.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color || '#94a3b8', flexShrink: 0 }} />
                {s.name}
              </button>
            ))}
          </div>

          {/* Right: fields */}
          <div style={{ flex: 1, padding: '28px 34px', display: 'flex', flexDirection: 'column', gap: 22, overflowY: 'auto', maxHeight: 600 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 0 }}>
              {isLead ? 'Campos do Lead' : 'Campos do Negócio'}
            </div>

            {/* Nome */}
            <FilterField label="Nome">
              <input
                style={INPUT}
                placeholder={isLead ? 'Buscar por nome do lead…' : 'Buscar por nome do negócio…'}
                value={draft.name || ''}
                onChange={e => set('name', e.target.value)}
              />
            </FilterField>

            {/* Responsável */}
            {users && users.length > 0 && (
              <FilterField label="Pessoa responsável">
                <select style={SELECT} value={draft.responsible_id || ''} onChange={e => set('responsible_id', e.target.value)}>
                  <option value="">Qualquer pessoa</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </FilterField>
            )}

            {/* Total */}
            <FilterField label="Total">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select style={{ ...SELECT, width: 160, flex: 'none' }} value={draft.amount_op || 'eq'} onChange={e => set('amount_op', e.target.value)}>
                  {AMOUNT_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input type="number" style={{ ...INPUT, width: 120, flex: 'none' }} placeholder="R$ 0,00" value={draft.amount_val || ''} onChange={e => set('amount_val', e.target.value)} />
                {draft.amount_op === 'between' && (
                  <>
                    <span style={{ color: '#94a3b8', fontSize: 15, flexShrink: 0 }}>até</span>
                    <input type="number" style={{ ...INPUT, width: 120, flex: 'none' }} placeholder="R$ 0,00" value={draft.amount_val2 || ''} onChange={e => set('amount_val2', e.target.value)} />
                  </>
                )}
              </div>
            </FilterField>

            {/* Criado em */}
            <FilterField label="Criado em">
              <select style={SELECT} value={draft.date_preset || ''} onChange={e => set('date_preset', e.target.value)}>
                {DATE_PRESETS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              {draft.date_preset === 'custom' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
                  <input type="date" style={{ ...INPUT, flex: 1 }} value={draft.date_from || ''} onChange={e => set('date_from', e.target.value)} />
                  <span style={{ color: '#94a3b8', fontSize: 15, flexShrink: 0 }}>até</span>
                  <input type="date" style={{ ...INPUT, flex: 1 }} value={draft.date_to || ''} onChange={e => set('date_to', e.target.value)} />
                </div>
              )}
            </FilterField>

            {/* Status */}
            <FilterField label="Status">
              <select style={SELECT} value={draft.status || ''} onChange={e => set('status', e.target.value)}>
                <option value="">Todos</option>
                <option value="open">Em andamento</option>
                <option value="closed">Fechado (Ganho ou Perdido)</option>
              </select>
            </FilterField>

            {/* Fonte */}
            {isLead && (
              <FilterField label="Fonte">
                <select style={SELECT} value={draft.source || ''} onChange={e => set('source', e.target.value)}>
                  <option value="">Qualquer fonte</option>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FilterField>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, paddingTop: 12, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', marginTop: 4 }}>
              <button
                onClick={reset}
                style={{
                  padding: '11px 26px', borderRadius: 8, border: '1px solid #e2e8f0',
                  background: 'white', color: '#64748b', cursor: 'pointer',
                  fontSize: 16, fontFamily: 'inherit', fontWeight: 500,
                }}
              >Limpar</button>
              <button
                onClick={apply}
                style={{
                  padding: '11px 34px', borderRadius: 8, border: 'none',
                  background: '#ed5418', color: 'white', cursor: 'pointer',
                  fontSize: 16, fontFamily: 'inherit', fontWeight: 700,
                  boxShadow: '0 2px 10px rgba(237,84,24,0.35)',
                }}
              >Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
