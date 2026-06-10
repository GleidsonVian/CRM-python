import React, { useState, useEffect } from 'react';

const API = 'http://localhost:8002';

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

// ─── Icons ─────────────────────────────────────────────────────────────────────

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

// ─── Small helpers ──────────────────────────────────────────────────────────────

function TagBadge({ label, color }) {
  return (
    <span style={{
      background: color + '18', color, border: `1px solid ${color}40`,
      borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
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

function MultiCheckbox({ options, value, onChange, renderLabel }) {
  const toggle = (key) => {
    const set = new Set(value);
    set.has(key) ? set.delete(key) : set.add(key);
    onChange([...set]);
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px' }}>
      {options.map(opt => (
        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12 }}>
          <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)}
            style={{ accentColor: ACCENT, width: 13, height: 13 }} />
          {renderLabel ? renderLabel(opt) : opt}
        </label>
      ))}
    </div>
  );
}

// ─── WebhookFormModal (unchanged logic) ───────────────────────────────────────

function WebhookFormModal({ webhook, defaultType, onClose, onSaved }) {
  const isNew = !webhook;
  const [form, setForm] = useState({
    name: webhook?.name || '',
    type: webhook?.type || defaultType || 'outbound',
    url: webhook?.url || '',
    description: webhook?.description || '',
    active: webhook?.active !== false,
    events: webhook ? JSON.parse(webhook.events || '[]') : [],
    allowed_entities: webhook ? JSON.parse(webhook.allowed_entities || '[]') : [],
    allowed_methods: webhook ? JSON.parse(webhook.allowed_methods || '["POST"]') : ['POST'],
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
        name: form.name,
        type: form.type,
        url: form.url || null,
        description: form.description,
        active: form.active,
        events: JSON.stringify(form.events),
        allowed_entities: JSON.stringify(form.allowed_entities),
        allowed_methods: JSON.stringify(form.allowed_methods),
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

  const inboundUrl = webhook?.token
    ? `${window.location.origin.replace('5173', '8000')}/webhook/in/${webhook.token}/{entity}`
    : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 12, width: 680, maxWidth: '95vw',
        maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,.18)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'white', zIndex: 2,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
              {isNew ? 'Novo Webhook' : 'Editar Webhook'}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Configure como este webhook se conecta com o CRM
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><IconX /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Básico */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569',
              textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
              Identificação
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nome *</label>
                <input className="form-input" placeholder="Ex: Robô de Negócios"
                  value={form.name} onChange={e => set('name')(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tipo</label>
                <select className="form-input" value={form.type} onChange={e => set('type')(e.target.value)}>
                  <option value="outbound">Saída (Outbound) — CRM dispara para URL</option>
                  <option value="inbound">Entrada (Inbound) — recebe requisições externas</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1/3', marginBottom: 0 }}>
                <label className="form-label">Descrição</label>
                <input className="form-input" placeholder="Descreva para que serve este webhook..."
                  value={form.description} onChange={e => set('description')(e.target.value)} />
              </div>
            </div>
          </div>

          {/* URL (outbound) */}
          {form.type === 'outbound' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569',
                textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                Destino
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">URL de destino *</label>
                <input className="form-input" placeholder="https://meu-robo.com/webhook"
                  value={form.url} onChange={e => set('url')(e.target.value)} />
              </div>
            </div>
          )}

          {/* Token (inbound — show only when editing existing) */}
          {form.type === 'inbound' && webhook?.token && (
            <div style={{
              background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 8, padding: 14,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569',
                textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                URL de entrada
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <code style={{
                  flex: 1, fontSize: 11, background: '#0f172a', color: '#a5f3fc',
                  padding: '7px 10px', borderRadius: 6, fontFamily: 'monospace',
                  wordBreak: 'break-all',
                }}>{inboundUrl}</code>
                <button className="btn btn-ghost" style={{ fontSize: 11, flexShrink: 0 }}
                  onClick={copyToken}>
                  <IconCopy /> {copied ? 'Copiado!' : 'Copiar token'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Use o token no header <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>X-Webhook-Token</code> ou na URL acima.
                Substitua <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>{'{entity}'}</code> pela entidade desejada (ex: <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>cards</code>).
              </div>
            </div>
          )}

          {/* Entidades permitidas */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569',
              textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              Entidades com acesso
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
              {form.type === 'inbound'
                ? 'Quais entidades este token pode acessar via requisição externa'
                : 'Quais entidades disparam este webhook quando há eventos'}
            </div>
            <MultiCheckbox
              options={ALL_ENTITIES}
              value={form.allowed_entities}
              onChange={handleEntityToggle}
              renderLabel={entity => (
                <TagBadge label={ENTITY_LABELS[entity].label} color={ENTITY_LABELS[entity].color} />
              )}
            />
          </div>

          {/* Endpoints visíveis (inbound) */}
          {form.type === 'inbound' && form.allowed_entities.length > 0 && (
            <div style={{
              background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 8, padding: 14,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569',
                textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                Endpoints acessíveis
              </div>
              {form.allowed_entities.map(entity => (
                <div key={entity} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: ENTITY_LABELS[entity].color,
                    fontWeight: 700, marginBottom: 4 }}>{ENTITY_LABELS[entity].label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {ENTITY_ENDPOINTS[entity]?.map(ep => (
                      <code key={ep} style={{
                        background: 'white', border: '1px solid #e2e8f0',
                        borderRadius: 4, padding: '2px 7px', fontSize: 10, color: '#475569',
                      }}>{ep}</code>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                  Métodos HTTP permitidos
                </div>
                <MultiCheckbox
                  options={ALL_METHODS}
                  value={form.allowed_methods}
                  onChange={set('allowed_methods')}
                />
              </div>
            </div>
          )}

          {/* Eventos (outbound) */}
          {form.type === 'outbound' && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569',
                textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Eventos que disparam este webhook
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                Selecione zero ou mais. Se nenhum for selecionado, todos os eventos das entidades permitidas serão disparados.
              </div>
              {filteredEvents.length === 0 ? (
                <div style={{ fontSize: 12, color: '#cbd5e1', fontStyle: 'italic' }}>
                  Selecione ao menos uma entidade para ver os eventos disponíveis.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ALL_ENTITIES
                    .filter(e => form.allowed_entities.length === 0 || form.allowed_entities.includes(e))
                    .map(entity => {
                      const evs = ALL_EVENTS.filter(ev => ev.entity === entity);
                      return (
                        <div key={entity}>
                          <div style={{ fontSize: 11, color: ENTITY_LABELS[entity].color,
                            fontWeight: 700, marginBottom: 4 }}>{ENTITY_LABELS[entity].label}</div>
                          <MultiCheckbox
                            options={evs.map(e => e.key)}
                            value={form.events}
                            onChange={set('events')}
                            renderLabel={key => {
                              const ev = ALL_EVENTS.find(e => e.key === key);
                              return <span style={{ fontSize: 12 }}>{ev?.label || key}</span>;
                            }}
                          />
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Toggle value={form.active} onChange={set('active')} />
            <span style={{ fontSize: 13, color: form.active ? ACCENT : '#94a3b8' }}>
              {form.active ? 'Webhook ativo' : 'Webhook inativo'}
            </span>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          position: 'sticky', bottom: 0, background: 'white',
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

// ─── Webhook card ──────────────────────────────────────────────────────────────

function WebhookCard({ wh, onEdit, onDelete, onToggleActive, onRegenToken, deletingId, setDeletingId }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const isOut = wh.type === 'outbound';
  const entities = JSON.parse(wh.allowed_entities || '[]');
  const events = JSON.parse(wh.events || '[]');
  const endpoints = [];
  entities.forEach(ent => {
    (ENTITY_ENDPOINTS[ent] || []).forEach(ep => endpoints.push({ ent, ep }));
  });

  const inboundUrl = wh.token
    ? `${window.location.origin.replace('5173', '8002')}/webhook/in/${wh.token}/{entity}`
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
          fontSize: 18, fontWeight: 800,
        }}>{isOut ? '→' : '←'}</div>

        {/* Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>#{wh.id}</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{wh.name}</span>
            {!wh.active && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0',
              }}>INATIVO</span>
            )}
          </div>
          {wh.description && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{wh.description}</div>
          )}
        </div>

        {/* Toggle + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Toggle value={wh.active} onChange={() => onToggleActive(wh)} />
          <button
            title="Editar"
            onClick={() => onEdit(wh)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: '1px solid #e2e8f0',
              borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
              color: '#475569', fontSize: 12, fontWeight: 500,
            }}
          >
            <IconEdit /> Editar
          </button>
          {wh.type === 'inbound' && (
            <button
              title="Regenerar token"
              onClick={() => onRegenToken(wh.id)}
              style={{
                background: 'none', border: '1px solid #e2e8f0',
                borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                color: '#475569', fontSize: 13,
              }}
            >🔄</button>
          )}
          {deletingId === wh.id ? (
            <>
              <button
                onClick={() => onDelete(wh.id)}
                style={{
                  background: '#fee2e2', border: '1px solid #fca5a5',
                  borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                  color: '#dc2626', fontSize: 11, fontWeight: 600,
                }}
              >Confirmar</button>
              <button
                onClick={() => setDeletingId(null)}
                style={{
                  background: 'none', border: '1px solid #e2e8f0',
                  borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                  color: '#64748b', fontSize: 11,
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

      {/* Entities */}
      {entities.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 12 }}>
          <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center', marginRight: 2 }}>Entidades:</span>
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
              <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 2 }}>Eventos:</span>
              {events.map(ev => {
                const meta = ALL_EVENTS.find(e => e.key === ev);
                return (
                  <span key={ev} style={{
                    fontSize: 10, background: '#f8fafc', border: '1px solid #e2e8f0',
                    borderRadius: 4, padding: '2px 6px', color: '#475569', fontFamily: 'monospace',
                  }}>{meta?.label || ev}</span>
                );
              })}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
              Todos os eventos das entidades permitidas
            </span>
          )}
          {wh.url && (
            <div style={{
              marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
              background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 6, padding: '6px 10px',
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>DESTINO</span>
              <span style={{ fontSize: 11, color: '#334155', fontFamily: 'monospace', wordBreak: 'break-all' }}>
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
              <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 2 }}>Endpoints:</span>
              {endpoints.slice(0, 8).map(({ ent, ep }) => (
                <code key={ent + ep} style={{
                  fontSize: 10, background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: 4, padding: '2px 6px', color: '#475569',
                }}>{ep}</code>
              ))}
              {endpoints.length > 8 && (
                <span style={{ fontSize: 11, color: '#94a3b8' }}>+{endpoints.length - 8} mais</span>
              )}
            </div>
          )}
          {inboundUrl && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#0f172a', borderRadius: 6, padding: '7px 10px',
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', flexShrink: 0 }}>URL</span>
              <code style={{
                flex: 1, fontSize: 11, color: '#a5f3fc', fontFamily: 'monospace',
                wordBreak: 'break-all',
              }}>{inboundUrl}</code>
              <button
                onClick={copyInboundUrl}
                title="Copiar URL"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 5, padding: '4px 8px', cursor: 'pointer',
                  color: '#94a3b8', fontSize: 11, flexShrink: 0,
                }}
              >
                <IconCopy /> {copiedUrl ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── API Guide tab ─────────────────────────────────────────────────────────────

const CODE_STYLE = {
  background: '#0f172a',
  borderRadius: 8,
  padding: '14px 16px',
  fontFamily: 'monospace',
  fontSize: 12,
  color: '#e2e8f0',
  overflowX: 'auto',
  whiteSpace: 'pre',
  lineHeight: 1.6,
  border: '1px solid #1e293b',
};

const SECTION_TITLE = {
  fontSize: 15,
  fontWeight: 700,
  color: '#0f172a',
  marginBottom: 6,
  marginTop: 24,
};

const SECTION_DESC = {
  fontSize: 13,
  color: '#64748b',
  marginBottom: 12,
  lineHeight: 1.6,
};

const METHOD_COLORS = {
  GET: '#10b981',
  POST: ACCENT,
  PUT: '#f59e0b',
  DELETE: '#ef4444',
};

function MethodBadge({ method }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
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
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
        Sua URL deve responder com status <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>2xx</code> em até 10 segundos. Respostas fora do prazo ou com erro serão registradas mas não retenidas.
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
            <span style={{ fontWeight: 700, fontSize: 13, color: doc.color }}>{doc.label}</span>
            <code style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>/{doc.entity}</code>
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
                <code style={{ fontSize: 12, color: '#334155', minWidth: 260, fontFamily: 'monospace' }}>
                  {API}{ep.path}
                </code>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{ep.desc}</span>
              </div>
            ))}
          </div>

          {/* curl example */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8',
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

// ─── Main view ─────────────────────────────────────────────────────────────────

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
                  fontSize: 13,
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
                    fontSize: 11,
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
              fontSize: 13,
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
