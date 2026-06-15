import React, { useState, useEffect } from 'react';

const API = 'http://localhost:8001';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {stages.map((s, i) => {
        const pct = Math.max((s.count / maxCount) * 100, s.count > 0 ? 8 : 0);
        const dropPct = i > 0 && stages[i - 1].count > 0
          ? Math.round((1 - s.count / stages[i - 1].count) * 100)
          : null;
        return (
          <div key={s.stage_id}>
            {dropPct !== null && dropPct > 0 && (
              <div style={{ textAlign: 'center', fontSize: 10, color: '#ef4444', marginBottom: 2 }}>
                ▼ {dropPct}% de perda
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 110, fontSize: 12, color: '#475569', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.stage_name}
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  width: `${pct}%`, minWidth: s.count > 0 ? 48 : 0,
                  background: s.color || '#6366f1',
                  borderRadius: 4, padding: '5px 10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  transition: 'width 0.5s ease',
                }}>
                  <span style={{ fontSize: 12, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.count}</span>
                  {pct > 30 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap' }}>{fmt(s.value)}</span>}
                </div>
              </div>
              <div style={{ width: 80, fontSize: 11, color: '#64748b', flexShrink: 0 }}>{fmt(s.value)}</div>
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

// ── Main component ────────────────────────────────────────────────────────────
export default function ReportsView() {
  const [summary,     setSummary]     = useState(null);
  const [funnel,      setFunnel]      = useState([]);
  const [bySource,    setBySource]    = useState([]);
  const [timeline,    setTimeline]    = useState([]);
  const [byResp,      setByResp]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activePipeline, setActivePipeline] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/reports/summary`).then(r => r.json()),
      fetch(`${API}/reports/funnel`).then(r => r.json()),
      fetch(`${API}/reports/by-source`).then(r => r.json()),
      fetch(`${API}/reports/timeline`).then(r => r.json()),
      fetch(`${API}/reports/by-responsible`).then(r => r.json()),
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
    </div>
  );
}
