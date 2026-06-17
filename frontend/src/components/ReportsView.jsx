import React, { useState, useEffect, useCallback } from 'react';

import { API_URL as API } from '../config.js';
import { useAuth } from '../AuthContext';

const fmt = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
const fmtN = (n) => new Intl.NumberFormat('pt-BR').format(n || 0);

// ── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = '#6366f1', icon }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6,
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b' }}>{sub}</div>}
    </div>
  );
}

// ── Horizontal bar chart ─────────────────────────────────────────────────────
function HBarChart({ data, valueKey = 'value', labelKey = 'label', colorKey, maxValue, formatter = fmtN }) {
  const max = maxValue || Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => {
        const pct = Math.max((d[valueKey] / max) * 100, d[valueKey] > 0 ? 2 : 0);
        const color = colorKey ? d[colorKey] : ['#6366f1','#8b5cf6','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899'][i % 7];
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 130, fontSize: 12, color: '#475569', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d[labelKey]}
            </div>
            <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 22, position: 'relative', overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%', background: color,
                borderRadius: 4, transition: 'width 0.5s ease',
                display: 'flex', alignItems: 'center', paddingLeft: 8,
              }}>
                {pct > 15 && <span style={{ fontSize: 11, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatter(d[valueKey])}</span>}
              </div>
              {pct <= 15 && (
                <span style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#475569', fontWeight: 600, paddingLeft: 6, whiteSpace: 'nowrap' }}>
                  {formatter(d[valueKey])}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Line / bar timeline chart (SVG) ─────────────────────────────────────────
function TimelineChart({ data }) {
  const W = 560, H = 180, PL = 50, PR = 20, PT = 16, PB = 30;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const maxVal = Math.max(...data.map(d => Math.max(d.cards, d.leads)), 1);
  const barW = Math.floor(cW / data.length * 0.35);
  const gap  = cW / data.length;

  const yLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {/* Y grid lines */}
      {yLines.map(t => (
        <line key={t} x1={PL} x2={W - PR} y1={PT + cH * (1 - t)} y2={PT + cH * (1 - t)}
          stroke="#e2e8f0" strokeWidth="1" strokeDasharray={t === 0 ? '0' : '3,3'} />
      ))}
      {yLines.slice(1).map(t => (
        <text key={t} x={PL - 6} y={PT + cH * (1 - t) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
          {Math.round(maxVal * t)}
        </text>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const cx = PL + gap * i + gap / 2;
        const hCards = d.cards > 0 ? Math.max((d.cards / maxVal) * cH, 4) : 0;
        const hLeads = d.leads > 0 ? Math.max((d.leads / maxVal) * cH, 4) : 0;
        return (
          <g key={i}>
            {/* Leads bar */}
            <rect x={cx - barW - 2} y={PT + cH - hLeads} width={barW} height={hLeads}
              rx="3" fill="#c7d2fe" />
            {/* Cards bar */}
            <rect x={cx + 2} y={PT + cH - hCards} width={barW} height={hCards}
              rx="3" fill="#6366f1" />
            {/* X label */}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">{d.month}</text>
          </g>
        );
      })}

      {/* Legend */}
      <rect x={W - PR - 110} y={PT} width={10} height={10} rx="2" fill="#c7d2fe" />
      <text x={W - PR - 96} y={PT + 9} fontSize="10" fill="#64748b">Leads</text>
      <rect x={W - PR - 60} y={PT} width={10} height={10} rx="2" fill="#6366f1" />
      <text x={W - PR - 46} y={PT + 9} fontSize="10" fill="#64748b">Negócios</text>
    </svg>
  );
}

// ── Funnel chart ──────────────────────────────────────────────────────────────
function FunnelChart({ stages }) {
  if (!stages || stages.length === 0) return <div style={{ color: '#94a3b8', fontSize: 13 }}>Sem dados</div>;

  const maxCount = Math.max(...stages.map(s => s.count), 1);
  const COLORS = ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe','#ede9fe'];
  const isWon  = (name) => /ganho|sucesso|conver/i.test(name);
  const isLost = (name) => /perdi|desqual/i.test(name);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {stages.map((s, i) => {
        const widthPct = Math.max((s.count / maxCount) * 100, s.count > 0 ? 12 : 4);
        const prevCount = i > 0 ? stages[i - 1].count : null;
        const convPct = prevCount != null && prevCount > 0
          ? Math.round((s.count / prevCount) * 100) : null;
        const dropPct = convPct != null ? 100 - convPct : null;

        const color = isWon(s.stage_name) ? '#10b981'
                    : isLost(s.stage_name) ? '#ef4444'
                    : (s.color || COLORS[i % COLORS.length]);

        return (
          <div key={s.stage_id}>
            {/* Drop indicator between stages */}
            {dropPct !== null && dropPct > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '4px 0', marginLeft: 140 }}>
                <div style={{ flex: 1, maxWidth: 240, height: 1, background: '#f1f5f9' }} />
                <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                  ↓ {dropPct}% saíram
                </span>
                <div style={{ flex: 1, maxWidth: 240, height: 1, background: '#f1f5f9' }} />
              </div>
            )}
            {/* Stage row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '3px 0' }}>
              {/* Label */}
              <div style={{ width: 128, flexShrink: 0, textAlign: 'right' }}>
                <span style={{ fontSize: 12, color: '#475569', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                  title={s.stage_name}>{s.stage_name}</span>
              </div>
              {/* Bar */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative', minWidth: 0 }}>
                <div style={{
                  width: `${widthPct}%`, height: 36,
                  background: `linear-gradient(135deg, ${color}dd, ${color})`,
                  borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0 12px', gap: 8, boxShadow: `0 2px 6px ${color}33`,
                  transition: 'width 0.5s ease',
                  minWidth: s.count > 0 ? 44 : 8,
                  overflow: 'hidden',
                }}>
                  <span style={{ fontSize: 13, color: 'white', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {s.count}
                  </span>
                  {widthPct > 28 && (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap' }}>
                      {fmt(s.value)}
                    </span>
                  )}
                </div>
              </div>
              {/* Right: value + conversion */}
              <div style={{ width: 110, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                <span style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>{fmt(s.value)}</span>
                {convPct !== null && (
                  <span style={{ fontSize: 10, color: convPct >= 50 ? '#10b981' : convPct >= 25 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
                    {convPct}% conv.
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children, action }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Donut chart (conversão de leads) ────────────────────────────────────────
function DonutChart({ rate, label, color = '#10b981' }) {
  const R = 50, cx = 60, cy = 60;
  const circ = 2 * Math.PI * R;
  const dash = (rate / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="700" fill="#1e293b">{rate}%</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#94a3b8">{label}</text>
      </svg>
    </div>
  );
}

// ── Export section ────────────────────────────────────────────────────────────
const EXPORT_ENTITIES = [
  { value: 'cards',     label: 'Negócios',  icon: '💼' },
  { value: 'leads',     label: 'Leads',     icon: '🎯' },
  { value: 'contacts',  label: 'Contatos',  icon: '👤' },
  { value: 'companies', label: 'Empresas',  icon: '🏢' },
];

function FieldCheckbox({ field, checked, onChange }) {
  const isCustom = field.key.startsWith('cf:');
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
      padding: '5px 8px', borderRadius: 6, transition: 'background .1s',
      background: checked ? (isCustom ? '#fef3c7' : '#eef2ff') : 'transparent',
      border: `1px solid ${checked ? (isCustom ? '#fde68a' : '#c7d2fe') : '#e2e8f0'}`,
    }}>
      <input type="checkbox" checked={checked} onChange={onChange}
        style={{ accentColor: isCustom ? '#f59e0b' : '#6366f1', cursor: 'pointer', width: 13, height: 13 }} />
      <span style={{ fontSize: 12, color: '#334155', userSelect: 'none' }}>{field.label}</span>
      {isCustom && (
        <span style={{ fontSize: 10, color: '#92400e', background: '#fef3c7',
          padding: '1px 4px', borderRadius: 3, fontWeight: 600 }}>custom</span>
      )}
    </label>
  );
}

function ExportSection({ pipelines, token }) {
  const [entity,       setEntity]       = useState('cards');
  const [fmt,          setFmt]          = useState('xlsx');
  const [pipelineId,   setPipelineId]   = useState(0);
  const [loading,      setLoading]      = useState(false);
  const [msg,          setMsg]          = useState(null);
  const [fields,       setFields]       = useState({ native: [], custom: [], defaults: [] });
  const [selected,     setSelected]     = useState(new Set());
  const [showCols,     setShowCols]     = useState(false);
  const [loadingCols,  setLoadingCols]  = useState(false);

  // Load available fields whenever entity changes
  useEffect(() => {
    setLoadingCols(true);
    fetch(`${API}/reports/export-fields?entity=${entity}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => {
        setFields(data);
        setSelected(new Set(data.defaults || []));
      })
      .catch(() => {})
      .finally(() => setLoadingCols(false));
  }, [entity, token]);

  const toggleField = (key) => setSelected(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const selectAll   = () => setSelected(new Set([...fields.native, ...fields.custom].map(f => f.key)));
  const selectNone  = () => setSelected(new Set());
  const selectDefault = () => setSelected(new Set(fields.defaults || []));

  const handleExport = async () => {
    if (selected.size === 0) {
      setMsg({ type: 'err', text: 'Selecione pelo menos uma coluna.' });
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      // Preserve the order: native fields first (in their defined order), then custom fields
      const allKeys = [...fields.native.map(f => f.key), ...fields.custom.map(f => f.key)];
      const orderedCols = allKeys.filter(k => selected.has(k)).join(',');
      const params = new URLSearchParams({ entity, fmt, pipeline_id: pipelineId, columns: orderedCols });
      const res = await fetch(`${API}/reports/export?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const disp = res.headers.get('Content-Disposition') || '';
      const match = disp.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match ? match[1] : `export.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({ type: 'ok', text: `${selected.size} colunas exportadas!` });
    } catch (e) {
      setMsg({ type: 'err', text: e.message || 'Erro ao exportar' });
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const showPipelineFilter = entity === 'cards' || entity === 'leads';
  const totalFields = fields.native.length + fields.custom.length;

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Exportar dados</h3>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Escolha as colunas, formato e baixe em CSV ou Excel</p>
      </div>

      {/* Row 1: entity / format / pipeline / download */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>O que exportar</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {EXPORT_ENTITIES.map(e => (
              <button key={e.value} onClick={() => setEntity(e.value)} style={{
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                fontWeight: entity === e.value ? 700 : 400,
                border: `1.5px solid ${entity === e.value ? '#6366f1' : '#e2e8f0'}`,
                background: entity === e.value ? '#eef2ff' : '#fafafa',
                color: entity === e.value ? '#4338ca' : '#64748b',
                transition: 'all .15s',
              }}>{e.icon} {e.label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Formato</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ v: 'xlsx', l: '📊 Excel' }, { v: 'csv', l: '📄 CSV' }].map(f => (
              <button key={f.v} onClick={() => setFmt(f.v)} style={{
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                fontWeight: fmt === f.v ? 700 : 400,
                border: `1.5px solid ${fmt === f.v ? '#10b981' : '#e2e8f0'}`,
                background: fmt === f.v ? '#f0fdf4' : '#fafafa',
                color: fmt === f.v ? '#059669' : '#64748b',
                transition: 'all .15s',
              }}>{f.l}</button>
            ))}
          </div>
        </div>

        {showPipelineFilter && pipelines.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Funil</label>
            <select value={pipelineId} onChange={e => setPipelineId(Number(e.target.value))} style={{
              padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0',
              fontSize: 12, color: '#1e293b', background: '#fafafa', fontFamily: 'inherit', cursor: 'pointer',
            }}>
              <option value={0}>Todos</option>
              {pipelines.map(p => <option key={p.pipeline_id} value={p.pipeline_id}>{p.pipeline_name}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'transparent' }}>.</label>
          <button onClick={handleExport} disabled={loading || selected.size === 0} style={{
            padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            background: loading || selected.size === 0 ? '#94a3b8' : '#6366f1', color: '#fff',
            border: 'none', cursor: loading || selected.size === 0 ? 'not-allowed' : 'pointer',
            transition: 'background .15s', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {loading ? '⏳ Exportando...' : `⬇ Baixar (${selected.size} col.)`}
          </button>
        </div>
      </div>

      {/* Row 2: column selector toggle */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
        <button onClick={() => setShowCols(v => !v)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12, color: '#6366f1', fontWeight: 600, padding: 0,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {showCols ? '▲' : '▼'} Configurar colunas
          <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 4 }}>
            {loadingCols ? 'carregando...' : `${selected.size} de ${totalFields} selecionadas`}
          </span>
        </button>

        {showCols && !loadingCols && (
          <div style={{ marginTop: 12 }}>
            {/* Quick actions */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Selecionar tudo', fn: selectAll },
                { label: 'Limpar', fn: selectNone },
                { label: 'Padrão', fn: selectDefault },
              ].map(({ label, fn }) => (
                <button key={label} onClick={fn} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                  background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569',
                  fontFamily: 'inherit',
                }}>{label}</button>
              ))}
            </div>

            {/* Native fields */}
            {fields.native.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: 8 }}>Campos nativos</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {fields.native.map(f => (
                    <FieldCheckbox key={f.key} field={f} checked={selected.has(f.key)}
                      onChange={() => toggleField(f.key)} />
                  ))}
                </div>
              </div>
            )}

            {/* Custom fields */}
            {fields.custom.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: 8 }}>Campos customizados</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {fields.custom.map(f => (
                    <FieldCheckbox key={f.key} field={f} checked={selected.has(f.key)}
                      onChange={() => toggleField(f.key)} />
                  ))}
                </div>
              </div>
            )}

            {fields.custom.length === 0 && (
              <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                Nenhum campo customizado criado para esta entidade.
                Crie em <b>Configurações → Campos personalizados</b>.
              </div>
            )}
          </div>
        )}
      </div>

      {msg && (
        <div style={{
          marginTop: 12, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
          color: msg.type === 'ok' ? '#059669' : '#dc2626',
          border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
          display: 'inline-block',
        }}>
          {msg.type === 'ok' ? '✓ ' : '✕ '}{msg.text}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ReportsView() {
  const { token } = useAuth();
  const [summary,     setSummary]     = useState(null);
  const [funnel,      setFunnel]      = useState([]);
  const [bySource,    setBySource]    = useState([]);
  const [timeline,    setTimeline]    = useState([]);
  const [byResp,      setByResp]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activePipeline, setActivePipeline] = useState(null);

  const authFetch = useCallback((url) => {
    return fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  }, [token]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      authFetch(`${API}/reports/summary`).then(r => r.json()),
      authFetch(`${API}/reports/funnel`).then(r => r.json()),
      authFetch(`${API}/reports/by-source`).then(r => r.json()),
      authFetch(`${API}/reports/timeline`).then(r => r.json()),
      authFetch(`${API}/reports/by-responsible`).then(r => r.json()),
    ]).then(([s, f, src, tl, resp]) => {
      setSummary(s);
      setFunnel(f);
      setBySource(src);
      setTimeline(tl);
      setByResp(resp);
      if (f.length > 0) setActivePipeline(f[0].pipeline_id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const activeFunnelData = funnel.find(f => f.pipeline_id === activePipeline);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 14 }}>
        Carregando relatórios...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Relatórios</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>Visão geral de vendas e desempenho do funil</p>
      </div>

      {/* Summary metrics */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          <MetricCard label="Negócios" value={fmtN(summary.total_cards)} icon="💼" color="#6366f1" sub={`Valor total: ${fmt(summary.total_value)}`} />
          <MetricCard label="Valor médio" value={fmt(summary.avg_deal_value)} icon="💰" color="#10b981" sub="por negócio" />
          <MetricCard label="Ganhos" value={fmtN(summary.won_cards)} icon="🏆" color="#f59e0b" sub={`${summary.win_rate}% de win rate`} />
          <MetricCard label="Leads" value={fmtN(summary.total_leads)} icon="👤" color="#0ea5e9" sub={`${summary.lead_conversion_rate}% convertidos`} />
          <MetricCard label="Receita ganha" value={fmt(summary.won_value)} icon="✅" color="#10b981" sub="negócios concluídos" />
        </div>
      )}

      {/* Row 1: Funnel + Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16, marginBottom: 16 }}>
        <Section
          title="Funil de vendas"
          action={
            <div style={{ display: 'flex', gap: 4 }}>
              {funnel.map(p => (
                <button key={p.pipeline_id} onClick={() => setActivePipeline(p.pipeline_id)} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1.5px solid ${activePipeline === p.pipeline_id ? '#6366f1' : '#e2e8f0'}`,
                  background: activePipeline === p.pipeline_id ? '#eef2ff' : 'white',
                  color: activePipeline === p.pipeline_id ? '#4338ca' : '#64748b',
                  fontWeight: activePipeline === p.pipeline_id ? 700 : 400,
                }}>
                  {p.pipeline_name}
                </button>
              ))}
            </div>
          }
        >
          {activeFunnelData ? (
            <FunnelChart stages={activeFunnelData.stages} />
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Nenhum pipeline encontrado</div>
          )}
        </Section>

        <Section title="Conversão de leads">
          {summary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <DonutChart rate={summary.lead_conversion_rate} label="convertidos" color="#10b981" />
              <div style={{ width: '100%', fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total de leads</span><b style={{ color: '#1e293b' }}>{fmtN(summary.total_leads)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Convertidos</span><b style={{ color: '#10b981' }}>{fmtN(summary.leads_converted)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Não convertidos</span><b style={{ color: '#94a3b8' }}>{fmtN(summary.total_leads - summary.leads_converted)}</b>
                </div>
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* Row 2: Timeline */}
      <div style={{ marginBottom: 16 }}>
        <Section title="Novos negócios e leads — últimos 6 meses">
          {timeline.length > 0 ? <TimelineChart data={timeline} /> : <div style={{ color: '#94a3b8', fontSize: 13 }}>Sem dados no período</div>}
        </Section>
      </div>

      {/* Row 3: By source + By responsible */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Section title="Negócios por fonte">
          {bySource.length > 0 ? (
            <HBarChart
              data={bySource.map(s => ({ label: s.source, value: s.cards }))}
              labelKey="label" valueKey="value"
              formatter={v => `${v} neg.`}
            />
          ) : <div style={{ color: '#94a3b8', fontSize: 13 }}>Sem dados</div>}
        </Section>

        <Section title="Receita por fonte">
          {bySource.filter(s => s.cards_value > 0).length > 0 ? (
            <HBarChart
              data={bySource.filter(s => s.cards_value > 0).map(s => ({ label: s.source, value: s.cards_value }))}
              labelKey="label" valueKey="value"
              formatter={fmt}
            />
          ) : <div style={{ color: '#94a3b8', fontSize: 13 }}>Nenhum negócio com valor cadastrado por fonte</div>}
        </Section>
      </div>

      {/* Row 4: By responsible */}
      {byResp.filter(r => r.cards > 0).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Section title="Ranking de responsáveis">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {byResp.filter(r => r.cards > 0).slice(0, 6).map((r, i) => (
                <div key={r.user_id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: '#f8fafc', borderRadius: 10, padding: '10px 14px',
                  border: '1px solid #f1f5f9',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: ['#eef2ff','#fef3c7','#dcfce7','#fce7f3','#e0f2fe','#f3e8ff'][i % 6],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: ['#4338ca','#92400e','#166534','#9d174d','#075985','#6b21a8'][i % 6],
                  }}>
                    {r.user_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.user_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{r.cards} neg. · {fmt(r.value)}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', flexShrink: 0 }}>#{i + 1}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Export */}
      <div style={{ marginBottom: 16 }}>
        <ExportSection pipelines={funnel} token={token} />
      </div>
    </div>
  );
}
