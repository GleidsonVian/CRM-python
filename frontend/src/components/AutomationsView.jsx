import React, { useState, useEffect } from 'react';
import FlowBuilderModal from './FlowBuilderModal';

const API = 'http://localhost:8002';

const ACTION_META = {
  webhook:     { icon: '🔗', label: 'Webhook',       color: '#6366f1' },
  assign_user: { icon: '👤', label: 'Responsável',   color: '#f59e0b' },
  add_note:    { icon: '📝', label: 'Nota',           color: '#10b981' },
  set_price:   { icon: '💰', label: 'Valor',          color: '#ec4899' },
};

export default function AutomationsView({ stages, pipelineId, pipelineName, onClose }) {
  const [rules, setRules] = useState([]);
  const [users, setUsers] = useState([]);
  const [editor, setEditor] = useState(null); // { rule: null|obj, stageId, stageName }

  useEffect(() => {
    Promise.all([
      fetch(`${API}/automations?pipeline_id=${pipelineId}`).then(r => r.json()),
      fetch(`${API}/users`).then(r => r.json()),
    ]).then(([rs, us]) => { setRules(rs); setUsers(us); }).catch(() => {});
  }, [pipelineId]);

  const rulesFor = (stageId) => rules.filter(r => r.stage_id === stageId).sort((a, b) => a.order - b.order);

  const handleSave = async (data) => {
    const isNew = !editor.rule;
    const url = isNew ? `${API}/automations` : `${API}/automations/${editor.rule.id}`;
    const method = isNew ? 'POST' : 'PUT';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const saved = await res.json();
    setRules(prev => isNew ? [...prev, saved] : prev.map(r => r.id === saved.id ? saved : r));
  };

  const handleDelete = async (ruleId) => {
    if (!window.confirm('Excluir esta regra?')) return;
    await fetch(`${API}/automations/${ruleId}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== ruleId));
  };

  const handleToggle = async (rule) => {
    const updated = { ...rule, enabled: !rule.enabled };
    const res = await fetch(`${API}/automations/${rule.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated)
    });
    const saved = await res.json();
    setRules(prev => prev.map(r => r.id === saved.id ? saved : r));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        padding: '14px 24px', borderBottom: '1px solid #e2e8f0',
        background: 'white', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          ← Voltar ao pipeline
        </button>
        <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>⚡ Automações</span>
          <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{pipelineName}</span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
          {rules.length} regra{rules.length !== 1 ? 's' : ''} configurada{rules.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        background: '#f0fdf4', borderBottom: '1px solid #d1fae5',
        padding: '8px 24px', fontSize: 12, color: '#065f46', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <span>💡</span>
        <span>As regras são executadas automaticamente quando um negócio é <strong>movido para</strong> a etapa correspondente.</span>
      </div>

      {/* Stage columns */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: 0 }}>
        <div style={{ display: 'flex', gap: 16, padding: 24, alignItems: 'flex-start', minWidth: 'max-content' }}>
          {stages.map(stage => {
            const stageRules = rulesFor(stage.id);
            return (
              <div
                key={stage.id}
                style={{
                  width: 280, background: 'white', borderRadius: 14,
                  border: '1px solid #e2e8f0', overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Stage header */}
                <div style={{
                  padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: stage.color + '0d',
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', flex: 1 }}>{stage.name}</div>
                  <div style={{
                    background: stageRules.length > 0 ? stage.color : '#e2e8f0',
                    color: stageRules.length > 0 ? 'white' : '#94a3b8',
                    borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '2px 7px',
                  }}>
                    {stageRules.length}
                  </div>
                </div>

                {/* Rules list */}
                <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stageRules.length === 0 && (
                    <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                      Nenhuma regra configurada
                    </div>
                  )}

                  {stageRules.map(rule => {
                    const meta = ACTION_META[rule.action_type] || { icon: '⚡', label: rule.action_type, color: '#6366f1' };
                    return (
                      <div
                        key={rule.id}
                        style={{
                          background: rule.enabled ? 'white' : '#f8fafc',
                          border: `1px solid ${rule.enabled ? '#e2e8f0' : '#f1f5f9'}`,
                          borderRadius: 10, padding: '10px 12px',
                          opacity: rule.enabled ? 1 : 0.6,
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{
                            background: meta.color + '15', color: meta.color,
                            borderRadius: 6, padding: '3px 6px', fontSize: 13,
                          }}>{meta.icon}</span>
                          <div style={{ flex: 1, fontWeight: 600, fontSize: 12, color: '#0f172a', lineHeight: 1.2 }}>
                            {rule.name}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600,
                            background: meta.color + '15', color: meta.color,
                            borderRadius: 4, padding: '2px 6px',
                          }}>
                            {meta.label}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* Toggle */}
                            <button
                              onClick={() => handleToggle(rule)}
                              title={rule.enabled ? 'Desativar' : 'Ativar'}
                              style={{
                                width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
                                background: rule.enabled ? '#10b981' : '#cbd5e1',
                                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                              }}
                            >
                              <div style={{
                                position: 'absolute', top: 2,
                                left: rule.enabled ? 14 : 2,
                                width: 14, height: 14, borderRadius: '50%',
                                background: 'white', transition: 'left 0.2s',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                              }} />
                            </button>

                            <button
                              onClick={() => setEditor({ rule, stageId: stage.id, stageName: stage.name })}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, padding: 2 }}
                              title="Editar"
                            >✏️</button>

                            <button
                              onClick={() => handleDelete(rule.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, padding: 2 }}
                              title="Excluir"
                            >🗑️</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add button */}
                <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    onClick={() => setEditor({ rule: null, stageId: stage.id, stageName: stage.name })}
                    style={{
                      width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer',
                      border: '1.5px dashed #e2e8f0', background: 'transparent',
                      fontSize: 12, color: '#64748b', fontFamily: 'inherit',
                      fontWeight: 600, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#10b981'; e.currentTarget.style.background = '#f0fdf4'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Adicionar regra
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editor && (
        <FlowBuilderModal
          rule={editor.rule}
          stageId={editor.stageId}
          stageName={editor.stageName}
          pipelineId={pipelineId}
          users={users}
          onSave={handleSave}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

