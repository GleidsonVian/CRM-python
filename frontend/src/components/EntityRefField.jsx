import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL as API } from '../config.js';

const ENTITY_LABELS = {
  spa:      { label: 'SPA',      color: '#ed5418' },
  pipeline: { label: 'Pipeline', color: '#6366f1' },
  lead:     { label: 'Lead',     color: '#0ea5e9' },
  contact:  { label: 'Contato',  color: '#10b981' },
  company:  { label: 'Empresa',  color: '#8b5cf6' },
};

/**
 * EntityRefField — searchable entity reference chip
 *
 * Props:
 *   value       string | null    JSON string or '' (stored value)
 *   onChange    (jsonStr) => void   called with JSON string or ''
 *   config      { entity_type, target_id?, target_name? }
 *   readOnly    bool
 *   authHeader  () => headers object (optional, for secured endpoints)
 */
export default function EntityRefField({ value, onChange, config, readOnly, authHeader }) {
  const [parsed, setParsed] = useState(null);
  const [query, setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen]     = useState(false);
  const [busy, setBusy]     = useState(false);
  const [preview, setPreview] = useState(false);
  const timerRef = useRef(null);
  const wrapRef  = useRef(null);

  // Parse stored value
  useEffect(() => {
    try { setParsed(value ? (typeof value === 'string' ? JSON.parse(value) : value) : null); }
    catch { setParsed(null); }
  }, [value]);

  const doSearch = useCallback(async (q) => {
    if (!config?.entity_type) return;
    setBusy(true);
    try {
      let url = `${API}/entity-search?entity_type=${config.entity_type}&q=${encodeURIComponent(q)}`;
      if (config.target_id) url += `&target_id=${config.target_id}`;
      const headers = authHeader ? authHeader() : {};
      const res = await fetch(url, { headers });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {} finally { setBusy(false); }
  }, [config, authHeader]);

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(q), 280);
  };

  const handleFocus = () => {
    setOpen(true);
    if (!query) doSearch('');
  };

  const pick = (item) => {
    const val = { id: item.id, title: item.title, entity_type: config.entity_type, target_id: config.target_id ?? null };
    setParsed(val);
    onChange(JSON.stringify(val));
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  const clear = () => {
    setParsed(null);
    onChange('');
    setPreview(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const meta = ENTITY_LABELS[config?.entity_type] || { label: 'Entidade', color: '#6366f1' };
  const targetName = config?.target_name || meta.label;

  // ── Chip (value selected) ──────────────────────────────────────────────────
  if (parsed) {
    return (
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 10px', background: meta.color + '10',
          border: `1.5px solid ${meta.color}40`, borderRadius: 8,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 800, color: 'white', background: meta.color,
            borderRadius: 4, padding: '1px 6px', flexShrink: 0, textTransform: 'uppercase',
          }}>{meta.label}</span>
          <button
            onClick={() => setPreview(p => !p)}
            style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: meta.color, fontWeight: 600, padding: 0, fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >{parsed.title}</button>
          {!readOnly && (
            <button onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
            >×</button>
          )}
        </div>

        {preview && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 9999,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            padding: '12px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)', width: 230,
          }}>
            <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
              {meta.label}{config?.target_name ? ` · ${config.target_name}` : ''}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 10, wordBreak: 'break-word' }}>
              {parsed.title}
            </div>
            <button
              onClick={() => {
                setPreview(false);
                const detail = { entity_type: parsed.entity_type, target_id: parsed.target_id, record_id: parsed.id, title: parsed.title };
                window.__nexus_pending_entity = detail;
                window.dispatchEvent(new CustomEvent('nexus:open-entity', { detail }));
                if (parsed.entity_type === 'spa') window.location.hash = 'smart-processes';
              }}
              style={{ width: '100%', padding: '6px 10px', background: meta.color, color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}
            >Abrir →</button>
          </div>
        )}
      </div>
    );
  }

  // ── Search input (no value) ────────────────────────────────────────────────
  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        disabled={readOnly}
        placeholder={readOnly ? '—' : `Buscar em ${targetName}…`}
        style={{
          width: '100%', padding: '7px 10px', boxSizing: 'border-box',
          border: '1.5px solid #e2e8f0', borderRadius: 8,
          fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#0f172a',
          background: readOnly ? '#f8fafc' : '#fff',
        }}
        onFocus2={e => { e.currentTarget.style.borderColor = meta.color; }}
        onBlur2={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 9999,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
        }}>
          {busy && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8' }}>Buscando...</div>
          )}
          {!busy && results.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8' }}>
              {query ? 'Nenhum resultado' : 'Digite para buscar…'}
            </div>
          )}
          {results.map(item => (
            <button key={item.id} onMouseDown={() => pick(item)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '9px 12px', background: 'none', border: 'none',
              borderBottom: '1px solid #f8fafc', cursor: 'pointer',
              fontSize: 13, color: '#0f172a', fontFamily: 'inherit',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >{item.title}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Entity config editor (used in field definition forms) ─────────────────────
export function EntityConfigEditor({ value, onChange }) {
  // value is a JSON string: { entity_type, target_id, target_name }
  let cfg = {};
  try { cfg = JSON.parse(value || '{}'); } catch {}

  const [entityType, setEntityType] = useState(cfg.entity_type || '');
  const [targetId,   setTargetId]   = useState(cfg.target_id   || '');
  const [targetName, setTargetName] = useState(cfg.target_name || '');
  const [processes,  setProcesses]  = useState([]);
  const [pipelines,  setPipelines]  = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('nexus_token');
    const h = { Authorization: `Bearer ${token}` };
    if (entityType === 'spa') {
      fetch(`${API}/smart-processes`, { headers: h }).then(r => r.json()).then(d => setProcesses(Array.isArray(d) ? d : [])).catch(() => {});
    }
    if (entityType === 'pipeline') {
      fetch(`${API}/pipelines`, { headers: h }).then(r => r.json()).then(d => setPipelines(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [entityType]);

  const emit = (et, tid, tn) => {
    if (!et) { onChange(''); return; }
    onChange(JSON.stringify({ entity_type: et, target_id: tid || null, target_name: tn || '' }));
  };

  const handleTypeChange = (et) => {
    setEntityType(et); setTargetId(''); setTargetName('');
    emit(et, null, '');
  };

  const handleTargetChange = (tid, tn) => {
    setTargetId(tid); setTargetName(tn);
    emit(entityType, tid ? Number(tid) : null, tn);
  };

  const TYPES = [
    { value: 'spa',      label: 'SPA (processo)' },
    { value: 'pipeline', label: 'Pipeline (negócio)' },
    { value: 'lead',     label: 'Leads' },
    { value: 'contact',  label: 'Contatos' },
    { value: 'company',  label: 'Empresas' },
  ];

  const needsTarget = entityType === 'spa' || entityType === 'pipeline';
  const targetOptions = entityType === 'spa' ? processes : pipelines;

  return (
    <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Configuração de Entidade
      </div>
      <div>
        <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 4 }}>Tipo de entidade</label>
        <select
          value={entityType}
          onChange={e => handleTypeChange(e.target.value)}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: '#fff', color: '#0f172a', outline: 'none' }}
        >
          <option value="">— selecionar —</option>
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      {needsTarget && (
        <div>
          <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 4 }}>
            {entityType === 'spa' ? 'Processo SPA' : 'Pipeline (opcional — vazio = todos)'}
          </label>
          <select
            value={targetId}
            onChange={e => {
              const opt = targetOptions.find(o => String(o.id) === e.target.value);
              handleTargetChange(e.target.value, opt?.name || '');
            }}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: '#fff', color: '#0f172a', outline: 'none' }}
          >
            <option value="">{entityType === 'pipeline' ? '— Todos os pipelines —' : '— selecionar —'}</option>
            {targetOptions.map(o => <option key={o.id} value={o.id}>{o.icon ? `${o.icon} ${o.name}` : o.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
