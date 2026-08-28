import React, { useState, useEffect } from 'react';

import { API_URL as API } from '../config.js';

const ENTITY_LABELS = {
  cards:     { label: 'Negócios', color: '#6366f1' },
  leads:     { label: 'Leads',    color: '#8b5cf6' },
  contacts:  { label: 'Contatos', color: '#10b981' },
  companies: { label: 'Empresas', color: '#f59e0b' },
};

const ALL_ENTITIES = Object.keys(ENTITY_LABELS);

const ALL_EVENTS = [
  { key: 'card.created',    label: 'Negócio criado',     entity: 'cards' },
  { key: 'card.updated',    label: 'Negócio atualizado', entity: 'cards' },
  { key: 'card.moved',      label: 'Negócio movido',     entity: 'cards' },
  { key: 'card.deleted',    label: 'Negócio excluído',   entity: 'cards' },
  { key: 'lead.created',    label: 'Lead criado',        entity: 'leads' },
  { key: 'lead.updated',    label: 'Lead atualizado',    entity: 'leads' },
  { key: 'lead.moved',      label: 'Lead movido',        entity: 'leads' },
  { key: 'lead.converted',  label: 'Lead convertido',    entity: 'leads' },
  { key: 'lead.deleted',    label: 'Lead excluído',      entity: 'leads' },
  { key: 'contact.created', label: 'Contato criado',     entity: 'contacts' },
  { key: 'contact.updated', label: 'Contato atualizado', entity: 'contacts' },
  { key: 'company.created', label: 'Empresa criada',     entity: 'companies' },
  { key: 'company.updated', label: 'Empresa atualizada', entity: 'companies' },
];

const ALL_METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

const ENTITY_ENDPOINTS = {
  cards:     ['POST /cards', 'GET /cards', 'GET /cards/{id}', 'PUT /cards/{id}', 'DELETE /cards/{id}', 'PUT /cards/{id}/move', 'POST /cards/{id}/activities'],
  leads:     ['POST /leads', 'GET /leads', 'GET /leads/{id}', 'PUT /leads/{id}', 'DELETE /leads/{id}', 'PUT /leads/{id}/move', 'POST /leads/{id}/convert', 'POST /leads/{id}/activities'],
  contacts:  ['POST /contacts', 'GET /contacts', 'GET /contacts/{id}', 'PUT /contacts/{id}'],
  companies: ['POST /companies', 'GET /companies', 'GET /companies/{id}', 'PUT /companies/{id}', 'DELETE /companies/{id}'],
};

const ACCENT = '#ed5418';

// """ Icons """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconCopy = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <rect x="4" y="4" width="8" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M3 9H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);

const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M9.5 1.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M2 3.5h9M5 3.5V2.5h3v1M4.5 3.5l.5 7h3l.5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// """ Small helpers """"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

function TagBadge({ label, color }) {
  return (
    <span style={{
      background: color + '18', color, border: `1px solid ${color}40`,
      borderRadius: 4, padding: '1px 7px', fontSize: 13, fontWeight: 600,
      display: 'inline-block',
    }}>{label}</span>
  );
}

function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width: 32, height: 18, borderRadius: 9,
      background: value ? ACCENT : '#e2e8f0',
      position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0,
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: '50%', background: 'white',
        position: 'absolute', top: 2, left: value ? 16 : 2, transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </div>
  );
}

function MultiCheckbox({ options, value, onChange, renderLabel, colors }) {
  const allSelected = options.every(o => value.includes(o));
  const someSelected = options.some(o => value.includes(o)) && !allSelected;

  const toggle = (key) => {
    const set = new Set(value);
    set.has(key) ? set.delete(key) : set.add(key);
    onChange([...set]);
  };

  const toggleAll = () => {
    if (allSelected) {
      onChange(value.filter(v => !options.includes(v)));
    } else {
      const set = new Set([...value, ...options]);
      onChange([...set]);
    }
  };

  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={allSelected}
          ref={el => { if (el) el.indeterminate = someSelected; }}
          onChange={toggleAll}
          style={{ accentColor: ACCENT, width: 13, height: 13 }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
          {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
        </span>
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', paddingLeft: 4 }}>
        {options.map(opt => (
          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)}
              style={{ accentColor: ACCENT, width: 13, height: 13 }} />
            {renderLabel ? renderLabel(opt) : opt}
          </label>
        ))}
      </div>
    </div>
  );
}

const METHOD_COLORS = {
  GET: '#10b981',
  POST: ACCENT,
  PUT: '#f59e0b',
  DELETE: '#ef4444',
};

// ─── Outbound Guide + Tester ──────────────────────────────────────────────────

const EVENT_PAYLOADS = {
  'card.created': {
    label: 'Negócio criado',
    payload: { event: 'card.created', timestamp: '2024-06-14T10:00:00Z', data: { id: 42, title: 'Proposta ACME', price: 5000, stage_id: 2, pipeline_id: 1, created_at: '2024-06-14T10:00:00Z' } }
  },
  'card.updated': {
    label: 'Negócio atualizado',
    payload: { event: 'card.updated', timestamp: '2024-06-14T10:05:00Z', data: { id: 42, title: 'Proposta ACME (revisada)', price: 7500, stage_id: 2, changed_fields: ['title', 'price'] } }
  },
  'card.moved': {
    label: 'Negócio movido de etapa',
    payload: { event: 'card.moved', timestamp: '2024-06-14T10:10:00Z', data: { id: 42, title: 'Proposta ACME', from_stage_id: 2, to_stage_id: 3, from_stage_name: 'Negociação', to_stage_name: 'Proposta' } }
  },
  'card.deleted': {
    label: 'Negócio excluído',
    payload: { event: 'card.deleted', timestamp: '2024-06-14T10:15:00Z', data: { id: 42, title: 'Proposta ACME' } }
  },
  'lead.created': {
    label: 'Lead criado',
    payload: { event: 'lead.created', timestamp: '2024-06-14T11:00:00Z', data: { id: 7, title: 'João da Silva', phone: '+5511999999999', email: 'joao@email.com', source: 'site', stage_id: 1 } }
  },
  'lead.updated': {
    label: 'Lead atualizado',
    payload: { event: 'lead.updated', timestamp: '2024-06-14T11:05:00Z', data: { id: 7, title: 'João da Silva', changed_fields: ['phone', 'email'] } }
  },
  'lead.moved': {
    label: 'Lead movido',
    payload: { event: 'lead.moved', timestamp: '2024-06-14T11:10:00Z', data: { id: 7, from_stage_name: 'Novo Lead', to_stage_name: 'Qualificação' } }
  },
  'lead.converted': {
    label: 'Lead convertido',
    payload: { event: 'lead.converted', timestamp: '2024-06-14T11:20:00Z', data: { id: 7, converted_to: { deal_id: 43, contact_id: 18, company_id: 5 } } }
  },
  'lead.deleted': {
    label: 'Lead excluído',
    payload: { event: 'lead.deleted', timestamp: '2024-06-14T11:30:00Z', data: { id: 7, title: 'João da Silva' } }
  },
  'contact.created': {
    label: 'Contato criado',
    payload: { event: 'contact.created', timestamp: '2024-06-14T12:00:00Z', data: { id: 18, first_name: 'Maria', last_name: 'Souza', email: 'maria@empresa.com', phone: '+5511988888888' } }
  },
  'contact.updated': {
    label: 'Contato atualizado',
    payload: { event: 'contact.updated', timestamp: '2024-06-14T12:05:00Z', data: { id: 18, first_name: 'Maria', changed_fields: ['email'] } }
  },
  'company.created': {
    label: 'Empresa criada',
    payload: { event: 'company.created', timestamp: '2024-06-14T13:00:00Z', data: { id: 5, name: 'ACME Corp', email: 'contato@acme.com' } }
  },
  'company.updated': {
    label: 'Empresa atualizada',
    payload: { event: 'company.updated', timestamp: '2024-06-14T13:05:00Z', data: { id: 5, name: 'ACME Corp', changed_fields: ['email'] } }
  },
};

