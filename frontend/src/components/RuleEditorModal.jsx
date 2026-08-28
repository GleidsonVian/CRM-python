import React, { useState, useEffect } from 'react';

const ACTION_TYPES = [
  { value: 'webhook',     label: 'Disparar Webhook',             icon: '🔗' },
  { value: 'assign_user', label: 'Atribuir Responsável',         icon: '👤' },
  { value: 'add_note',    label: 'Adicionar Nota no Histórico',  icon: '📝' },
  { value: 'set_price',   label: 'Definir Valor do Negócio',     icon: '💰' },
];

const VARIABLES = [
  { key: 'deal.title',       desc: 'Título do negócio' },
  { key: 'deal.price',       desc: 'Valor do negócio' },
  { key: 'deal.id',          desc: 'ID do negócio' },
  { key: 'deal.description', desc: 'Descrição' },
  { key: 'contact.name',     desc: 'Nome do contato' },
  { key: 'contact.email',    desc: 'Email do contato' },
  { key: 'contact.phone',    desc: 'Telefone do contato' },
  { key: 'stage.name',       desc: 'Nome da etapa' },
  { key: 'pipeline.name',    desc: 'Nome do funil' },
];

const DEFAULT_CONFIG = {
  webhook:     { method: 'POST', url: '', payload: '{\n  "negocio": "{{deal.title}}",\n  "valor": "{{deal.price}}",\n  "etapa": "{{stage.name}}"\n}' },
  assign_user: { user_id: '' },
  add_note:    { content: 'Negócio "{{deal.title}}" movido para {{stage.name}}.' },
  set_price:   { price: '' },
};

export default function RuleEditorModal({ rule, stageId, pipelineId, users, onSave, onClose }) {
  const isNew = !rule;
  const [name, setName] = useState(rule?.name || 'Nova regra');
  const [actionType, setActionType] = useState(rule?.action_type || 'webhook');
  const [config, setConfig] = useState(() => {
    if (rule?.config) {
      try { return JSON.parse(rule.config); } catch {}
    }
    return DEFAULT_CONFIG['webhook'];
  });
  const [showVars, setShowVars] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew || !rule) {
      setConfig(DEFAULT_CONFIG[actionType] || {});
    }
  }, [actionType]);

  const setCfg = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name,
        action_type: actionType,
        config: JSON.stringify(config),
        stage_id: stageId,
        pipeline_id: pipelineId,
        order: rule?.order ?? 0,
        enabled: rule?.enabled ?? true,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const insertVar = (key, field) => {
    const snippet = `{{${key}}}`;
    setCfg(field, (config[field] || '') + snippet);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
        zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 14, width: 640, maxWidth: '95vw',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#0f172a' }}>
              {isNew ? '⚡ Nova regra de automação' : '⚡ Editar regra'}
            </div>
            <div style={{ fontSize: 14, color: '#64748b', marginTop: 2 }}>
              Dispara automaticamente quando um negócio entra nesta etapa.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 22, lineHeight: 1 }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Rule name */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Nome da regra
            </label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Notificar vendedor, Criar tarefa..."
            />
          </div>

          {/* Action type */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Ação a executar
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ACTION_TYPES.map(at => (
                <button
                  key={at.value}
                  onClick={() => setActionType(at.value)}
                  style={{
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: actionType === at.value ? '2px solid #10b981' : '2px solid #e2e8f0',
                    background: actionType === at.value ? '#f0fdf4' : 'white',
                    textAlign: 'left', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{at.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{at.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic config */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '16px 18px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              Configuração da ação
            </label>

            {actionType === 'webhook' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 13, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>Método</label>
                    <select className="form-select" style={{ fontSize: 14 }} value={config.method || 'POST'} onChange={e => setCfg('method', e.target.value)}>
                      {['POST', 'GET', 'PUT', 'PATCH'].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>URL do Webhook</label>
                    <input
                      className="form-input"
                      value={config.url || ''}
                      onChange={e => setCfg('url', e.target.value)}
                      placeholder="https://hooks.exemplo.com/..."
                      style={{ fontFamily: 'monospace', fontSize: 14 }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Payload (JSON)</label>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#10b981', fontFamily: 'inherit' }} onClick={() => setShowVars(v => !v)}>
                      {showVars ? '▴ Ocultar variáveis' : '▾ Inserir variável'}
                    </button>
                  </div>
                  <textarea
                    className="form-textarea"
                    value={config.payload || ''}
                    onChange={e => setCfg('payload', e.target.value)}
                    rows={5}
                    style={{ fontFamily: 'monospace', fontSize: 14 }}
                  />
                </div>
                {showVars && <VarPanel vars={VARIABLES} onInsert={k => insertVar(k, 'payload')} />}
              </div>
            )}

            {actionType === 'assign_user' && (
              <div>
                <label style={{ fontSize: 13, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>Responsável a atribuir</label>
                <select className="form-select" value={config.user_id || ''} onChange={e => setCfg('user_id', e.target.value)}>
                  <option value="">Selecionar usuário...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
                </select>
              </div>
            )}

            {actionType === 'add_note' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Conteúdo da nota</label>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#10b981', fontFamily: 'inherit' }} onClick={() => setShowVars(v => !v)}>
                    {showVars ? '▴ Ocultar variáveis' : '▾ Inserir variável'}
                  </button>
                </div>
                <textarea
                  className="form-textarea"
                  value={config.content || ''}
                  onChange={e => setCfg('content', e.target.value)}
                  rows={3}
                  placeholder='Ex: Negócio "{{deal.title}}" movido para {{stage.name}}.'
                />
                {showVars && <VarPanel vars={VARIABLES} onInsert={k => insertVar(k, 'content')} />}
              </div>
            )}

            {actionType === 'set_price' && (
              <div>
                <label style={{ fontSize: 13, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>Novo valor (R$)</label>
                <input
                  type="number"
                  className="form-input"
                  value={config.price || ''}
                  onChange={e => setCfg('price', e.target.value)}
                  placeholder="0.00"
                />
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                  Substitui o valor atual do negócio quando mover para esta etapa.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 100 }}>
            {saving ? 'Salvando...' : isNew ? 'Criar regra' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VarPanel({ vars, onInsert }) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: 8, padding: '10px 12px',
      display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4,
    }}>
      <div style={{ width: '100%', fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        Clique para inserir
      </div>
      {vars.map(v => (
        <button
          key={v.key}
          onClick={() => onInsert(v.key)}
          title={v.desc}
          style={{
            background: '#334155', border: '1px solid #475569',
            color: '#10b981', borderRadius: 5, padding: '3px 8px',
            fontSize: 13, fontFamily: 'monospace', cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#10b981'}
          onMouseLeave={e => e.currentTarget.style.background = '#334155'}
        >
          {`{{${v.key}}}`}
        </button>
      ))}
    </div>
  );
}
