import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL as API } from '../config.js';
import EntityRefField, { EntityConfigEditor } from './EntityRefField.jsx';

const ACCENT = '#ed5418';
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#64748b'];
const FIELD_TYPES = ['text', 'number', 'select', 'date', 'textarea', 'url', 'phone', 'entity'];

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('nexus_token')}`,
  'Content-Type': 'application/json',
});

function slugify(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function contrastColor(hex) {
  const h = (hex || '#6366f1').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1a1a1a' : '#ffffff';
}

function hexToRgba(hex, alpha) {
  const h = (hex || '#6366f1').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

const fmtDate = iso => {
  if (!iso) return '';
  const d = new Date(iso.includes('+') || iso.endsWith('Z') ? iso : iso + 'Z');
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(d);
};

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M9.5 1.5l2 2L4 11l-2.5.5.5-2.5L9.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M1.5 3.5h10M5 3.5V2h3v1.5M10.5 3.5l-.75 7.5a1 1 0 01-1 .9H4.25a1 1 0 01-1-.9L2.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IconGear = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M7 1.5v1.3M7 11.2V12.5M1.5 7h1.3M11.2 7H12.5M3.1 3.1l.92.92M9.98 9.98l.92.92M3.1 10.9l.92-.92M9.98 4.02l.92-.92" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconPlus = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M8.5 8.5L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconLink = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M4.5 7.5a3 3 0 004.24 0l1.5-1.5a3 3 0 00-4.24-4.24l-.75.75" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M7.5 4.5a3 3 0 00-4.24 0L1.76 6a3 3 0 004.24 4.24l.75-.75" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IconPerson = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <circle cx="5.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.1"/>
    <path d="M1 10a4.5 4.5 0 019 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);

const IconKanban = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="3.5" height="12" rx="1" fill="currentColor" opacity=".9"/>
    <rect x="5.25" y="1" width="3.5" height="8" rx="1" fill="currentColor" opacity=".9"/>
    <rect x="9.5" y="1" width="3.5" height="5" rx="1" fill="currentColor" opacity=".9"/>
  </svg>
);

const IconTable = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/>
    <line x1="1" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="1.3"/>
    <line x1="1" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.3"/>
    <line x1="5" y1="5" x2="5" y2="13" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);

// ── Shared styles ─────────────────────────────────────────────────────────────

const S = {
  label: {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
  },
  input: {
    width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)',
    borderRadius: 6, outline: 'none', fontFamily: 'inherit', color: 'var(--text-primary)',
    boxSizing: 'border-box', background: 'var(--bg-primary)', transition: 'border-color 0.15s',
  },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px',
    fontSize: 12, color: '#94a3b8', borderRadius: 4, fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s',
  },
  addDashed: {
    marginTop: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: '1.5px dashed var(--border)', borderRadius: 6, background: 'transparent',
    color: '#64748b', width: '100%', fontFamily: 'inherit', transition: 'all 0.15s',
  },
  primaryBtn: {
    padding: '7px 15px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    background: ACCENT, color: '#fff', border: 'none', borderRadius: 6,
    fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
  },
  cancelBtn: {
    padding: '7px 15px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)',
    borderRadius: 6, fontFamily: 'inherit',
  },
  th: {
    padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--bg-secondary)',
  },
  td: {
    padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border)', verticalAlign: 'middle',
  },
};

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div style={{ background: '#ffffff', borderRadius: 10, padding: '24px 28px', width: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 20, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} style={S.cancelBtn}>Cancelar</button>
          <button onClick={onConfirm} style={{ ...S.primaryBtn, background: '#ef4444' }}>Excluir</button>
        </div>
      </div>
    </div>
  );
}

// ── ProcessModal ──────────────────────────────────────────────────────────────

function ProcessModal({ process, onClose, onSave, users }) {
  const isNew = !process?.id;
  const [tab, setTab] = useState(0);
  const [name, setName] = useState(process?.name || '');
  const [icon, setIcon] = useState(process?.icon || '📋');
  const [color, setColor] = useState(process?.color || '#6366f1');
  const [description, setDescription] = useState(process?.description || '');
  const [fields, setFields] = useState(process?.fields_config ? JSON.parse(JSON.stringify(process.fields_config)) : []);
  const TERMINAL_SUCCESS = { name: 'Ganho', color: '#22c55e', is_terminal: true, terminal_type: 'success' };
  const TERMINAL_LOST    = { name: 'Descartado', color: '#ef4444', is_terminal: true, terminal_type: 'lost' };

  const ensureTerminal = (arr) => {
    const base = arr.filter(s => !s.is_terminal);
    return [...base, TERMINAL_SUCCESS, TERMINAL_LOST];
  };

  const [stages, setStages] = useState(() => {
    if (process?.stages?.length) {
      return ensureTerminal(JSON.parse(JSON.stringify(process.stages)));
    }
    return [
      { name: 'Novo', color: '#94a3b8' },
      { name: 'Em andamento', color: '#3b82f6' },
      TERMINAL_SUCCESS,
      TERMINAL_LOST,
    ];
  });
  const [automationRules, setAutomationRules] = useState(
    process?.automation_rules ? JSON.parse(JSON.stringify(process.automation_rules)) : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addField = () => setFields(prev => [...prev, { key: '', label: '', type: 'text', required: false, options: [] }]);
  const removeField = (i) => setFields(prev => prev.filter((_, idx) => idx !== i));
  const updateField = (i, patch) => setFields(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  const moveField = (i, dir) => {
    const arr = [...fields]; const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; setFields(arr);
  };

  const addStage = () => setStages(prev => {
    const terminals = prev.filter(s => s.is_terminal);
    const rest = prev.filter(s => !s.is_terminal);
    return [...rest, { name: 'Nova etapa', color: '#94a3b8' }, ...terminals];
  });
  const removeStage = (i) => setStages(prev => {
    if (prev[i]?.is_terminal) return prev; // terminal stages cannot be removed
    return prev.filter((_, idx) => idx !== i);
  });
  const updateStage = (i, patch) => setStages(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const moveStage = (i, dir) => {
    const arr = [...stages]; const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    if (arr[i]?.is_terminal || arr[j]?.is_terminal) return; // don't move terminal stages
    [arr[i], arr[j]] = [arr[j], arr[i]]; setStages(arr);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Informe o nome do processo'); return; }
    if (stages.length === 0) { setError('Adicione pelo menos uma etapa'); return; }
    setError(''); setSaving(true);
    try {
      const payload = {
        name: name.trim(), icon, color, description,
        fields_config: fields.map(f => ({ ...f, key: f.key || slugify(f.label) || `field_${Date.now()}` })),
        stages: stages.map(s => ({ name: s.name, color: s.color, is_terminal: !!s.is_terminal, terminal_type: s.terminal_type || null, required_fields: s.required_fields || [] })),
        automation_rules: automationRules,
      };
      const url = isNew ? `${API}/smart-processes` : `${API}/smart-processes/${process.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();
      onSave(saved); onClose();
    } catch (e) {
      setError('Erro ao salvar: ' + e.message);
    } finally { setSaving(false); }
  };

  const TABS = ['Geral', 'Campos', 'Etapas', 'Regras'];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: 680, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

        {/* ── Header limpo branco ── */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #e8e8e8', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 9, background: color, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
            }}>{icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111', lineHeight: 1.2 }}>
                {name || (isNew ? 'Novo processo' : 'Editar processo')}
              </div>
              {name && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Smart Process</div>}
            </div>
            <button onClick={onClose} style={{ ...S.iconBtn, color: '#888' }}><IconClose /></button>
          </div>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map((t, i) => (
              <button key={i} onClick={() => setTab(i)} style={{
                padding: '8px 18px', fontSize: 13, fontWeight: tab === i ? 600 : 400, cursor: 'pointer',
                border: 'none', background: 'transparent', fontFamily: 'inherit',
                color: tab === i ? color : '#666',
                borderBottom: tab === i ? `2px solid ${color}` : '2px solid transparent',
                marginBottom: -1, transition: 'all 0.15s',
              }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 6, padding: '8px 12px', fontSize: 12, marginBottom: 14 }}>{error}</div>}

          {tab === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={S.label}>Nome *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Contratos, Veículos, Imóveis..." style={S.input} />
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 90 }}>
                  <label style={S.label}>Ícone</label>
                  <input value={icon} onChange={e => setIcon(e.target.value)} maxLength={4} style={{ ...S.input, fontSize: 24, textAlign: 'center', padding: '5px 0' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Cor do processo</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setColor(c)} title={c} style={{
                        width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer', outline: 'none',
                        border: color === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                        boxShadow: color === c ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${c}` : 'none',
                      }} />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label style={S.label}>Descrição</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ ...S.input, resize: 'vertical' }} placeholder="Descreva o propósito deste processo..." />
              </div>
            </div>
          )}

          {tab === 1 && (
            <div>
              {fields.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                  Nenhum campo configurado. Clique em "+ Campo" para adicionar.
                </div>
              )}
              {fields.map((f, i) => (
                <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 10, background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 2 }}>
                      <label style={S.label}>Label</label>
                      <input value={f.label} onChange={e => { const label = e.target.value; updateField(i, { label, key: slugify(label) }); }} style={S.input} placeholder="Ex: Placa" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={S.label}>Tipo</label>
                      <select value={f.type} onChange={e => updateField(i, { type: e.target.value })} style={S.input}>
                        {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={S.label}>Key</label>
                      <input value={f.key} onChange={e => updateField(i, { key: e.target.value })} style={{ ...S.input, fontFamily: 'monospace', fontSize: 11 }} placeholder="auto" />
                    </div>
                  </div>
                  {f.type === 'select' && (
                    <div style={{ marginBottom: 8 }}>
                      <label style={S.label}>Opções (separadas por vírgula)</label>
                      <input
                        value={Array.isArray(f.options) ? f.options.join(', ') : ''}
                        onChange={e => updateField(i, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        style={S.input} placeholder="Opção 1, Opção 2, Opção 3"
                      />
                    </div>
                  )}
                  {f.type === 'entity' && (
                    <div style={{ marginBottom: 8 }}>
                      <EntityConfigEditor
                        value={JSON.stringify({ entity_type: f.entity_type || '', target_id: f.target_id || null, target_name: f.target_name || '' })}
                        onChange={v => { try { const c = JSON.parse(v || '{}'); updateField(i, { entity_type: c.entity_type, target_id: c.target_id, target_name: c.target_name }); } catch {} }}
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!f.required} onChange={e => updateField(i, { required: e.target.checked })} />
                      Obrigatório
                    </label>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {[[-1, '↑'], [1, '↓']].map(([d, lbl]) => (
                        <button key={d} onClick={() => moveField(i, d)} style={{ ...S.iconBtn, fontSize: 13, color: '#64748b' }}>{lbl}</button>
                      ))}
                      <button onClick={() => removeField(i)} style={{ ...S.iconBtn, color: '#ef4444' }}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addField} style={S.addDashed}>+ Campo</button>
            </div>
          )}

          {tab === 2 && (
            <div>
              {stages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>Adicione pelo menos uma etapa.</div>
              )}
              {stages.map((s, i) => (
                <React.Fragment key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: fields.length > 0 && !s.is_terminal ? 2 : 8, padding: '8px 10px', border: `1px solid ${s.is_terminal ? hexToRgba(s.color, 0.4) : 'var(--border)'}`, borderRadius: 8, background: s.is_terminal ? hexToRgba(s.color, 0.06) : 'var(--bg-secondary)' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: s.color, flexShrink: 0, boxShadow: `0 0 0 3px ${hexToRgba(s.color, 0.25)}` }} />
                    <input
                      value={s.name}
                      onChange={e => !s.is_terminal && updateStage(i, { name: e.target.value })}
                      readOnly={!!s.is_terminal}
                      style={{ ...S.input, flex: 1, margin: 0, opacity: s.is_terminal ? 0.75 : 1, cursor: s.is_terminal ? 'default' : 'text' }}
                    />
                    {s.is_terminal ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: hexToRgba(s.color, 0.12), border: `1px solid ${hexToRgba(s.color, 0.3)}`, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {s.terminal_type === 'success' ? '✓ Ganho' : '✗ Descartado'} · Obrigatória
                      </span>
                    ) : (
                      <>
                        <input type="color" value={s.color} onChange={e => updateStage(i, { color: e.target.value })} style={{ width: 34, height: 34, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                        {[[-1, '↑'], [1, '↓']].map(([d, lbl]) => (
                          <button key={d} onClick={() => moveStage(i, d)} style={{ ...S.iconBtn, fontSize: 13, color: '#64748b' }}>{lbl}</button>
                        ))}
                        <button onClick={() => removeStage(i)} style={{ ...S.iconBtn, color: '#ef4444' }}>✕</button>
                      </>
                    )}
                  </div>
                  {!s.is_terminal && fields.length > 0 && (
                    <div style={{ marginLeft: 12, marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', padding: '4px 8px', background: '#f8fafc', borderRadius: '0 0 6px 6px', borderLeft: '3px solid #e2e8f0' }}>
                      <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginRight: 2 }}>Obrigatórios para avançar:</span>
                      {fields.map(f => {
                        const fkey = f.key || f.label;
                        const checked = (s.required_fields || []).includes(fkey);
                        return (
                          <label key={fkey} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: checked ? '#6366f1' : '#64748b', cursor: 'pointer', background: checked ? '#eef2ff' : '#fff', border: `1px solid ${checked ? '#c7d2fe' : '#e2e8f0'}`, borderRadius: 4, padding: '2px 7px' }}>
                            <input type="checkbox" style={{ width: 11, height: 11 }}
                              checked={checked}
                              onChange={e => {
                                const cur = s.required_fields || [];
                                updateStage(i, { required_fields: e.target.checked ? [...cur, fkey] : cur.filter(k => k !== fkey) });
                              }}
                            />
                            {f.label || f.key}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              ))}
              <button onClick={addStage} style={S.addDashed}>+ Etapa</button>
            </div>
          )}

          {/* ── Tab 3: Regras de automação ── */}
          {tab === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, lineHeight: 1.6 }}>
                Defina ações automáticas quando um registro entrar em uma etapa.
              </div>
              {automationRules.map((rule, ri) => (
                <div key={rule.id || ri} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <input
                      value={rule.name || ''}
                      onChange={e => setAutomationRules(prev => prev.map((r, idx) => idx === ri ? { ...r, name: e.target.value } : r))}
                      placeholder="Nome da regra"
                      style={{ ...S.input, flex: 1, marginRight: 8, fontWeight: 600 }}
                    />
                    <button onClick={() => setAutomationRules(prev => prev.filter((_, idx) => idx !== ri))} style={{ ...S.iconBtn, color: '#ef4444' }}>✕</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={S.label}>Quando entrar na etapa</label>
                      <select
                        value={rule.trigger_stage_index ?? ''}
                        onChange={e => setAutomationRules(prev => prev.map((r, idx) => idx === ri ? { ...r, trigger_stage_index: Number(e.target.value) } : r))}
                        style={{ ...S.input, height: 34, padding: '0 8px' }}
                      >
                        <option value="">— selecione —</option>
                        {stages.filter(s => !s.is_terminal).map((s, si) => (
                          <option key={si} value={si}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>Ação</label>
                      <select
                        value={rule.action_type || ''}
                        onChange={e => setAutomationRules(prev => prev.map((r, idx) => idx === ri ? { ...r, action_type: e.target.value, action_data: {} } : r))}
                        style={{ ...S.input, height: 34, padding: '0 8px' }}
                      >
                        <option value="">— selecione —</option>
                        <option value="notify">Notificar (mensagem)</option>
                        <option value="auto_assign">Atribuir responsável</option>
                      </select>
                    </div>
                  </div>
                  {rule.action_type === 'notify' && (
                    <div style={{ marginTop: 10 }}>
                      <label style={S.label}>Mensagem</label>
                      <input
                        value={rule.action_data?.message || ''}
                        onChange={e => setAutomationRules(prev => prev.map((r, idx) => idx === ri ? { ...r, action_data: { ...r.action_data, message: e.target.value } } : r))}
                        placeholder="Ex: Registro movido para análise, verifique os dados."
                        style={S.input}
                      />
                    </div>
                  )}
                  {rule.action_type === 'auto_assign' && (
                    <div style={{ marginTop: 10 }}>
                      <label style={S.label}>Responsável</label>
                      <select
                        value={rule.action_data?.assignee_id || ''}
                        onChange={e => setAutomationRules(prev => prev.map((r, idx) => idx === ri ? { ...r, action_data: { ...r.action_data, assignee_id: Number(e.target.value) } } : r))}
                        style={{ ...S.input, height: 34, padding: '0 8px' }}
                      >
                        <option value="">— selecione —</option>
                        {(users || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => setAutomationRules(prev => [...prev, { id: Date.now(), name: '', trigger_stage_index: null, action_type: '', action_data: {} }])}
                style={S.addDashed}
              >+ Nova regra</button>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={S.cancelBtn}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ ...S.primaryBtn, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : isNew ? 'Criar processo' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RecordPanel ── slide-in panel igual ao CardModal ──────────────────────────

function RecordPanel({ record, process, defaultStageIndex, users, onClose, onSave, onDelete }) {
  const isNew = !record?.id;
  const [title, setTitle] = useState(record?.title || '');
  const [stageIndex, setStageIndex] = useState(record?.stage_index ?? defaultStageIndex ?? 0);
  const [assigneeId, setAssigneeId] = useState(record?.assignee_id ?? null);
  const [data, setData] = useState(record?.data ? { ...record.data } : {});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [error, setError] = useState('');
  const [stageError, setStageError] = useState('');
  const [links, setLinks] = useState(record?.links || []);
  const [rightTab, setRightTab] = useState('activity');
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [automationLog, setAutomationLog] = useState([]);

  // Load notes from API
  useEffect(() => {
    if (isNew || !record?.id) return;
    fetch(`${API}/smart-processes/${process.id}/records/${record.id}/notes`, { headers: authHeader() })
      .then(r => r.json()).then(data => { setNotes(Array.isArray(data) ? data : []); setNotesLoaded(true); })
      .catch(() => setNotesLoaded(true));
  }, [record?.id]);

  const setField = (key, val) => setData(prev => ({ ...prev, [key]: val }));

  // Auto-save on blur
  const autoSave = async (patch = {}) => {
    if (isNew) return;
    setSaveStatus('saving');
    try {
      const payload = { title: title.trim() || record.title, stage_index: stageIndex, assignee_id: assigneeId, data, ...patch };
      const res = await fetch(`${API}/smart-processes/${process.id}/records/${record.id}`, {
        method: 'PUT', headers: authHeader(), body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();
      onSave(saved);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (e) {
      setSaveStatus('');
      setError('Erro ao salvar: ' + e.message);
    }
  };

  const executeRules = (newStageIdx) => {
    const rules = process.automation_rules || [];
    rules.forEach(rule => {
      if (rule.trigger_stage_index !== newStageIdx) return;
      if (rule.action_type === 'notify' && rule.action_data?.message) {
        setAutomationLog(prev => [{ id: Date.now(), message: rule.action_data.message, rule: rule.name, ts: new Date().toISOString() }, ...prev]);
      } else if (rule.action_type === 'auto_assign' && rule.action_data?.assignee_id) {
        setAssigneeId(rule.action_data.assignee_id);
      }
    });
  };

  const handleStageClick = async (idx) => {
    const stage = (process.stages || [])[idx];
    const required = stage?.required_fields || [];
    if (required.length > 0) {
      const missing = required.filter(fkey => {
        const val = data[fkey];
        return val === null || val === undefined || val === '';
      });
      if (missing.length > 0) {
        const labels = missing.map(fkey => {
          const fd = (process.fields_config || []).find(f => f.key === fkey);
          return fd ? fd.label : fkey;
        });
        setStageError(`Preencha antes de avançar: ${labels.join(', ')}`);
        setTimeout(() => setStageError(''), 4000);
        return;
      }
    }
    setStageError('');
    setStageIndex(idx);
    executeRules(idx);
    if (!isNew) autoSave({ stage_index: idx });
  };

  const handleSave = async () => {
    if (!title.trim()) { setError('Informe o título'); return; }
    setError(''); setSaving(true);
    try {
      const payload = { title: title.trim(), stage_index: stageIndex, assignee_id: assigneeId, data };
      const url = isNew
        ? `${API}/smart-processes/${process.id}/records`
        : `${API}/smart-processes/${process.id}/records/${record.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();
      onSave(saved); onClose();
    } catch (e) {
      setError('Erro ao salvar: ' + e.message);
    } finally { setSaving(false); }
  };

  const handleUnlink = async (linkId) => {
    try {
      const res = await fetch(`${API}/sp-records/${record.id}/link/${linkId}`, { method: 'DELETE', headers: authHeader() });
      if (!res.ok) throw new Error(await res.text());
      setLinks(prev => prev.filter(l => l.id !== linkId));
    } catch (e) { setError('Erro: ' + e.message); }
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    const text = note.trim();
    setNote('');
    if (isNew) {
      setNotes(prev => [{ id: Date.now(), content: text, actor: 'Usuário', created_at: new Date().toISOString() }, ...prev]);
      return;
    }
    try {
      const res = await fetch(`${API}/smart-processes/${process.id}/records/${record.id}/notes`, {
        method: 'POST', headers: authHeader(), body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setNotes(prev => [saved, ...prev]);
    } catch {
      setNotes(prev => [{ id: Date.now(), content: text, actor: 'Usuário', created_at: new Date().toISOString() }, ...prev]);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (isNew) { setNotes(prev => prev.filter(n => n.id !== noteId)); return; }
    setNotes(prev => prev.filter(n => n.id !== noteId));
    try {
      await fetch(`${API}/smart-processes/${process.id}/records/${record.id}/notes/${noteId}`, {
        method: 'DELETE', headers: authHeader(),
      });
    } catch {}
  };

  const fmtTs = iso => {
    const d = new Date(iso.includes('+') || iso.endsWith('Z') ? iso : iso + 'Z');
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-slider" onClick={e => e.stopPropagation()}>

        {/* ── Header — idêntico ao CardModal ── */}
        <div className="modal-header">
          <div className="modal-header-top">
            <div className="modal-title-wrap">
              <input
                className="modal-title-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={() => !isNew && autoSave()}
                placeholder="Título do registro"
                autoFocus={isNew}
              />
              {!isNew && (
                <span className="modal-id">#{record.id} · {fmtTs(record.created_at)}</span>
              )}
            </div>
            <div className="modal-header-actions">
              {saveStatus === 'saving' && <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>Salvando…</span>}
              {saveStatus === 'saved'  && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, whiteSpace: 'nowrap' }}>✓ Salvo</span>}
              {error && <span style={{ fontSize: 11, color: '#ef4444', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{error}</span>}
              {!isNew && onDelete && (
                <button className="btn btn-danger" style={{ fontSize: 12 }}
                  onClick={() => { onDelete(record); onClose(); }}>
                  Excluir
                </button>
              )}
              {isNew && (
                <button className="btn btn-primary" style={{ fontSize: 12 }}
                  onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando...' : 'Criar registro'}
                </button>
              )}
              <button className="icon-btn" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Stage validation error */}
          {stageError && (
            <div style={{ margin: '0 20px 0', padding: '7px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚠ {stageError}
            </div>
          )}

          {/* Stage bar */}
          <div className="modal-stages-bar">
            {(process.stages || []).map((s, i) => {
              const activeIdx = stageIndex;
              const isActive = i === activeIdx;
              const isPast = i < activeIdx;
              const col = s.color || '#6366f1';
              return (
                <button
                  key={i}
                  className={`stage-tab${isActive ? ' active' : ''}${isPast ? ' past' : ''}`}
                  style={isActive
                    ? { background: col, borderColor: col, color: '#fff' }
                    : isPast
                      ? { borderColor: col, color: col, background: col + '18' }
                      : {}
                  }
                  onClick={() => handleStageClick(i)}
                >
                  {s.is_terminal && (s.terminal_type === 'success' ? '✓ ' : '✗ ')}
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Body: left fields + right activity ── */}
        <div className="modal-content-grid">

          {/* Left — fields */}
          <div className="modal-left">

            {/* Detalhes nativos — sempre visível */}
            <div className="form-section-title">Detalhes</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 20 }}>
              <div>
                <div className="form-label" style={{ marginBottom: 3 }}>Processo</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-primary)' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                    background: (process.color || '#6366f1') + '18',
                    color: process.color || '#6366f1',
                    padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap',
                  }}>
                    {process.icon} {process.name}
                  </span>
                </div>
              </div>
              <div>
                <div className="form-label" style={{ marginBottom: 3 }}>Etapa atual</div>
                {(() => {
                  const s = (process.stages || [])[stageIndex];
                  return s ? (
                    <span style={{ display: 'inline-block', background: s.color, color: contrastColor(s.color), borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                      {s.name}
                    </span>
                  ) : <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>—</span>;
                })()}
              </div>
              {/* Responsável */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="form-label" style={{ marginBottom: 3 }}>Responsável</div>
                <select
                  className="form-select"
                  value={assigneeId || ''}
                  onChange={e => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setAssigneeId(val);
                    if (!isNew) autoSave({ assignee_id: val });
                  }}
                >
                  <option value="">— Nenhum —</option>
                  {(users || []).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {!isNew && (
                <>
                  <div>
                    <div className="form-label" style={{ marginBottom: 3 }}>Criado em</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{fmtTs(record.created_at)}</div>
                  </div>
                  <div>
                    <div className="form-label" style={{ marginBottom: 3 }}>Atualizado</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{fmtTs(record.updated_at || record.created_at)}</div>
                  </div>
                </>
              )}
            </div>

            {(process.fields_config || []).map(field => (
              <div className="form-group" key={field.key}>
                <label className="form-label">
                  {field.label}
                  {field.required && <span style={{ color: '#ef4444' }}> *</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={data[field.key] || ''}
                    onChange={e => setField(field.key, e.target.value)}
                    onBlur={() => !isNew && autoSave()}
                  />
                ) : field.type === 'select' ? (
                  <select
                    className="form-select"
                    value={data[field.key] || ''}
                    onChange={e => { setField(field.key, e.target.value); if (!isNew) setTimeout(autoSave, 0); }}
                  >
                    <option value="">— selecione —</option>
                    {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : field.type === 'entity' ? (
                  <EntityRefField
                    value={data[field.key] || ''}
                    config={{ entity_type: field.entity_type, target_id: field.target_id, target_name: field.target_name }}
                    authHeader={authHeader}
                    onChange={v => { setField(field.key, v); if (!isNew) setTimeout(autoSave, 0); }}
                  />
                ) : (
                  <input
                    className="form-input"
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    value={data[field.key] || ''}
                    onChange={e => setField(field.key, e.target.value)}
                    onBlur={() => !isNew && autoSave()}
                  />
                )}
              </div>
            ))}

            {/* Links section */}
            {links.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div className="form-section-title">Vínculos</div>
                {links.map(lk => (
                  <div key={lk.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                      <IconLink /> {lk.entity_type} #{lk.entity_id}
                    </span>
                    <button onClick={() => handleUnlink(lk.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Remover</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right — activity tabs */}
          <div className="modal-right" style={{ display: 'flex', flexDirection: 'column' }}>

            {/* Tab header */}
            <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              {[
                { key: 'activity', label: 'Atividades' },
                { key: 'history',  label: 'Histórico' },
              ].map(t => (
                <button key={t.key} onClick={() => setRightTab(t.key)} style={{
                  flex: 1, background: 'none', border: 'none',
                  borderBottom: `2px solid ${rightTab === t.key ? '#6366f1' : 'transparent'}`,
                  color: rightTab === t.key ? '#6366f1' : '#64748b',
                  fontWeight: rightTab === t.key ? 700 : 500,
                  fontSize: 11, padding: '10px 4px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                }}>{t.label}</button>
              ))}
            </div>

            {/* Activity tab */}
            {rightTab === 'activity' && (
              <>
                {/* Note input */}
                <div className="timeline-note-area">
                  <input
                    className="timeline-note-input"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Adicionar nota... (Enter para salvar)"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }}
                  />
                </div>

                {/* Timeline */}
                <div className="timeline-events" style={{ flex: 1, overflowY: 'auto' }}>
                  {/* Record creation event (always shown) */}
                  {!isNew && (
                    <div className="timeline-event">
                      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: '#6366f118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, border: '1.5px solid #6366f130' }}>📋</div>
                      <div className="event-body" style={{ flex: 1, minWidth: 0 }}>
                        <div className="event-content">Registro criado</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>👤 Usuário</span>
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>·</span>
                          <span className="event-time" style={{ fontSize: 10 }}>{fmtTs(record.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Automation rule notifications */}
                  {automationLog.map(entry => (
                    <div key={entry.id} className="timeline-event">
                      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: '#6366f118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, border: '1.5px solid #6366f130' }}>⚡</div>
                      <div className="event-body" style={{ flex: 1, minWidth: 0 }}>
                        <div className="event-content" style={{ color: '#6366f1', fontWeight: 600 }}>Automação: {entry.rule}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{entry.message}</div>
                        <div className="event-time" style={{ fontSize: 10, marginTop: 2 }}>{fmtTs(entry.ts)}</div>
                      </div>
                    </div>
                  ))}
                  {notes.length === 0 && automationLog.length === 0 && isNew && (
                    <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
                      Nenhuma atividade ainda
                    </div>
                  )}
                  {notes.map(n => (
                    <div key={n.id} className="timeline-event" style={{ position: 'relative' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: '#f59e0b18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, border: '1.5px solid #f59e0b30' }}>💬</div>
                      <div className="event-body" style={{ flex: 1, minWidth: 0 }}>
                        <div className="event-content" style={{ whiteSpace: 'pre-wrap' }}>{n.content}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>👤 {n.actor || 'Usuário'}</span>
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>·</span>
                          <span className="event-time" style={{ fontSize: 10 }}>{fmtTs(n.created_at)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(n.id)}
                        style={{ position: 'absolute', top: 6, right: 0, background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 13, padding: 2, borderRadius: 3 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                        title="Excluir nota"
                      >×</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* History tab */}
            {rightTab === 'history' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                {!isNew && (
                  <div className="timeline-event">
                    <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: '#6366f118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, border: '1.5px solid #6366f130' }}>🆕</div>
                    <div className="event-body" style={{ flex: 1 }}>
                      <div className="event-content">Registro criado em {process.name}</div>
                      <div className="event-time" style={{ fontSize: 10, marginTop: 2 }}>{fmtTs(record.created_at)}</div>
                    </div>
                  </div>
                )}
                {isNew && (
                  <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
                    Histórico disponível após criação
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SPRecordCard ──────────────────────────────────────────────────────────────

function SPRecordCard({ record, process, onOpen }) {
  const fields = process.fields_config || [];

  const valueField = fields.find(f =>
    f.type === 'number' && /valor|price|preco|preço/i.test(f.key || f.label || '')
  );
  const valueRaw = valueField ? record.data?.[valueField.key] : null;
  const hasValue = valueRaw !== null && valueRaw !== undefined && valueRaw !== '';
  const fmtValue = v => {
    const n = parseFloat(v);
    if (isNaN(n)) return String(v);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  };

  const contactField = fields.find(f =>
    /responsavel|responsável|cliente|contato/i.test(f.key || f.label || '')
  );
  const contactVal = contactField ? record.data?.[contactField.key] : null;

  const extraFields = fields
    .filter(f => f !== valueField && f !== contactField)
    .map(f => ({ field: f, val: record.data?.[f.key] }))
    .filter(({ val }) => val !== null && val !== undefined && val !== '')
    .slice(0, 2);

  const links = record.links || [];

  const handleDragStart = (e) => {
    e.dataTransfer.setData('recordId', String(record.id));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className="card"
      draggable
      onDragStart={handleDragStart}
      onClick={() => onOpen && onOpen(record)}
    >
      <button
        className="card-open-btn"
        title="Abrir detalhes"
        onClick={e => { e.stopPropagation(); onOpen && onOpen(record); }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 11L11 1M11 1H5M11 1v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <div className="card-title">{record.title}</div>

      {valueField ? (
        hasValue
          ? <div className="card-price">{fmtValue(valueRaw)}</div>
          : <div className="card-price zero">Sem valor</div>
      ) : (
        extraFields.length > 0
          ? <div className="card-price zero">{extraFields[0].field.label}: {String(extraFields[0].val)}</div>
          : <div className="card-price zero">—</div>
      )}

      {contactVal && (
        <div className="card-contact">
          <IconPerson />
          {String(contactVal)}
        </div>
      )}

      {(() => {
        const toShow = valueField ? extraFields : extraFields.slice(1);
        if (!toShow.length) return null;
        return (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {toShow.map(({ field, val }) => (
              <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-secondary)' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', background: '#eef2ff', padding: '0px 4px', borderRadius: 3, flexShrink: 0, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.label}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{String(val)}</span>
              </div>
            ))}
          </div>
        );
      })()}

      <div className="card-divider" />

      <div className="card-footer">
        <div className="card-assignee">
          {record.assignee_name ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: '#f0fdf4', color: '#16a34a', borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>
              <IconPerson />
              {record.assignee_name}
            </span>
          ) : links.length > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: '#eff6ff', color: '#3b82f6', borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>
              <IconLink />
              {links.length} vínc.
            </span>
          ) : (
            <span style={{ fontSize: 11, color: '#cbd5e1', fontStyle: 'italic' }}>Sem vínculos</span>
          )}
        </div>
        <span className="card-date">{fmtDate(record.created_at)}</span>
      </div>
    </div>
  );
}

// ── SPKanbanColumn ────────────────────────────────────────────────────────────

function SPKanbanColumn({ stage, stageIndex, records, process, onAddRecord, onOpenRecord, onDropRecord }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const colRef = useRef(null);
  const stageColor = stage.color || '#94a3b8';
  const textColor = contrastColor(stageColor);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const id = e.dataTransfer.getData('recordId');
    if (id) onDropRecord(Number(id), stageIndex);
  };

  const handleSaveInline = () => {
    if (newTitle.trim()) {
      onAddRecord(stageIndex, newTitle.trim());
      setNewTitle('');
      setIsAdding(false);
    }
  };

  return (
    <div
      ref={colRef}
      className={`column-wrapper${isDragOver ? ' drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragEnter={e => e.preventDefault()}
      onDragLeave={e => { if (!colRef.current?.contains(e.relatedTarget)) setIsDragOver(false); }}
      onDrop={handleDrop}
    >
      <div
        className="column-header"
        style={{ background: stageColor, color: textColor, borderRadius: '8px 8px 0 0' }}
      >
        <span className="col-title" style={{ color: textColor }}>{stage.name}</span>
        {stage.is_terminal && (
          <span style={{
            fontSize: 9, fontWeight: 700,
            background: `rgba(${textColor === '#ffffff' ? '255,255,255' : '0,0,0'}, 0.25)`,
            color: textColor,
            borderRadius: 3, padding: '1px 5px', flexShrink: 0,
          }}>
            {stage.terminal_type === 'success' ? '✓ GANHO' : '✗ DESCARTADO'}
          </span>
        )}
        <span className="col-count" style={{
          background: `rgba(${textColor === '#ffffff' ? '255,255,255' : '0,0,0'}, 0.2)`,
          color: textColor,
        }}>{records.length}</span>
        <button
          className="col-add-stage-btn"
          title="Adicionar registro"
          style={{
            color: textColor,
            borderColor: `rgba(${textColor === '#ffffff' ? '255,255,255' : '0,0,0'}, 0.4)`,
            marginLeft: 'auto',
          }}
          onClick={() => setIsAdding(true)}
        >+</button>
      </div>

      <div className="column-body">
        {records.length === 0 && !isAdding && (
          <div style={{ textAlign: 'center', padding: '18px 0', color: '#cbd5e1', fontSize: 12, fontStyle: 'italic', userSelect: 'none' }}>
            Nenhum registro
          </div>
        )}

        {records.map(rec => (
          <SPRecordCard
            key={rec.id}
            record={rec}
            process={process}
            onOpen={onOpenRecord}
          />
        ))}

        {isAdding && (
          <div className="inline-form">
            <input
              autoFocus
              className="inline-input"
              placeholder="Título do registro"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveInline();
                if (e.key === 'Escape') { setIsAdding(false); setNewTitle(''); }
              }}
            />
            <div className="inline-actions">
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleSaveInline}>Salvar</button>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setIsAdding(false); setNewTitle(''); }}>✕</button>
            </div>
          </div>
        )}
      </div>

      <div className="quick-add-area">
        {!isAdding && (
          <button className="quick-add-btn" onClick={() => setIsAdding(true)}>+ Registro</button>
        )}
      </div>
    </div>
  );
}

// ── TableView ─────────────────────────────────────────────────────────────────

function TableView({ process, records, onEditRecord, onDeleteRecord, searchText, filterStage }) {
  const fields = process.fields_config || [];
  const filtered = records.filter(r => {
    const matchText = !searchText || r.title.toLowerCase().includes(searchText.toLowerCase());
    const matchStage = filterStage === '' || String(r.stage_index) === String(filterStage);
    return matchText && matchStage;
  });

  return (
    <div style={{ overflowX: 'auto', flex: 1 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 32 }}>#</th>
            <th style={S.th}>Título</th>
            <th style={S.th}>Etapa</th>
            {fields.map(f => <th key={f.key} style={S.th}>{f.label}</th>)}
            <th style={S.th}>Criado em</th>
            <th style={{ ...S.th, width: 80 }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={fields.length + 5} style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>
                {searchText ? 'Nenhum registro encontrado.' : 'Nenhum registro neste processo.'}
              </td>
            </tr>
          )}
          {filtered.map((rec, idx) => {
            const stage = (process.stages || [])[rec.stage_index];
            return (
              <tr
                key={rec.id}
                onClick={() => onEditRecord(rec)}
                style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ ...S.td, color: '#94a3b8', fontSize: 11 }}>{idx + 1}</td>
                <td style={S.td}><strong>{rec.title}</strong></td>
                <td style={S.td}>
                  {stage && (
                    <span style={{ display: 'inline-block', background: stage.color, color: contrastColor(stage.color), borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{stage.name}</span>
                  )}
                </td>
                {fields.map(f => <td key={f.key} style={S.td}>{rec.data?.[f.key] ?? <span style={{ color: '#cbd5e1' }}>—</span>}</td>)}
                <td style={{ ...S.td, fontSize: 11, color: '#94a3b8' }}>{fmtDate(rec.created_at)}</td>
                <td style={{ ...S.td, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => onEditRecord(rec)} style={{ ...S.iconBtn, color: '#64748b' }} title="Editar"><IconEdit /></button>
                  <button onClick={() => onDeleteRecord(rec)} style={{ ...S.iconBtn, color: '#ef4444' }} title="Excluir"><IconTrash /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── ProcessDropdown ───────────────────────────────────────────────────────────

function ProcessDropdown({ processes, selectedId, onSelect, onNewProcess }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = processes.find(p => p.id === selectedId);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px',
          border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg-secondary)',
          color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
          fontWeight: 600, transition: 'all 0.15s', minWidth: 160,
        }}
      >
        {selected ? (
          <>
            <span style={{ fontSize: 16 }}>{selected.icon}</span>
            <span style={{ flex: 1, textAlign: 'left' }}>{selected.name}</span>
          </>
        ) : (
          <span style={{ flex: 1, textAlign: 'left', color: 'var(--text-secondary)' }}>Selecionar processo</span>
        )}
        <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 300,
          background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, maxHeight: 320, overflowY: 'auto',
        }}>
          {processes.length === 0 && (
            <div style={{ padding: '16px 14px', color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center' }}>
              Nenhum processo criado ainda
            </div>
          )}
          {processes.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); setOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '9px 14px', background: selectedId === p.id ? hexToRgba(p.color || ACCENT, 0.08) : 'transparent',
                border: 'none', borderLeft: `3px solid ${selectedId === p.id ? (p.color || ACCENT) : 'transparent'}`,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (selectedId !== p.id) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
              onMouseLeave={e => { if (selectedId !== p.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{p.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: selectedId === p.id ? 700 : 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.record_count || 0} registros</div>
              </div>
            </button>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', padding: '6px 8px' }}>
            <button
              onClick={() => { onNewProcess(); setOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 10px', background: 'transparent', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                color: ACCENT, borderRadius: 6,
              }}
            >
              <IconPlus /> Novo processo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SmartProcessesView() {
  const [processes, setProcesses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [records, setRecords] = useState([]);
  const [viewMode, setViewMode] = useState('kanban');
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [editingProcess, setEditingProcess] = useState(null);
  const [showRecordPanel, setShowRecordPanel] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [defaultStageIndex, setDefaultStageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [users, setUsers] = useState([]);

  const selectedProcess = processes.find(p => p.id === selectedId) || null;

  useEffect(() => {
    fetch(`${API}/users`, { headers: authHeader() })
      .then(r => r.ok ? r.json() : [])
      .then(d => setUsers(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const loadProcesses = useCallback(async () => {
    try {
      const res = await fetch(`${API}/smart-processes`, { headers: authHeader() });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setProcesses(arr);
      if (!selectedId && arr.length > 0) setSelectedId(arr[0].id);
    } catch (e) { console.error('Erro ao carregar processos:', e); }
  }, [selectedId]);

  const loadRecords = useCallback(async (processId) => {
    if (!processId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/smart-processes/${processId}/records`, { headers: authHeader() });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Erro ao carregar registros:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProcesses(); }, []);

  useEffect(() => {
    if (selectedId) loadRecords(selectedId);
    else setRecords([]);
  }, [selectedId, loadRecords]);

  useEffect(() => {
    setSearchText(''); setFilterStage('');
  }, [selectedId]);

  // Handle cross-entity navigation from entity-reference chips
  useEffect(() => {
    const open = (e) => {
      const { entity_type, target_id, record_id } = e.detail || {};
      if (entity_type !== 'spa') return;
      if (target_id) setSelectedId(Number(target_id));
      if (record_id) {
        // Defer until after records are loaded
        const timer = setInterval(() => {
          setRecords(prev => {
            const rec = prev.find(r => r.id === Number(record_id));
            if (rec) {
              clearInterval(timer);
              setEditingRecord(rec);
              setDefaultStageIndex(rec.stage_index || 0);
              setShowRecordPanel(true);
            }
            return prev;
          });
        }, 150);
        setTimeout(() => clearInterval(timer), 5000);
      }
    };
    // Check if there's a pending entity stored before this component mounted
    const pending = window.__nexus_pending_entity;
    if (pending) {
      window.__nexus_pending_entity = null;
      open({ detail: pending });
    }
    window.addEventListener('nexus:open-entity', open);
    return () => window.removeEventListener('nexus:open-entity', open);
  }, []);

  const askConfirm = (message, onConfirm) => setConfirm({ message, onConfirm });

  const handleDeleteProcess = (proc) => {
    askConfirm(`Excluir o processo "${proc.name}"? Todos os registros serão removidos permanentemente.`, async () => {
      setConfirm(null);
      try {
        const res = await fetch(`${API}/smart-processes/${proc.id}`, { method: 'DELETE', headers: authHeader() });
        if (!res.ok) throw new Error(await res.text());
        if (selectedId === proc.id) setSelectedId(null);
        loadProcesses();
      } catch (e) { console.error('Erro:', e); }
    });
  };

  const handleDeleteRecord = (rec) => {
    askConfirm(`Excluir "${rec.title}"?`, async () => {
      setConfirm(null);
      try {
        const res = await fetch(`${API}/smart-processes/${selectedId}/records/${rec.id}`, { method: 'DELETE', headers: authHeader() });
        if (!res.ok) throw new Error(await res.text());
        setRecords(prev => prev.filter(r => r.id !== rec.id));
        loadProcesses();
      } catch (e) { console.error('Erro:', e); }
    });
  };

  const handleDropRecord = async (recordId, newStageIndex) => {
    const rec = records.find(r => r.id === recordId);
    if (!rec || rec.stage_index === newStageIndex) return;
    setRecords(prev => prev.map(r => r.id === recordId ? { ...r, stage_index: newStageIndex } : r));
    try {
      const res = await fetch(`${API}/smart-processes/${selectedId}/records/${recordId}`, {
        method: 'PUT', headers: authHeader(),
        body: JSON.stringify({ ...rec, stage_index: newStageIndex }),
      });
      if (!res.ok) setRecords(prev => prev.map(r => r.id === recordId ? { ...r, stage_index: rec.stage_index } : r));
    } catch {
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, stage_index: rec.stage_index } : r));
    }
  };

  const handleAddRecordInline = async (stageIdx, title) => {
    try {
      const res = await fetch(`${API}/smart-processes/${selectedId}/records`, {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify({ title, stage_index: stageIdx, data: {} }),
      });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();
      setRecords(prev => [...prev, saved]);
      loadProcesses();
    } catch (e) { console.error('Erro ao criar registro:', e); }
  };

  const openNewRecord = (stageIdx = 0) => {
    setEditingRecord(null); setDefaultStageIndex(stageIdx); setShowRecordPanel(true);
  };

  const openEditRecord = (rec) => {
    setEditingRecord(rec); setShowRecordPanel(true);
  };

  const handleRecordSaved = (saved) => {
    if (saved) {
      setRecords(prev => {
        const exists = prev.find(r => r.id === saved.id);
        return exists ? prev.map(r => r.id === saved.id ? saved : r) : [...prev, saved];
      });
    }
    loadProcesses();
    if (selectedId) loadRecords(selectedId);
  };

  const filteredRecords = records.filter(r => {
    const mt = !searchText || r.title.toLowerCase().includes(searchText.toLowerCase());
    const ms = filterStage === '' || String(r.stage_index) === String(filterStage);
    return mt && ms;
  });

  const [showFilter, setShowFilter] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--bg-primary)', overflow: 'hidden' }}>

      {/* ── Top header — mesma estrutura do Negócios ── */}
      <header className="top-header">
        <div className="header-left">
          {/* Process name as title + edit/delete icons */}
          {selectedProcess ? (
            <>
              <span className="header-title" style={{ color: selectedProcess.color || 'var(--text-primary)' }}>
                {selectedProcess.icon} {selectedProcess.name}
              </span>
              <button
                className="icon-btn"
                title="Configurar processo"
                onClick={() => { setEditingProcess(selectedProcess); setShowProcessModal(true); }}
              ><IconGear /></button>
              <button
                className="icon-btn"
                title="Excluir processo"
                style={{ color: '#ef4444' }}
                onClick={() => handleDeleteProcess(selectedProcess)}
              ><IconTrash /></button>
            </>
          ) : (
            <span className="header-title">Smart Processes</span>
          )}

          <div className="header-sep" />

          <div className="header-controls">
            <button
              className="btn btn-primary"
              style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={() => {
                if (!selectedProcess) { setEditingProcess(null); setShowProcessModal(true); }
                else openNewRecord(0);
              }}
            >
              <IconPlus /> {selectedProcess ? 'Novo registro' : 'Novo processo'}
            </button>

            {/* View toggle — Kanban / Tabela */}
            <div style={{ display: 'flex', background: '#f1f5f9', border: '1px solid var(--border)', borderRadius: 8, padding: 2 }}>
              {[['kanban', <IconKanban />, 'Kanban'], ['table', <IconTable />, 'Tabela']].map(([mode, icon, label]) => (
                <button key={mode} onClick={() => setViewMode(mode)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                  background: viewMode === mode ? 'white' : 'transparent',
                  color: viewMode === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  fontWeight: viewMode === mode ? 600 : 400,
                  transition: 'all 0.15s',
                }}>
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* Process selector dropdown — right side like pipeline dropdown */}
            <ProcessDropdown
              processes={processes}
              selectedId={selectedId}
              onSelect={id => setSelectedId(id)}
              onNewProcess={() => { setEditingProcess(null); setShowProcessModal(true); }}
            />
          </div>
        </div>
      </header>

      {/* ── Filter bar — igual ao Negócios (Filtro button + collapse) ── */}
      {selectedProcess && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 22px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-primary)', flexShrink: 0,
        }}>
          <button
            onClick={() => setShowFilter(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
              border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
              background: showFilter || searchText || filterStage !== '' ? 'var(--bg-secondary)' : 'transparent',
              color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'inherit', fontWeight: 500,
            }}
          >
            <IconSearch /> Filtro
            {(searchText || filterStage !== '') && (
              <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: '50%', width: 14, height: 14, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {[searchText, filterStage !== ''].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Inline filter controls */}
          {showFilter && (
            <>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', display: 'flex', pointerEvents: 'none' }}><IconSearch /></span>
                <input
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="Buscar registros..."
                  style={{ ...S.input, width: 200, height: 30, padding: '0 10px 0 28px', fontSize: 12 }}
                  autoFocus
                />
              </div>
              <select
                value={filterStage}
                onChange={e => setFilterStage(e.target.value)}
                style={{ ...S.input, height: 30, padding: '0 8px', fontSize: 12 }}
              >
                <option value="">Todas as etapas</option>
                {(selectedProcess.stages || []).map((s, i) => (
                  <option key={i} value={i}>{s.name}</option>
                ))}
              </select>
              {(searchText || filterStage !== '') && (
                <>
                  <button
                    onClick={() => { setSearchText(''); setFilterStage(''); }}
                    style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', color: 'var(--text-secondary)', fontFamily: 'inherit', background: 'transparent', cursor: 'pointer' }}
                  >
                    Limpar
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {filteredRecords.length} resultado{filteredRecords.length !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Empty state (no process selected) ── */}
      {!selectedProcess && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            background: `linear-gradient(135deg, ${ACCENT}, #f97316)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, marginBottom: 20, boxShadow: `0 8px 24px ${hexToRgba(ACCENT, 0.3)}`,
          }}>⚡</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>Smart Processes</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28, textAlign: 'center', maxWidth: 400, lineHeight: 1.7 }}>
            Crie processos personalizados com campos e etapas para organizar qualquer tipo de dado — contratos, veículos, imóveis e muito mais.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 28 }}>
            {[['📋', 'Contratos'], ['🚗', 'Veículos'], ['🏠', 'Imóveis'], ['📦', 'Pedidos'], ['🎯', 'Projetos']].map(([emoji, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                {emoji} {label}
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary"
            style={{ fontSize: 13, padding: '9px 22px', display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={() => { setEditingProcess(null); setShowProcessModal(true); }}
          >
            <IconPlus /> Criar primeiro processo
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {selectedProcess && loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
          Carregando registros...
        </div>
      )}

      {/* ── Table view ── */}
      {selectedProcess && !loading && viewMode === 'table' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TableView
            process={selectedProcess}
            records={records}
            onEditRecord={openEditRecord}
            onDeleteRecord={handleDeleteRecord}
            searchText={searchText}
            filterStage={filterStage}
          />
        </div>
      )}

      {/* ── Kanban — board-container filho DIRETO do flex column, igual App.jsx ── */}
      {selectedProcess && !loading && viewMode === 'kanban' && (
        <main className="board-container">
          {(selectedProcess.stages || []).map((stage, si) => {
            const colRecords = filteredRecords.filter(r => r.stage_index === si);
            return (
              <SPKanbanColumn
                key={si}
                stage={stage}
                stageIndex={si}
                records={colRecords}
                process={selectedProcess}
                onAddRecord={handleAddRecordInline}
                onOpenRecord={rec => openEditRecord(rec)}
                onDropRecord={handleDropRecord}
              />
            );
          })}
        </main>
      )}

      {/* Modals */}
      {showProcessModal && (
        <ProcessModal
          process={editingProcess}
          users={users}
          onClose={() => setShowProcessModal(false)}
          onSave={(saved) => {
            if (saved?.id) setSelectedId(saved.id);
            loadProcesses();
          }}
        />
      )}
      {showRecordPanel && selectedProcess && (
        <RecordPanel
          record={editingRecord}
          process={selectedProcess}
          defaultStageIndex={defaultStageIndex}
          users={users}
          onClose={() => setShowRecordPanel(false)}
          onSave={handleRecordSaved}
          onDelete={handleDeleteRecord}
        />
      )}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