function OutboundGuide({ form, webhookId }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const activeEvents = form.events.length > 0
    ? form.events
    : ALL_EVENTS.filter(e => form.allowed_entities.length === 0 || form.allowed_entities.includes(e.entity)).map(e => e.key);

  const current = selectedEvent ? EVENT_PAYLOADS[selectedEvent] : null;
  const payloadStr = current ? JSON.stringify(current.payload, null, 2) : '';

  const runTest = async () => {
    if (!webhookId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem('nexus_token');
      const res = await fetch(`${API}/webhooks/${webhookId}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // normalize: old backend returns {ok, message}, new returns {success, status_code, ...}
      setTestResult({ ...data, success: data.success ?? data.ok ?? false });
    } catch (e) {
      setTestResult({ success: false, error: String(e) });
    }
    setTesting(false);
  };

  const copyPayload = () => {
    navigator.clipboard.writeText(payloadStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (form.allowed_entities.length === 0 && form.events.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 15, textAlign: 'center', padding: 24 }}>
        Selecione entidades ou eventos<br />para ver os payloads de exemplo
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Event list */}
      <div style={{ overflowY: 'auto', maxHeight: 220, borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
        {ALL_ENTITIES
          .filter(e => form.allowed_entities.length === 0 || form.allowed_entities.includes(e))
          .map(entity => {
            const evs = activeEvents.filter(ek => ALL_EVENTS.find(e => e.key === ek && e.entity === entity));
            if (evs.length === 0) return null;
            return (
              <div key={entity}>
                <div style={{ padding: '5px 16px', fontSize: 12, fontWeight: 700, color: ENTITY_LABELS[entity].color, textTransform: 'uppercase', letterSpacing: '.06em', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                  {ENTITY_LABELS[entity].label}
                </div>
                {evs.map(ek => {
                  const meta = EVENT_PAYLOADS[ek];
                  const isActive = selectedEvent === ek;
                  return (
                    <div key={ek} onClick={() => { setSelectedEvent(ek); setTestResult(null); }}
                      style={{ padding: '8px 16px', cursor: 'pointer', background: isActive ? '#eef2ff' : 'white', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? '#6366f1' : '#cbd5e1', flexShrink: 0 }} />
                      <span style={{ fontSize: 14, color: isActive ? '#4338ca' : '#334155', fontWeight: isActive ? 600 : 400 }}>
                        {meta?.label || ek}
                      </span>
                      <code style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto', fontFamily: 'monospace' }}>{ek}</code>
                    </div>
                  );
                })}
              </div>
            );
          })}
      </div>

      {/* Payload preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '12px 16px', gap: 10 }}>
        {!selectedEvent ? (
          <div style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 24 }}>
            Clique em um evento para ver o payload
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Payload enviado pelo CRM</span>
              <button onClick={copyPayload} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconCopy /> {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <pre style={{
              flex: 1, margin: 0, padding: '10px 12px', fontSize: 13, fontFamily: 'monospace',
              background: '#0f172a', color: '#a5f3fc', borderRadius: 8, overflowY: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6,
            }}>{payloadStr}</pre>

            {/* Test button */}
            {webhookId && form.url && (
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
                  URL destino: <code style={{ color: '#334155', fontFamily: 'monospace' }}>{form.url}</code>
                </div>
                <button onClick={runTest} disabled={testing} style={{
                  width: '100%', background: testing ? '#e2e8f0' : ACCENT,
                  color: testing ? '#94a3b8' : 'white', border: 'none', borderRadius: 7,
                  padding: '9px 0', fontWeight: 700, fontSize: 15,
                  cursor: testing ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  {testing ? '⏳ Testando...' : '▶ Disparar teste agora'}
                </button>
                {testResult && (
                  <div style={{ marginTop: 8, border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`, borderRadius: 7, overflow: 'hidden' }}>
                    <div style={{ padding: '6px 12px', background: testResult.success ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: testResult.success ? '#16a34a' : '#dc2626' }}>
                        {testResult.success ? '✅ Sucesso' : '❌ Falhou'}
                      </span>
                      {testResult.status_code && <span style={{ fontSize: 13, color: '#64748b' }}>HTTP {testResult.status_code}</span>}
                      {testResult.latency_ms && <span style={{ fontSize: 13, color: '#94a3b8' }}>{testResult.latency_ms}ms</span>}
                      <button onClick={() => setTestResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}>×</button>
                    </div>
                    {!testResult.success && (
                      <div style={{ padding: '6px 12px', fontSize: 13, color: '#991b1b', background: '#fef2f2', lineHeight: 1.5 }}>
                        {testResult.status_code === 404
                          ? '⚠️ URL retornou 404 — se estiver usando n8n, clique em "Listen for test event" no nó Webhook ANTES de disparar o teste.'
                          : testResult.error || 'Erro desconhecido ao disparar o webhook.'}
                      </div>
                    )}
                    {testResult.success && testResult.status_code && (
                      <div style={{ padding: '6px 12px', fontSize: 13, color: '#166534', background: '#f0fdf4' }}>
                        Resposta: {testResult.status_code} — a URL recebeu o payload com sucesso.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {webhookId && !form.url && (
              <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>Salve o webhook com uma URL para poder testar</div>
            )}
            {!webhookId && (
              <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>Crie o webhook primeiro para poder testar</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Endpoint Tester ──────────────────────────────────────────────────────────

const ENDPOINT_BODIES = {
  'POST /cards':    '{\n  "title": "Novo neg\u00f3cio",\n  "price": 1500,\n  "stage_id": 1,\n  "custom_fields": {\n    "categoria": "B2B",\n    "contrato_assinado": "true"\n  }\n}',
  'PUT /cards/{id}':'{\n  "title": "Neg\u00f3cio atualizado",\n  "price": 2000,\n  "custom_fields": {\n    "categoria": "B2C"\n  }\n}',
  'POST /leads':    '{\n  "title": "Novo lead",\n  "first_name": "Jo\u00e3o",\n  "email": "joao@email.com",\n  "custom_fields": {\n    "origem_detalhada": "Google Ads"\n  }\n}',
  'PUT /leads/{id}':'{\n  "title": "Lead atualizado",\n  "custom_fields": {\n    "origem_detalhada": "Indica\u00e7\u00e3o"\n  }\n}',
  'POST /contacts': '{\n  "first_name": "Maria",\n  "email": "maria@email.com",\n  "phone": "+5511999999999"\n}',
  'POST /companies':'{\n  "name": "Acme Corp",\n  "email": "contato@acme.com"\n}',
};

function EndpointTester({ entities, token }) {
  const allEndpoints = entities.flatMap(ent =>
    (ENTITY_ENDPOINTS[ent] || []).map(ep => {
      const [method, path] = ep.split(' ');
      return { method, path, entity: ent, label: ep };
    })
  );

  const [selected, setSelected] = useState(allEndpoints[0] || null);
  const [pathParam, setPathParam] = useState('1');
  const [body, setBody] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  // when selection changes, pre-fill body
  const selectEndpoint = (ep) => {
    setSelected(ep);
    setResult(null);
    const bodyKey = `${ep.method} ${ep.path}`;
    setBody(ENDPOINT_BODIES[bodyKey] || '');
  };

  const needsId = selected?.path?.includes('{id}');
  const needsBody = ['POST', 'PUT', 'PATCH'].includes(selected?.method);

  const resolvedPath = selected ? selected.path.replace('{id}', pathParam || '1') : '';
  // Strip the entity prefix from path (e.g. /cards/1 → /1 for entity=cards)
  const entityPrefix = selected ? `/${selected.entity}` : '';
  const pathSuffix = resolvedPath.startsWith(entityPrefix) ? resolvedPath.slice(entityPrefix.length) : resolvedPath;
  const fullUrl = token
    ? `${API}/webhook/in/${token}/${selected?.entity}${pathSuffix}`
    : `${API}${resolvedPath}`;

  const run = async () => {
    if (!selected) return;
    setRunning(true);
    setResult(null);
    const t0 = Date.now();
    try {
      const opts = {
        method: selected.method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (token) opts.headers['X-Webhook-Token'] = token;
      if (needsBody && body.trim()) opts.body = body;
      const res = await fetch(fullUrl, opts);
      const latency = Date.now() - t0;
      let data;
      try { data = await res.json(); } catch { data = await res.text(); }
      setResult({ ok: res.ok, status: res.status, latency, data });
    } catch (e) {
      setResult({ ok: false, status: 0, latency: Date.now() - t0, error: String(e) });
    }
    setRunning(false);
  };

  if (allEndpoints.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 15, textAlign: 'center', padding: 24 }}>
        Selecione ao menos uma entidade<br />para testar os endpoints
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Endpoint list */}
      <div style={{ overflowY: 'auto', maxHeight: 200, borderBottom: '1px solid #f1f5f9' }}>
        {entities.map(ent => (
          <div key={ent}>
            <div style={{ padding: '6px 16px', fontSize: 12, fontWeight: 700, color: ENTITY_LABELS[ent].color,
              textTransform: 'uppercase', letterSpacing: '.06em', background: '#fafafa',
              borderBottom: '1px solid #f1f5f9' }}>
              {ENTITY_LABELS[ent].label}
            </div>
            {(ENTITY_ENDPOINTS[ent] || []).map(ep => {
              const [m, p] = ep.split(' ');
              const isActive = selected?.label === ep;
              return (
                <div key={ep} onClick={() => selectEndpoint({ method: m, path: p, entity: ent, label: ep })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px',
                    cursor: 'pointer', background: isActive ? '#eef2ff' : 'white',
                    borderBottom: '1px solid #f8fafc',
                  }}>
                  <span style={{
                    fontSize: 11, fontWeight: 800, padding: '2px 5px', borderRadius: 3, flexShrink: 0,
                    background: (METHOD_COLORS[m] || '#94a3b8') + '18',
                    color: METHOD_COLORS[m] || '#94a3b8',
                    border: `1px solid ${(METHOD_COLORS[m] || '#94a3b8')}30`,
                    fontFamily: 'monospace',
                  }}>{m}</span>
                  <code style={{ fontSize: 13, color: isActive ? '#4338ca' : '#475569', fontFamily: 'monospace' }}>{p}</code>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Request config */}
      {selected && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: 10, overflowY: 'auto' }}>
          {/* URL preview */}
          <div style={{ background: '#0f172a', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '2px 5px', borderRadius: 3, flexShrink: 0,
              background: (METHOD_COLORS[selected.method] || '#94a3b8') + '30',
              color: METHOD_COLORS[selected.method] || '#94a3b8',
              fontFamily: 'monospace',
            }}>{selected.method}</span>
            <code style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>
              {fullUrl}
            </code>
          </div>

          {/* ID param */}
          {needsId && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                ID do recurso
              </label>
              <input className="form-input" value={pathParam} onChange={e => setPathParam(e.target.value)}
                placeholder="1" style={{ fontSize: 14 }} />
            </div>
          )}

          {/* Body */}
          {needsBody && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Body (JSON)
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={5}
                style={{
                  flex: 1, fontFamily: 'monospace', fontSize: 14,
                  border: '1px solid #e2e8f0', borderRadius: 6,
                  padding: '8px 10px', outline: 'none', resize: 'vertical',
                  background: '#f8fafc', color: '#0f172a',
                }}
              />
            </div>
          )}

          {/* Run button */}
          <button onClick={run} disabled={running} style={{
            background: running ? '#e2e8f0' : ACCENT,
            color: running ? '#94a3b8' : 'white',
            border: 'none', borderRadius: 7,
            padding: '9px 0', fontWeight: 700, fontSize: 15,
            cursor: running ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {running ? '⏳ Executando...' : '▶ Executar'}
          </button>

          {/* Result */}
          {result && (
            <div style={{
              border: `1px solid ${result.ok ? '#bbf7d0' : '#fecaca'}`,
              borderRadius: 8, overflow: 'hidden',
            }}>
              <div style={{
                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 10,
                background: result.ok ? '#f0fdf4' : '#fef2f2',
                borderBottom: `1px solid ${result.ok ? '#bbf7d0' : '#fecaca'}`,
              }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: result.ok ? '#16a34a' : '#dc2626' }}>
                  {result.ok ? '✅' : '❌'} {result.status || 'Erro de rede'}
                </span>
                <span style={{ fontSize: 13, color: '#64748b' }}>{result.latency}ms</span>
                <button onClick={() => setResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}>×</button>
              </div>
              <pre style={{
                margin: 0, padding: '10px 12px',
                fontSize: 13, fontFamily: 'monospace', color: '#334155',
                background: '#f8fafc', maxHeight: 180, overflowY: 'auto',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {result.error || JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── WebhookFormModal ──────────────────────────────────────────────────────────

function WebhookFormModal({ webhook, defaultType, onClose, onSaved }) {
  const isNew = !webhook;
  const [form, setForm] = useState({
    name: webhook?.name || '',
    type: webhook?.type || defaultType || 'outbound',
    url: webhook?.url || '',
    description: webhook?.description || '',
    active: webhook?.active !== false,
    events: webhook ? (webhook.events || []) : [],
    allowed_entities: webhook ? (webhook.allowed_entities || []) : [],
    allowed_methods: webhook ? (webhook.allowed_methods || ['POST']) : ['POST'],
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleEntityToggle = (entities) => {
    const pruned = form.events.filter(ev => {
      const meta = ALL_EVENTS.find(e => e.key === ev);
      return !meta || entities.includes(meta.entity);
    });
    setForm(f => ({ ...f, allowed_entities: entities, events: pruned }));
  };

  const filteredEvents = ALL_EVENTS.filter(ev =>
    form.allowed_entities.length === 0 || form.allowed_entities.includes(ev.entity)
  );

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    if (form.type === 'outbound' && !form.url.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name, type: form.type, url: form.url || null,
        description: form.description, active: form.active,
        events: form.events,
        allowed_entities: form.allowed_entities,
        allowed_methods: form.allowed_methods,
      };
      const url = isNew ? `${API}/webhooks` : `${API}/webhooks/${webhook.id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const saved = await res.json();
      onSaved(saved, isNew);
      onClose();
    } catch {}
    finally { setSaving(false); }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(webhook?.token || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const inboundBaseUrl = `${API}/webhook/in/${webhook?.token || '{token}'}`;

  // always show right panel (tester for inbound, payload guide for outbound)
  const showTester = true;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 14,
        width: '96vw',
        maxWidth: 1500,
        maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,.22)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, background: ACCENT + '14', color: ACCENT,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800,
            }}>{form.type === 'inbound' ? '↙' : '↗'}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#0f172a' }}>
                {isNew ? `Novo Webhook de ${form.type === 'inbound' ? 'Entrada' : 'Saída'}` : `Editar: ${webhook.name}`}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 1 }}>
                {form.type === 'inbound' ? 'Recebe requisições de sistemas externos' : 'CRM dispara para sua URL quando eventos ocorrem'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Toggle value={form.active} onChange={set('active')} />
            <span style={{ fontSize: 14, color: form.active ? '#10b981' : '#94a3b8', minWidth: 48 }}>
              {form.active ? 'Ativo' : 'Inativo'}
            </span>
            <button className="icon-btn" onClick={onClose}><IconX /></button>
          </div>
        </div>

        {/* Body — two columns when tester visible */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* Left — config form */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Identificação */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Identificação</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nome *</label>
                  <input className="form-input" placeholder="Ex: Robô de Leads"
                    value={form.name} onChange={e => set('name')(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.type} onChange={e => set('type')(e.target.value)}>
                    <option value="outbound">Saída — CRM dispara para URL</option>
                    <option value="inbound">Entrada — recebe requisições externas</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1/3', marginBottom: 0 }}>
                  <label className="form-label">Descrição</label>
                  <input className="form-input" placeholder="Para que serve este webhook..."
                    value={form.description} onChange={e => set('description')(e.target.value)} />
                </div>
              </div>
            </div>

            {/* URL destino (outbound) */}
            {form.type === 'outbound' && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Destino</div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">URL de destino *</label>
                  <input className="form-input" placeholder="https://meu-servidor.com/webhook"
                    value={form.url} onChange={e => set('url')(e.target.value)} />
                </div>
              </div>
            )}

            {/* Token de entrada */}
            {form.type === 'inbound' && webhook?.token && (
              <div style={{ background: '#0f172a', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>URL Base de Entrada</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ flex: 1, fontSize: 13, color: '#a5f3fc', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {inboundBaseUrl}/<span style={{ color: '#fde68a' }}>{'{entity}'}</span>
                  </code>
                  <button onClick={copyToken} style={{
                    background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
                    borderRadius: 5, padding: '4px 10px', cursor: 'pointer', color: '#94a3b8', fontSize: 13, flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <IconCopy /> {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>
                  Header: <code style={{ color: '#7dd3fc' }}>X-Webhook-Token: {webhook.token.slice(0, 16)}…</code>
                </div>
              </div>
            )}

            {/* Entidades */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                Entidades com acesso
              </div>
              <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 10 }}>
                {form.type === 'inbound' ? 'Quais entidades este token pode acessar' : 'Quais entidades disparam este webhook'}
              </div>
              <MultiCheckbox
                options={ALL_ENTITIES}
                value={form.allowed_entities}
                onChange={handleEntityToggle}
                renderLabel={entity => <TagBadge label={ENTITY_LABELS[entity].label} color={ENTITY_LABELS[entity].color} />}
              />
            </div>

            {/* Métodos permitidos (inbound) */}
            {form.type === 'inbound' && form.allowed_entities.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Métodos HTTP permitidos</div>
                <MultiCheckbox options={ALL_METHODS} value={form.allowed_methods} onChange={set('allowed_methods')} />
              </div>
            )}

            {/* Eventos (outbound) */}
            {form.type === 'outbound' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Eventos que disparam este webhook
                  </div>
                  {filteredEvents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allKeys = filteredEvents.map(e => e.key);
                        const allSelected = allKeys.every(k => form.events.includes(k));
                        set('events')(allSelected ? form.events.filter(e => !allKeys.includes(e)) : [...new Set([...form.events, ...allKeys])]);
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: ACCENT, fontWeight: 600, padding: 0 }}
                    >
                      {filteredEvents.every(e => form.events.includes(e.key)) ? 'Desmarcar todos' : 'Selecionar todos'}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 10 }}>
                  Se nenhum for selecionado, todos os eventos das entidades serão disparados.
                </div>
                {filteredEvents.length === 0 ? (
                  <div style={{ fontSize: 14, color: '#cbd5e1', fontStyle: 'italic' }}>Selecione ao menos uma entidade.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {ALL_ENTITIES
                      .filter(e => form.allowed_entities.length === 0 || form.allowed_entities.includes(e))
                      .map(entity => {
                        const entityEvents = ALL_EVENTS.filter(ev => ev.entity === entity);
                        const entityKeys = entityEvents.map(e => e.key);
                        const allEntitySelected = entityKeys.every(k => form.events.includes(k));
                        const someEntitySelected = entityKeys.some(k => form.events.includes(k)) && !allEntitySelected;
                        return (
                          <div key={entity} style={{ background: '#fafafa', border: '1px solid #f1f5f9', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: ENTITY_LABELS[entity].color, display: 'inline-block' }} />
                                <span style={{ fontSize: 13, color: ENTITY_LABELS[entity].color, fontWeight: 700 }}>
                                  {ENTITY_LABELS[entity].label}
                                </span>
                              </div>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={allEntitySelected}
                                  ref={el => { if (el) el.indeterminate = someEntitySelected; }}
                                  onChange={() => {
                                    if (allEntitySelected) {
                                      set('events')(form.events.filter(e => !entityKeys.includes(e)));
                                    } else {
                                      set('events')([...new Set([...form.events, ...entityKeys])]);
                                    }
                                  }}
                                  style={{ accentColor: ACCENT, width: 13, height: 13 }}
                                />
                                <span style={{ fontSize: 13, color: '#64748b' }}>Todos</span>
                              </label>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                              {entityEvents.map(ev => (
                                <label key={ev.key} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 14 }}>
                                  <input
                                    type="checkbox"
                                    checked={form.events.includes(ev.key)}
                                    onChange={() => {
                                      const set2 = new Set(form.events);
                                      set2.has(ev.key) ? set2.delete(ev.key) : set2.add(ev.key);
                                      set('events')([...set2]);
                                    }}
                                    style={{ accentColor: ACCENT, width: 13, height: 13 }}
                                  />
                                  <span>{ev.label}</span>
                                  <code style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{ev.key}</code>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right — tester panel (inbound: endpoint tester / outbound: payload guide) */}
          <div style={{
            width: 420, flexShrink: 0, borderLeft: '1px solid #f1f5f9',
            display: 'flex', flexDirection: 'column', minHeight: 0,
          }}>
            <div style={{
              padding: '10px 16px', background: '#fafafa', borderBottom: '1px solid #f1f5f9',
              fontSize: 13, fontWeight: 700, color: '#475569',
              textTransform: 'uppercase', letterSpacing: '.08em',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {form.type === 'inbound' ? '▶ Testador de Endpoints' : '📦 Payloads & Teste'}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {form.type === 'inbound'
                ? <EndpointTester entities={form.allowed_entities} token={webhook?.token} />
                : <OutboundGuide form={form} webhookId={webhook?.id} />
              }
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px', borderTop: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
          background: 'white',
        }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : isNew ? 'Criar webhook' : 'Salvar alterações'}
          </button>
        </div>

      </div>
    </div>
  );
}

// """ Webhook card """"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

function WebhookCard({ wh, onEdit, onDelete, onToggleActive, onRegenToken, deletingId, setDeletingId }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const isOut = wh.type === 'outbound';

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API}/webhooks/${wh.id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestResult({ ...data, success: data.success ?? data.ok ?? false });
    } catch (e) {
      setTestResult({ success: false, error: String(e) });
    } finally {
      setTesting(false);
    }
  };
  const entities = wh.allowed_entities || [];
  const events = wh.events || [];
  const endpoints = [];
  entities.forEach(ent => {
    (ENTITY_ENDPOINTS[ent] || []).forEach(ep => endpoints.push({ ent, ep }));
  });

  const inboundUrl = wh.token
    ? `${window.location.origin.replace('5173', '8000')}/webhook/in/${wh.token}/{entity}`
    : null;

  const copyInboundUrl = () => {
    navigator.clipboard.writeText(inboundUrl || '');
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1500);
  };

  return (
    <div style={{
      background: 'white',
      border: `1px solid ${wh.active ? '#e2e8f0' : '#f1f5f9'}`,
      borderLeft: `3px solid ${wh.active ? ACCENT : '#cbd5e1'}`,
      borderRadius: 10,
      padding: '16px 20px',
      opacity: wh.active ? 1 : 0.65,
      transition: 'opacity .2s, border-color .2s',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon */}
        <div style={{
          width: 38, height: 38, borderRadius: 9, flexShrink: 0,
          background: ACCENT + '14', color: ACCENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 800,
        }}>{isOut ? '↗' : '↙'}</div>

        {/* Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'monospace' }}>#{wh.id}</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{wh.name}</span>
            {!wh.active && (
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0',
              }}>INATIVO</span>
            )}
          </div>
          {wh.description && (
            <div style={{ fontSize: 14, color: '#64748b', marginTop: 3 }}>{wh.description}</div>
          )}
        </div>

        {/* Toggle + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Toggle value={wh.active} onChange={() => onToggleActive(wh)} />
          {isOut && (
            <button
              onClick={handleTest}
              disabled={testing}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: testing ? '#f8fafc' : 'none',
                border: '1px solid #e2e8f0',
                borderRadius: 6, padding: '5px 10px', cursor: testing ? 'not-allowed' : 'pointer',
                color: '#475569', fontSize: 14, fontWeight: 500,
              }}
            >
              {testing ? '⏳' : '▶'} {testing ? 'Testando...' : 'Testar'}
            </button>
          )}
          <button
            title="Editar"
            onClick={() => onEdit(wh)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: '1px solid #e2e8f0',
              borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
              color: '#475569', fontSize: 14, fontWeight: 500,
            }}
          >
            <IconEdit /> Editar
          </button>
          {wh.type === 'inbound' && (
            <button
              title="Regenerar token de acesso"
              onClick={() => setConfirmRegen(true)}
              style={{
                background: 'none', border: '1px solid #fde68a',
                borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                color: '#92400e', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <span style={{ fontSize: 15 }}>&#x1F511;</span> Novo token
            </button>
          )}
          {confirmRegen && (
            <div className="modal-backdrop" onClick={() => setConfirmRegen(false)} style={{ zIndex: 9999 }}>
              <div onClick={e => e.stopPropagation()} style={{
                background: 'white', borderRadius: 14, padding: '28px 32px',
                maxWidth: 440, width: '90vw',
                boxShadow: '0 24px 64px rgba(0,0,0,.22)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    &#x26A0;&#xFE0F;
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17, color: '#0f172a' }}>Regenerar token de acesso?</div>
                    <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 2 }}>Esta ação não pode ser desfeita</div>
                  </div>
                </div>
                <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 14px', fontSize: 15, color: '#78350f', lineHeight: 1.6, marginBottom: 20 }}>
                  <strong>Atenção:</strong> ao gerar um novo token, a URL atual deste webhook será <strong>invalidada imediatamente</strong>.<br /><br />
                  Todos os sistemas externos, automações (como n8n, Zapier ou Make) e integrações que usam essa URL <strong>vão parar de funcionar</strong> até que a nova URL seja configurada nesses sistemas.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="btn btn-ghost" onClick={() => setConfirmRegen(false)}>Cancelar</button>
                  <button
                    style={{ background: '#d97706', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                    onClick={() => { setConfirmRegen(false); onRegenToken(wh.id); }}
                  >
                    Sim, gerar novo token
                  </button>
                </div>
              </div>
            </div>
          )}
          {deletingId === wh.id ? (
            <>
              <button
                onClick={() => onDelete(wh.id)}
                style={{
                  background: '#fee2e2', border: '1px solid #fca5a5',
                  borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                  color: '#dc2626', fontSize: 13, fontWeight: 600,
                }}
              >Confirmar</button>
              <button
                onClick={() => setDeletingId(null)}
                style={{
                  background: 'none', border: '1px solid #e2e8f0',
                  borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                  color: '#64748b', fontSize: 13,
                }}
              >Não</button>
            </>
          ) : (
            <button
              title="Excluir"
              onClick={() => setDeletingId(wh.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: '1px solid #fecaca',
                borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: '#ef4444',
              }}
            >
              <IconTrash />
            </button>
          )}
        </div>
      </div>

      {/* Test result banner */}
      {testResult && (
        <div style={{
          marginTop: 10,
          border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: 6, fontSize: 14,
        }}>
          <div style={{
            padding: '8px 12px',
            background: testResult.success ? '#f0fdf4' : '#fef2f2',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>{testResult.success ? '✅' : '❌'}</span>
            <span style={{ color: testResult.success ? '#166534' : '#991b1b', fontWeight: 600 }}>
              {testResult.success ? 'Sucesso' : 'Falhou'}
            </span>
            {testResult.status_code && <span style={{ color: '#475569' }}>HTTP {testResult.status_code}</span>}
            {testResult.latency_ms && <span style={{ color: '#94a3b8' }}>{testResult.latency_ms}ms</span>}
            <button onClick={() => setTestResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}>×</button>
          </div>
          {!testResult.success && (
            <div style={{ padding: '5px 12px', fontSize: 13, color: '#991b1b', background: '#fef2f2' }}>
              {testResult.status_code === 404
                ? '⚠️ 404 — se usar n8n, clique "Listen for test event" no nó Webhook antes de testar.'
                : testResult.error || 'Não foi possível entregar o payload.'}
            </div>
          )}
          {testResult.response_body && (
            <details style={{ marginTop: 6, fontSize: 13, padding: '0 12px 8px' }}>
              <summary style={{ cursor: 'pointer', color: '#475569', fontWeight: 600 }}>Ver resposta recebida</summary>
              <pre style={{ marginTop: 4, padding: '6px 8px', background: '#f8fafc', borderRadius: 4, fontSize: 12, fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap', color: '#334155' }}>{testResult.response_body}</pre>
            </details>
          )}
        </div>
      )}

      {/* Entities */}
      {entities.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 12 }}>
          <span style={{ fontSize: 13, color: '#94a3b8', alignSelf: 'center', marginRight: 2 }}>Entidades:</span>
          {entities.map(e => (
            <TagBadge key={e} label={ENTITY_LABELS[e]?.label || e} color={ENTITY_LABELS[e]?.color || '#94a3b8'} />
          ))}
        </div>
      )}

      {/* Outbound: events + URL */}
      {isOut && (
        <div style={{ marginTop: 10 }}>
          {events.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#94a3b8', marginRight: 2 }}>Eventos:</span>
              {events.map(ev => {
                const meta = ALL_EVENTS.find(e => e.key === ev);
                return (
                  <span key={ev} style={{
                    fontSize: 12, background: '#f8fafc', border: '1px solid #e2e8f0',
                    borderRadius: 4, padding: '2px 6px', color: '#475569', fontFamily: 'monospace',
                  }}>{meta?.label || ev}</span>
                );
              })}
            </div>
          ) : (
            <span style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>
              Todos os eventos das entidades permitidas
            </span>
          )}
          {wh.url && (
            <div style={{
              marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
              background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 6, padding: '6px 10px',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>DESTINO</span>
              <span style={{ fontSize: 13, color: '#334155', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {wh.url}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Inbound: endpoints + URL */}
      {!isOut && (
        <div style={{ marginTop: 10 }}>
          {endpoints.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#94a3b8', marginRight: 2 }}>Endpoints:</span>
              {endpoints.slice(0, 8).map(({ ent, ep }) => (
                <code key={ent + ep} style={{
                  fontSize: 12, background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: 4, padding: '2px 6px', color: '#475569',
                }}>{ep}</code>
              ))}
              {endpoints.length > 8 && (
                <span style={{ fontSize: 13, color: '#94a3b8' }}>+{endpoints.length - 8} mais</span>
              )}
            </div>
          )}
          {inboundUrl && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#0f172a', borderRadius: 6, padding: '7px 10px',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', flexShrink: 0 }}>URL</span>
              <code style={{
                flex: 1, fontSize: 13, color: '#a5f3fc', fontFamily: 'monospace',
                wordBreak: 'break-all',
              }}>{inboundUrl}</code>
              <button
                onClick={copyInboundUrl}
                title="Copiar URL"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 5, padding: '4px 8px', cursor: 'pointer',
                  color: '#94a3b8', fontSize: 13, flexShrink: 0,
                }}
              >
                <IconCopy /> {copiedUrl ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ver histórico de disparos */}
      <div style={{ marginTop: 10, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
        <button
          onClick={async () => {
            if (!showLogs) {
              const data = await fetch(`${API}/webhooks/${wh.id}/logs`).then(r => r.json());
              setLogs(Array.isArray(data) ? data : []);
            }
            setShowLogs(v => !v);
          }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <span style={{ transform: showLogs ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform .15s' }}>▶</span>
          {showLogs ? 'Ocultar histórico' : 'Ver histórico de disparos'}
        </button>

        {showLogs && (
          <div style={{ marginTop: 8 }}>
            {logs.length === 0 ? (
              <div style={{ fontSize: 14, color: '#94a3b8', padding: '8px 0' }}>Nenhum disparo registrado</div>
            ) : (
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px', fontWeight: 600 }}>Data</th>
                    <th style={{ padding: '4px 8px', fontWeight: 600 }}>Evento</th>
                    <th style={{ padding: '4px 8px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '4px 8px', fontWeight: 600 }}>Latência</th>
                    <th style={{ padding: '4px 8px', fontWeight: 600 }}>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} style={{ borderTop: '1px solid #f8fafc' }}>
                      <td style={{ padding: '4px 8px', color: '#64748b' }}>{l.created_at ? new Date(l.created_at).toLocaleString('pt-BR') : '—'}</td>
                      <td style={{ padding: '4px 8px' }}><code style={{ background: '#f8fafc', padding: '1px 4px', borderRadius: 3 }}>{l.event || '—'}</code></td>
                      <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{l.status_code || '—'}</td>
                      <td style={{ padding: '4px 8px', color: '#64748b' }}>{l.latency_ms ? `${l.latency_ms}ms` : '—'}</td>
                      <td style={{ padding: '4px 8px' }}>
                        <span style={{ color: l.success ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          {l.success ? '✓ OK' : '✕ Erro'}
                        </span>
                        {l.error_message && <span style={{ color: '#94a3b8', marginLeft: 6 }}>{l.error_message.slice(0, 60)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// """ API Guide tab """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

const CODE_STYLE = {
  background: '#0f172a',
  borderRadius: 8,
  padding: '14px 16px',
  fontFamily: 'monospace',
  fontSize: 14,
  color: '#e2e8f0',
  overflowX: 'auto',
  whiteSpace: 'pre',
  lineHeight: 1.6,
  border: '1px solid #1e293b',
};

const SECTION_TITLE = {
  fontSize: 17,
  fontWeight: 700,
  color: '#0f172a',
  marginBottom: 6,
  marginTop: 24,
};

const SECTION_DESC = {
  fontSize: 15,
  color: '#64748b',
  marginBottom: 12,
  lineHeight: 1.6,
};

function MethodBadge({ method }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      background: (METHOD_COLORS[method] || '#94a3b8') + '18',
      color: METHOD_COLORS[method] || '#94a3b8',
      border: `1px solid ${(METHOD_COLORS[method] || '#94a3b8')}40`,
      fontFamily: 'monospace', flexShrink: 0,
    }}>{method}</span>
  );
}

const ENTITY_DOCS = [
  {
    entity: 'cards',
    label: 'Negócios',
    color: '#6366f1',
    endpoints: [
      { method: 'POST',   path: '/cards',            desc: 'Criar um novo negócio' },
      { method: 'GET',    path: '/cards',             desc: 'Listar todos os negócios' },
      { method: 'GET',    path: '/cards/{id}',        desc: 'Buscar negócio por ID' },
      { method: 'PUT',    path: '/cards/{id}',        desc: 'Atualizar negócio' },
      { method: 'DELETE', path: '/cards/{id}',        desc: 'Excluir negócio' },
      { method: 'PUT',    path: '/cards/{id}/move',   desc: 'Mover negócio de fase/pipeline' },
      { method: 'POST',   path: '/cards/{id}/activities', desc: 'Adicionar atividade ao negócio' },
    ],
    curl: `curl -X POST ${API}/webhook/in/{token}/cards \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Token: {token}" \\
  -d '{
    "title": "Novo negócio via webhook",
    "value": 1500.00,
    "pipeline_id": 1,
    "contact_id": 42
  }'`,
  },
  {
    entity: 'leads',
    label: 'Leads',
    color: '#8b5cf6',
    endpoints: [
      { method: 'POST',   path: '/leads',               desc: 'Criar lead' },
      { method: 'GET',    path: '/leads',               desc: 'Listar leads' },
      { method: 'GET',    path: '/leads/{id}',          desc: 'Buscar lead por ID' },
      { method: 'PUT',    path: '/leads/{id}',          desc: 'Atualizar lead' },
      { method: 'DELETE', path: '/leads/{id}',          desc: 'Excluir lead' },
      { method: 'PUT',    path: '/leads/{id}/move',     desc: 'Mover lead de fase' },
      { method: 'POST',   path: '/leads/{id}/convert',  desc: 'Converter lead em negócio' },
      { method: 'POST',   path: '/leads/{id}/activities', desc: 'Adicionar atividade ao lead' },
    ],
    curl: `curl -X POST ${API}/webhook/in/{token}/leads \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Token: {token}" \\
  -d '{
    "name": "Maria Souza",
    "phone": "+5511999999999",
    "source": "site"
  }'`,
  },
  {
    entity: 'contacts',
    label: 'Contatos',
    color: '#10b981',
    endpoints: [
      { method: 'POST', path: '/contacts',       desc: 'Criar contato' },
      { method: 'GET',  path: '/contacts',       desc: 'Listar contatos' },
      { method: 'GET',  path: '/contacts/{id}',  desc: 'Buscar contato por ID' },
      { method: 'PUT',  path: '/contacts/{id}',  desc: 'Atualizar contato' },
    ],
    curl: `curl -X PUT ${API}/webhook/in/{token}/contacts \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Token: {token}" \\
  -d '{
    "id": 7,
    "name": "João Silva",
    "email": "joao@empresa.com"
  }'`,
  },
  {
    entity: 'companies',
    label: 'Empresas',
    color: '#f59e0b',
    endpoints: [
      { method: 'POST',   path: '/companies',       desc: 'Criar empresa' },
      { method: 'GET',    path: '/companies',       desc: 'Listar empresas' },
      { method: 'GET',    path: '/companies/{id}',  desc: 'Buscar empresa por ID' },
      { method: 'PUT',    path: '/companies/{id}',  desc: 'Atualizar empresa' },
      { method: 'DELETE', path: '/companies/{id}',  desc: 'Excluir empresa' },
    ],
    curl: `curl -X POST ${API}/webhook/in/{token}/companies \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Token: {token}" \\
  -d '{
    "name": "Acme Corp",
    "cnpj": "00.000.000/0001-00"
  }'`,
  },
];

function ApiGuide() {
  return (
    <div style={{ padding: '0 24px 40px', maxWidth: 860 }}>

      {/* Outbound */}
      <div style={SECTION_TITLE}>Webhooks de Saída (Outbound)</div>
      <div style={SECTION_DESC}>
        Quando um evento ocorre no CRM (ex: negócio criado, lead movido), o servidor faz uma requisição
        <strong> POST</strong> para a URL configurada no webhook. O corpo da requisição é um JSON com os dados
        do evento e da entidade afetada.
      </div>
      <div style={{ ...CODE_STYLE, marginBottom: 8 }}>
{`// Exemplo de payload enviado pelo CRM para sua URL
{
  "event": "card.created",
  "timestamp": "2024-06-10T14:32:00Z",
  "webhook_id": 3,
  "data": {
    "id": 101,
    "title": "Proposta ACME",
    "value": 5000.00,
    "pipeline_id": 1,
    "stage_id": 2,
    "contact_id": 42,
    "created_at": "2024-06-10T14:32:00Z"
  }
}`}
      </div>
      <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>
        Sua URL deve responder com status <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>2xx</code> em até 10 segundos. Respostas fora do prazo ou com erro serão registradas mas não retentadas.
      </div>

      <div style={{ height: 1, background: '#f1f5f9', margin: '20px 0' }} />

      {/* Inbound */}
      <div style={SECTION_TITLE}>Webhooks de Entrada (Inbound)</div>
      <div style={SECTION_DESC}>
        Sistemas externos podem enviar requisições diretamente ao CRM usando a URL de entrada do webhook.
        O token gerado autoriza o acesso às entidades configuradas. Use o token no header
        <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3, margin: '0 4px' }}>X-Webhook-Token</code>
        ou diretamente na URL.
      </div>
      <div style={{ ...CODE_STYLE, marginBottom: 8 }}>
{`# Formato da URL de entrada
${API}/webhook/in/{token}/{entity}

# Exemplo com header de autenticação
curl -X GET ${API}/webhook/in/abc123.../cards \\
  -H "X-Webhook-Token: abc123..."

# Ou passando o token na query string
curl "${API}/webhook/in/cards?token=abc123..."`}
      </div>

      <div style={{ height: 1, background: '#f1f5f9', margin: '20px 0' }} />

      {/* Per-entity docs */}
      <div style={{ ...SECTION_TITLE, marginTop: 8 }}>Endpoints por Entidade</div>
      <div style={SECTION_DESC}>
        Abaixo estão todos os endpoints disponíveis para cada entidade, com exemplos de uso via curl.
      </div>

      {ENTITY_DOCS.map(doc => (
        <div key={doc.entity} style={{
          border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 20,
          overflow: 'hidden',
        }}>
          {/* Entity header */}
          <div style={{
            background: doc.color + '0e',
            borderBottom: `1px solid ${doc.color}22`,
            padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: doc.color, display: 'inline-block',
            }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: doc.color }}>{doc.label}</span>
            <code style={{ fontSize: 13, color: '#94a3b8', marginLeft: 4 }}>/{doc.entity}</code>
          </div>

          {/* Endpoint table */}
          <div style={{ padding: '10px 16px' }}>
            {doc.endpoints.map(ep => (
              <div key={ep.method + ep.path} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '5px 0',
                borderBottom: '1px solid #f8fafc',
              }}>
                <MethodBadge method={ep.method} />
                <code style={{ fontSize: 14, color: '#334155', minWidth: 260, fontFamily: 'monospace' }}>
                  {API}{ep.path}
                </code>
                <span style={{ fontSize: 14, color: '#94a3b8' }}>{ep.desc}</span>
              </div>
            ))}
          </div>

          {/* curl example */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Exemplo curl
            </div>
            <div style={CODE_STYLE}>{doc.curl}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// """ Main view """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

const TABS = [
  { key: 'outbound', label: 'Saída',        type: 'outbound' },
  { key: 'inbound',  label: 'Entrada',      type: 'inbound' },
  { key: 'guide',    label: 'Guia de uso',  type: null },
];

export default function WebhooksView() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('outbound');
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [creatingType, setCreatingType] = useState(null); // 'outbound' | 'inbound' | null
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetch(`${API}/webhooks`)
      .then(r => r.json()).then(data => { setWebhooks(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSaved = (wh, isNew) => {
    if (isNew) setWebhooks(prev => [wh, ...prev]);
    else setWebhooks(prev => prev.map(w => w.id === wh.id ? wh : w));
  };

  const handleDelete = async (id) => {
    await fetch(`${API}/webhooks/${id}`, { method: 'DELETE' });
    setWebhooks(prev => prev.filter(w => w.id !== id));
    setDeletingId(null);
  };

  const handleToggleActive = async (wh) => {
    const payload = {
      name: wh.name, type: wh.type, url: wh.url,
      description: wh.description, active: !wh.active,
      events: wh.events, allowed_entities: wh.allowed_entities,
      allowed_methods: wh.allowed_methods,
    };
    const res = await fetch(`${API}/webhooks/${wh.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const updated = await res.json();
    handleSaved(updated, false);
  };

  const handleRegenToken = async (id) => {
    const res = await fetch(`${API}/webhooks/${id}/regenerate-token`, { method: 'POST' });
    const updated = await res.json();
    handleSaved(updated, false);
    if (editingWebhook?.id === id) setEditingWebhook(updated);
  };

  const outbound = webhooks.filter(w => w.type === 'outbound');
  const inbound  = webhooks.filter(w => w.type === 'inbound');

  const tabWebhooks = activeTab === 'outbound' ? outbound : inbound;

  if (loading) return <div className="loading-state">Carregando webhooks...</div>;

  return (
    <div className="view-container">
      {/* Header */}
      <div className="view-header">
        <div>
          <div className="view-title">Webhooks</div>
          <div className="view-subtitle">
            {webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''} configurado{webhooks.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        padding: '0 24px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 0,
      }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(tab => {
            const count = tab.type === 'outbound' ? outbound.length
                        : tab.type === 'inbound'  ? inbound.length
                        : null;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${ACCENT}` : '2px solid transparent',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 15,
                  color: isActive ? ACCENT : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'color .15s',
                  marginBottom: -1,
                }}
              >
                {tab.label}
                {count !== null && (
                  <span style={{
                    background: isActive ? ACCENT : '#e2e8f0',
                    color: isActive ? 'white' : '#64748b',
                    borderRadius: 10,
                    padding: '1px 7px',
                    fontSize: 13,
                    fontWeight: 700,
                    minWidth: 20,
                    textAlign: 'center',
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Per-tab create button */}
        {(activeTab === 'outbound' || activeTab === 'inbound') && (
          <button
            onClick={() => setCreatingType(activeTab)}
            style={{
              background: ACCENT,
              color: 'white',
              border: 'none',
              borderRadius: 7,
              padding: '7px 14px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 15,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            + Criar webhook de {activeTab === 'outbound' ? 'saída' : 'entrada'}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="view-body" style={{ paddingTop: 20 }}>
        {activeTab === 'guide' ? (
          <ApiGuide />
        ) : tabWebhooks.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 24px' }}>
            Nenhum webhook de {activeTab === 'outbound' ? 'saída' : 'entrada'} configurado ainda.
            Clique em "Criar webhook" para começar.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 24px' }}>
            {tabWebhooks.map(wh => (
              <WebhookCard
                key={wh.id}
                wh={wh}
                onEdit={setEditingWebhook}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
                onRegenToken={handleRegenToken}
                deletingId={deletingId}
                setDeletingId={setDeletingId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {(creatingType || editingWebhook) && (
        <WebhookFormModal
          webhook={editingWebhook}
          defaultType={creatingType || undefined}
          onClose={() => { setCreatingType(null); setEditingWebhook(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
