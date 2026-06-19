import React, { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '../App';
import { API_URL as API } from '../config.js';

// The same columns as TasksKanban
const COLUMNS = [
  { id: '__global__', label: 'Global (todas)',  color: '#6366f1' },
  { id: 'overdue',    label: 'Vencido',         color: '#ef4444' },
  { id: 'today',     label: 'Vence hoje',       color: '#f59e0b' },
  { id: 'week',      label: 'Esta semana',      color: '#6366f1' },
  { id: 'next_week', label: 'Próxima semana',   color: '#8b5cf6' },
  { id: 'later',     label: 'Em 2 semanas+',    color: '#3b82f6' },
  { id: 'no_date',   label: 'Sem prazo',        color: '#94a3b8' },
  { id: 'done',      label: 'Concluídas',       color: '#10b981' },
];

const TRIGGER_OPTS = {
  __global__: [
    { id: 'status_changed',   label: 'Status muda para' },
    { id: 'priority_changed', label: 'Prioridade muda para' },
  ],
  col: [
    { id: 'entered_column',   label: 'Tarefa entra nesta coluna' },
    { id: 'status_changed',   label: 'Status muda para' },
    { id: 'priority_changed', label: 'Prioridade muda para' },
  ],
};

const TRIGGER_VALUES = {
  status_changed:   [{ id: 'todo', label: 'A fazer' }, { id: 'in_progress', label: 'Em andamento' }, { id: 'done', label: 'Concluída' }],
  priority_changed: [{ id: 'low', label: 'Baixa' }, { id: 'normal', label: 'Normal' }, { id: 'high', label: 'Alta' }, { id: 'urgent', label: 'Urgente' }],
};

const ACTION_TYPES = [
  { id: 'set_status',      label: 'Alterar status para' },
  { id: 'set_priority',    label: 'Alterar prioridade para' },
  { id: 'set_assigned_to', label: 'Atribuir para (nome)' },
];

const ACTION_VALUES = {
  set_status:   [{ id: 'todo', label: 'A fazer' }, { id: 'in_progress', label: 'Em andamento' }, { id: 'done', label: 'Concluída' }],
  set_priority: [{ id: 'low', label: 'Baixa' }, { id: 'normal', label: 'Normal' }, { id: 'high', label: 'Alta' }, { id: 'urgent', label: 'Urgente' }],
};

const ACTION_META = {
  set_status:      { icon: '🔄', label: 'Status',      color: '#6366f1' },
  set_priority:    { icon: '⬆', label: 'Prioridade',   color: '#f59e0b' },
  set_assigned_to: { icon: '👤', label: 'Responsável', color: '#10b981' },
};

function triggerDesc(r) {
  if (r.trigger_type === 'entered_column') return 'Entra nesta coluna';
  const tv = TRIGGER_VALUES[r.trigger_type]?.find(x => x.id === r.trigger_value);
  const labels = { status_changed: 'Status', priority_changed: 'Prioridade' };
  return `${labels[r.trigger_type] || r.trigger_type}: ${tv?.label || r.trigger_value}`;
}

// ── Rule editor modal ─────────────────────────────────────────────────────────
function RuleEditor({ col, rule, onSave, onClose }) {
  const isGlobal = col.id === '__global__';
  const triggerOpts = isGlobal ? TRIGGER_OPTS.__global__ : TRIGGER_OPTS.col;

  const [name, setName]               = useState(rule?.name || 'Nova regra');
  const [triggerType, setTriggerType] = useState(rule?.trigger_type || triggerOpts[0].id);
  const [triggerVal, setTriggerVal]   = useState(rule?.trigger_value || '');
  const [actionType, setActionType]   = useState(rule?.action_type || 'set_status');
  const [actionVal, setActionVal]     = useState(rule?.action_config?.value || '');
  const [saving, setSaving]           = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    await onSave({
      name,
      trigger_type: triggerType,
      trigger_value: triggerType === 'entered_column' ? col.id : (triggerVal || null),
      column_id: isGlobal ? null : col.id,
      action_type: actionType,
      action_config: { value: actionVal },
      enabled: rule?.enabled ?? true,
    });
    setSaving(false);
    onClose();
  };

  const tvOpts = TRIGGER_VALUES[triggerType] || [];
  const avOpts = ACTION_VALUES[actionType] || null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'white', borderRadius: 16, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{rule ? 'Editar regra' : 'Nova regra'}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Coluna: {col.label}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20 }}>×</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Nome da regra</label>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Trigger */}
          <div style={{ background: '#fafafe', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>⚡ Gatilho — SE</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Tipo</label>
                <select value={triggerType} onChange={e => { setTriggerType(e.target.value); setTriggerVal(''); }}
                  style={{ width: '100%', padding: '7px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}>
                  {triggerOpts.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              {triggerType !== 'entered_column' && tvOpts.length > 0 && (
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Valor</label>
                  <select value={triggerVal} onChange={e => setTriggerVal(e.target.value)}
                    style={{ width: '100%', padding: '7px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}>
                    <option value="">Selecionar…</option>
                    {tvOpts.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </div>
              )}
              {triggerType === 'entered_column' && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', borderRadius: 6, padding: '7px 10px', width: '100%', boxSizing: 'border-box' }}>
                    → {col.label}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action */}
          <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>✅ Ação — ENTÃO</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Tipo</label>
                <select value={actionType} onChange={e => { setActionType(e.target.value); setActionVal(''); }}
                  style={{ width: '100%', padding: '7px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}>
                  {ACTION_TYPES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Valor</label>
                {avOpts ? (
                  <select value={actionVal} onChange={e => setActionVal(e.target.value)}
                    style={{ width: '100%', padding: '7px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}>
                    <option value="">Selecionar…</option>
                    {avOpts.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                ) : (
                  <input value={actionVal} onChange={e => setActionVal(e.target.value)}
                    placeholder="Nome do usuário..."
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 13, color: '#64748b', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || !name.trim()}
            style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando…' : 'Salvar regra'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function TaskAutomationsView({ onClose, colLabels = {} }) {
  const confirm = useConfirm();
  const auth = { Authorization: `Bearer ${localStorage.getItem('nexus_token')}` };

  const [rules, setRules]   = useState([]);
  const [editor, setEditor] = useState(null); // { col, rule|null }

  useEffect(() => {
    fetch(`${API}/task-rules`, { headers: auth })
      .then(r => r.json())
      .then(data => setRules(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const rulesFor = (colId) => {
    if (colId === '__global__') return rules.filter(r => !r.column_id);
    return rules.filter(r => r.column_id === colId);
  };

  const handleSave = async (payload) => {
    const isNew = !editor.rule;
    const url = isNew ? `${API}/task-rules` : `${API}/task-rules/${editor.rule.id}`;
    const method = isNew ? 'POST' : 'PUT';
    const saved = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(payload),
    }).then(r => r.json());
    setRules(prev => isNew ? [...prev, saved] : prev.map(r => r.id === saved.id ? saved : r));
  };

  const handleDelete = async (ruleId) => {
    if (!await confirm('Excluir esta regra?', 'Esta ação não pode ser desfeita.')) return;
    await fetch(`${API}/task-rules/${ruleId}`, { method: 'DELETE', headers: auth });
    setRules(prev => prev.filter(r => r.id !== ruleId));
  };

  const handleToggle = async (rule) => {
    const saved = await fetch(`${API}/task-rules/${rule.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ ...rule, enabled: !rule.enabled }),
    }).then(r => r.json()).catch(() => null);
    if (saved) setRules(prev => prev.map(r => r.id === saved.id ? saved : r));
  };

  const totalRules = rules.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #e2e8f0', background: 'white', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
          ← Voltar às tarefas
        </button>
        <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>⚡ Automações</span>
          <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>Tarefas</span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {totalRules} regra{totalRules !== 1 ? 's' : ''} configurada{totalRules !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Info banner */}
      <div style={{ background: '#f0fdf4', borderBottom: '1px solid #d1fae5', padding: '8px 24px', fontSize: 12, color: '#065f46', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span>💡</span>
        <span>As regras são executadas automaticamente ao <strong>salvar uma tarefa</strong>. "Global" aplica a todas as colunas.</span>
      </div>

      {/* Columns */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: 0 }}>
        <div style={{ display: 'flex', gap: 16, padding: 24, alignItems: 'flex-start', minWidth: 'max-content' }}>
          {COLUMNS.map(col => {
            const colLabel = colLabels[col.id] || col.label;
            const colRules = rulesFor(col.id);
            return (
              <div key={col.id} style={{ width: 280, background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
                {/* Column header */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10, background: col.color + '0d' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', flex: 1 }}>{colLabel}</div>
                  <div style={{ background: colRules.length > 0 ? col.color : '#e2e8f0', color: colRules.length > 0 ? 'white' : '#94a3b8', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '2px 7px' }}>
                    {colRules.length}
                  </div>
                </div>

                {/* Rules */}
                <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colRules.length === 0 && (
                    <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>Nenhuma regra configurada</div>
                  )}
                  {colRules.map(rule => {
                    const meta = ACTION_META[rule.action_type] || { icon: '⚡', label: rule.action_type, color: '#6366f1' };
                    return (
                      <div key={rule.id} style={{ background: rule.enabled ? 'white' : '#f8fafc', border: `1px solid ${rule.enabled ? '#e2e8f0' : '#f1f5f9'}`, borderRadius: 10, padding: '10px 12px', opacity: rule.enabled ? 1 : 0.6, transition: 'all 0.15s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ background: meta.color + '15', color: meta.color, borderRadius: 6, padding: '3px 6px', fontSize: 13 }}>{meta.icon}</span>
                          <div style={{ flex: 1, fontWeight: 600, fontSize: 12, color: '#0f172a', lineHeight: 1.3 }}>{rule.name}</div>
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>{triggerDesc(rule)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, background: meta.color + '15', color: meta.color, borderRadius: 4, padding: '2px 6px' }}>{meta.label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* Toggle */}
                            <button onClick={() => handleToggle(rule)} title={rule.enabled ? 'Desativar' : 'Ativar'}
                              style={{ width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', background: rule.enabled ? '#10b981' : '#cbd5e1', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                              <div style={{ position: 'absolute', top: 2, left: rule.enabled ? 14 : 2, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                            </button>
                            <button onClick={() => setEditor({ col, rule })}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, padding: 2 }} title="Editar">✏️</button>
                            <button onClick={() => handleDelete(rule.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, padding: 2 }} title="Excluir">🗑️</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add button */}
                <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    onClick={() => setEditor({ col, rule: null })}
                    style={{ width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer', border: '1.5px dashed #e2e8f0', background: 'transparent', fontSize: 12, color: '#64748b', fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = col.color; e.currentTarget.style.color = col.color; e.currentTarget.style.background = col.color + '10'; }}
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
        <RuleEditor
          col={editor.col}
          rule={editor.rule}
          onSave={handleSave}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
