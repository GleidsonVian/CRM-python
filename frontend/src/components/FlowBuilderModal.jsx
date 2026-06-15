import React, { useState, useEffect, Fragment } from 'react';

import { API_URL as API } from '../config.js';

// ── Meta dos tipos de nó ──────────────────────────────────────────────────────
const NODE_META = {
  trigger:       { label: 'Gatilho',              icon: '⚡', color: '#10b981', bg: '#ecfdf5' },
  webhook:       { label: 'Disparar Webhook',     icon: '🔗', color: '#6366f1', bg: '#eef2ff' },
  assign_user:   { label: 'Atribuir Responsável', icon: '👤', color: '#f59e0b', bg: '#fffbeb' },
  add_note:      { label: 'Adicionar Nota',        icon: '📝', color: '#3b82f6', bg: '#eff6ff' },
  set_price:     { label: 'Definir Valor',         icon: '💰', color: '#ec4899', bg: '#fdf2f8' },
  set_field:     { label: 'Modificar Elemento',    icon: '✏️', color: '#0ea5e9', bg: '#f0f9ff' },
  if_else:       { label: 'Se / Então',            icon: '◇',  color: '#8b5cf6', bg: '#f5f3ff' },
  change_stage:  { label: 'Alterar Etapa',         icon: '→',  color: '#0284c7', bg: '#e0f2fe' },
  move_pipeline: { label: 'Mover Pipeline',        icon: '⇄',  color: '#7c3aed', bg: '#f5f3ff' },
  create_task:   { label: 'Criar Tarefa',          icon: '✅', color: '#16a34a', bg: '#f0fdf4' },
  pause:         { label: 'Pausar Execução',       icon: '⏸', color: '#64748b', bg: '#f8fafc' },
  send_email:    { label: 'Enviar E-mail',         icon: '✉️', color: '#db2777', bg: '#fdf2f8' },
};

const CRM_TYPES     = ['change_stage', 'move_pipeline', 'assign_user'];
const ACTION_TYPES  = ['webhook', 'add_note', 'set_price', 'set_field', 'create_task', 'send_email'];
const CONTROL_TYPES = ['if_else', 'pause'];
const LOGIC_TYPES   = ['if_else'];

// Campos do negócio que podem ser modificados
const MODIFIABLE_FIELDS = [
  { value: 'deal.title',       label: 'Título do negócio',  type: 'text'    },
  { value: 'deal.price',       label: 'Valor (R$)',          type: 'number'  },
  { value: 'deal.description', label: 'Descrição',           type: 'textarea'},
  { value: 'deal.stage_id',    label: 'Mover para etapa',    type: 'stage'   },
];

// Campos disponíveis para condições (Se/Então)
const CONDITION_FIELDS = [
  { group: 'Negócio', value: 'deal.price',       label: 'Valor (R$)',       type: 'number' },
  { group: 'Negócio', value: 'deal.title',        label: 'Título',           type: 'text'   },
  { group: 'Negócio', value: 'deal.description',  label: 'Descrição',        type: 'text'   },
  { group: 'Negócio', value: 'deal.stage_id',     label: 'Etapa atual',      type: 'stage'  },
  { group: 'Contato', value: 'contact.name',      label: 'Nome do contato',  type: 'text'   },
  { group: 'Contato', value: 'contact.email',     label: 'E-mail',           type: 'text'   },
  { group: 'Contato', value: 'contact.phone',     label: 'Telefone',         type: 'text'   },
];

const OPERATORS_BY_TYPE = {
  number: [
    { value: '==',  label: 'igual a'          },
    { value: '!=',  label: 'diferente de'     },
    { value: '>',   label: 'maior que'        },
    { value: '<',   label: 'menor que'        },
    { value: '>=',  label: 'maior ou igual a' },
    { value: '<=',  label: 'menor ou igual a' },
  ],
  text: [
    { value: '==',        label: 'igual a'      },
    { value: '!=',        label: 'diferente de' },
    { value: 'contains',  label: 'contém'       },
    { value: '!contains', label: 'não contém'   },
  ],
  stage: [
    { value: '==', label: 'é'     },
    { value: '!=', label: 'não é' },
  ],
};

const VARIABLES = [
  { key: 'deal.title',       desc: 'Título do negócio' },
  { key: 'deal.price',       desc: 'Valor' },
  { key: 'deal.id',          desc: 'ID' },
  { key: 'deal.description', desc: 'Descrição' },
  { key: 'contact.name',     desc: 'Nome do contato' },
  { key: 'contact.email',    desc: 'Email' },
  { key: 'contact.phone',    desc: 'Telefone' },
  { key: 'stage.name',       desc: 'Etapa' },
  { key: 'pipeline.name',    desc: 'Funil' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

function createStep(type) {
  const base = { id: uid(), type };
  switch (type) {
    case 'webhook':       return { ...base, config: { method: 'POST', url: '', payload: '{\n  "negocio": "{{deal.title}}",\n  "valor": "{{deal.price}}",\n  "etapa": "{{stage.name}}"\n}' } };
    case 'assign_user':   return { ...base, config: { user_id: '', user_name: '' } };
    case 'add_note':      return { ...base, config: { content: 'Negócio "{{deal.title}}" movido para {{stage.name}}.' } };
    case 'set_price':     return { ...base, config: { price: '' } };
    case 'set_field':     return { ...base, config: { field: 'deal.price', value: '', pipeline_id: null, stage_id: null, stage_name: '' } };
    case 'if_else':       return { ...base, condition: '', true_steps: [], false_steps: [] };
    case 'change_stage':  return { ...base, config: { pipeline_id: null, stage_id: null, stage_name: '', pipeline_name: '' } };
    case 'move_pipeline': return { ...base, config: { pipeline_id: null, stage_id: null, stage_name: '', pipeline_name: '' } };
    case 'create_task':   return { ...base, config: { title: 'Tarefa: {{deal.title}}', description: '', priority: 'normal', due_days: 1 } };
    case 'pause':         return { ...base, config: { delay_amount: 1, delay_unit: 'hours' } };
    case 'send_email':    return { ...base, config: { to: '{{contact.email}}', subject: '', body: '' } };
    default: return base;
  }
}

function parseFlow(configStr) {
  if (!configStr) return [];
  try {
    const p = JSON.parse(configStr);
    if (p.version === 1) return p.steps || [];
  } catch {}
  return [];
}

function stepSummary(step) {
  const c = step.config || {};
  switch (step.type) {
    case 'webhook':     return c.url ? `${c.method || 'POST'} ${c.url}` : 'URL não configurada';
    case 'assign_user': return c.user_name || (c.user_id ? `ID ${c.user_id}` : 'Usuário não selecionado');
    case 'add_note':    return c.content ? c.content.slice(0, 55) + (c.content.length > 55 ? '…' : '') : 'Sem conteúdo';
    case 'set_price':   return c.price !== '' ? `R$ ${c.price}` : 'Valor não definido';
    case 'set_field': {
      if (c.field === 'deal.stage_id') return `Etapa → ${c.stage_name || 'não configurada'}`;
      const fm = MODIFIABLE_FIELDS.find(f => f.value === c.field);
      return fm ? `${fm.label} → ${c.value || 'não definido'}` : 'Não configurado';
    }
    case 'if_else': {
      try {
        const c = JSON.parse(step.condition || '{}');
        if (c.field) {
          const fd = CONDITION_FIELDS.find(f => f.value === c.field);
          const ops = OPERATORS_BY_TYPE[fd?.type || 'text'] || [];
          const opLabel = ops.find(o => o.value === c.operator)?.label || c.operator;
          const valLabel = fd?.type === 'stage' ? (c.stage_name || c.value) : c.value;
          if (fd && opLabel && valLabel) return `${fd.label} ${opLabel} "${valLabel}"`;
        }
      } catch {}
      return step.condition || 'Condição não definida';
    }
    case 'change_stage':  return c.stage_name ? `→ "${c.stage_name}"` : 'Etapa não selecionada';
    case 'move_pipeline': return c.pipeline_name ? `→ "${c.pipeline_name}"` : 'Pipeline não selecionado';
    case 'create_task':   return c.title ? c.title.slice(0, 50) + (c.title.length > 50 ? '…' : '') : 'Título não definido';
    case 'pause':         return `Aguardar ${c.delay_amount || 1} ${c.delay_unit === 'days' ? 'dia(s)' : c.delay_unit === 'minutes' ? 'min' : 'hora(s)'}`;
    case 'send_email':    return c.subject ? `Assunto: ${c.subject.slice(0, 40)}` : 'Sem assunto';
    default: return '';
  }
}

// ── Imutable tree helpers ─────────────────────────────────────────────────────
function updateById(steps, id, fn) {
  return steps.map(s => {
    if (s.id === id) return fn(s);
    if (s.type === 'if_else') return { ...s, true_steps: updateById(s.true_steps || [], id, fn), false_steps: updateById(s.false_steps || [], id, fn) };
    return s;
  });
}

function deleteById(steps, id) {
  return steps
    .filter(s => s.id !== id)
    .map(s => s.type === 'if_else' ? { ...s, true_steps: deleteById(s.true_steps || [], id), false_steps: deleteById(s.false_steps || [], id) } : s);
}

// ── Visual primitives ─────────────────────────────────────────────────────────
const Arrow = ({ height = 28 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
    <div style={{ width: 2, height: height - 7, background: '#cbd5e1' }} />
    <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #cbd5e1' }} />
  </div>
);

const AddBtn = ({ onClick }) => (
  <button
    onClick={onClick}
    title="Adicionar bloco"
    style={{
      width: 26, height: 26, borderRadius: '50%', border: '2px dashed #94a3b8',
      background: 'white', cursor: 'pointer', fontSize: 17, color: '#94a3b8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      lineHeight: 1, transition: 'all 0.13s', flexShrink: 0, fontFamily: 'inherit',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#10b981'; e.currentTarget.style.transform = 'scale(1.18)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.transform = 'scale(1)'; }}
  >+</button>
);

// ── Node card ─────────────────────────────────────────────────────────────────
function NodeCard({ step, active, onEdit, onDelete, isFirst = false }) {
  const meta = NODE_META[step.type] || {};
  const [hover, setHover] = useState(false);
  const summary = stepSummary(step);

  return (
    <div
      onClick={onEdit}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 310, borderRadius: 12, padding: '11px 14px',
        background: active ? meta.bg : 'white',
        border: `2px solid ${active ? meta.color : hover ? meta.color + '70' : '#e2e8f0'}`,
        boxShadow: active ? `0 0 0 4px ${meta.color}18` : hover ? '0 3px 10px rgba(0,0,0,0.08)' : 'none',
        cursor: 'pointer', transition: 'all 0.15s', position: 'relative', flexShrink: 0,
      }}
    >
      {/* Delete X */}
      {!isFirst && hover && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{
            position: 'absolute', top: -9, right: -9,
            width: 20, height: 20, borderRadius: '50%', border: '2px solid white',
            background: '#ef4444', color: 'white', cursor: 'pointer',
            fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit',
          }}
        >×</button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: meta.color + '20',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
        }}>{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{meta.label}</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {summary || <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Clique para configurar</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FlowSteps (recursive) ─────────────────────────────────────────────────────
function FlowSteps({ steps, onUpdate, activeId, setActive, setPicker }) {
  const handleAdd = (idx) => {
    setPicker({
      onSelect: (type) => {
        const s = createStep(type);
        const next = [...steps];
        next.splice(idx, 0, s);
        onUpdate(next);
        setActive(s);
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Arrow />
      <AddBtn onClick={() => handleAdd(0)} />

      {steps.map((step, i) => (
        <Fragment key={step.id}>
          <Arrow />
          {step.type === 'if_else' ? (
            <IfElseNode
              step={step}
              active={activeId === step.id}
              onEdit={() => setActive(step)}
              onDelete={() => onUpdate(deleteById(steps, step.id))}
              onUpdate={updated => onUpdate(steps.map(s => s.id === step.id ? updated : s))}
              activeId={activeId}
              setActive={setActive}
              setPicker={setPicker}
            />
          ) : (
            <NodeCard
              step={step}
              active={activeId === step.id}
              onEdit={() => setActive(step)}
              onDelete={() => onUpdate(steps.filter(s => s.id !== step.id))}
            />
          )}
          <Arrow height={20} />
          <AddBtn onClick={() => handleAdd(i + 1)} />
        </Fragment>
      ))}
    </div>
  );
}

// ── If/Else node ──────────────────────────────────────────────────────────────
function IfElseNode({ step, active, onEdit, onDelete, onUpdate, activeId, setActive, setPicker }) {
  const BRANCH_W = 320;
  const GAP = 32;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Diamond card */}
      <NodeCard step={step} active={active} onEdit={onEdit} onDelete={onDelete} />

      {/* Fork lines */}
      <div style={{ position: 'relative', width: BRANCH_W * 2 + GAP, height: 32, flexShrink: 0 }}>
        {/* left leg */}
        <div style={{ position: 'absolute', left: BRANCH_W / 2 - 1, top: 0, width: 2, height: 20, background: '#cbd5e1' }} />
        <div style={{ position: 'absolute', left: BRANCH_W / 2 - 1, top: 20, width: BRANCH_W / 2 + GAP / 2 + 1, height: 2, background: '#cbd5e1' }} />
        <div style={{ position: 'absolute', left: BRANCH_W + GAP / 2, top: 20, width: 2, height: 12, background: '#cbd5e1' }} />
        {/* right leg */}
        <div style={{ position: 'absolute', right: BRANCH_W / 2 - 1, top: 0, width: 2, height: 20, background: '#cbd5e1' }} />
        <div style={{ position: 'absolute', right: BRANCH_W / 2 - 1, top: 20, width: BRANCH_W / 2 + GAP / 2 + 1, height: 2, background: '#cbd5e1' }} />
        <div style={{ position: 'absolute', right: BRANCH_W + GAP / 2, top: 20, width: 2, height: 12, background: '#cbd5e1' }} />
      </div>

      {/* Two branches side by side */}
      <div style={{ display: 'flex', gap: GAP, alignItems: 'flex-start' }}>
        {[
          { key: 'true_steps',  label: '✅  Sim', color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
          { key: 'false_steps', label: '❌  Não', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
        ].map(branch => (
          <div key={branch.key} style={{ width: BRANCH_W, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Branch label pill */}
            <div style={{
              background: branch.bg, border: `1px solid ${branch.border}`,
              color: branch.color, borderRadius: 12,
              padding: '3px 14px', fontSize: 11, fontWeight: 700,
            }}>{branch.label}</div>

            {/* Branch content */}
            <div style={{ borderLeft: `2px solid ${branch.border}`, borderRight: `2px solid ${branch.border}`, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 16 }}>
              <FlowSteps
                steps={step[branch.key] || []}
                onUpdate={ns => onUpdate({ ...step, [branch.key]: ns })}
                activeId={activeId}
                setActive={setActive}
                setPicker={setPicker}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Merge lines */}
      <div style={{ position: 'relative', width: BRANCH_W * 2 + GAP, height: 28, flexShrink: 0 }}>
        <div style={{ position: 'absolute', left: BRANCH_W / 2 - 1, bottom: 0, width: 2, height: 16, background: '#cbd5e1' }} />
        <div style={{ position: 'absolute', left: BRANCH_W / 2 - 1, bottom: 16, width: BRANCH_W / 2 + GAP / 2 + 1, height: 2, background: '#cbd5e1' }} />
        <div style={{ position: 'absolute', left: BRANCH_W + GAP / 2, bottom: 16, width: 2, height: 12, background: '#cbd5e1' }} />
        <div style={{ position: 'absolute', right: BRANCH_W / 2 - 1, bottom: 0, width: 2, height: 16, background: '#cbd5e1' }} />
        <div style={{ position: 'absolute', right: BRANCH_W / 2 - 1, bottom: 16, width: BRANCH_W / 2 + GAP / 2 + 1, height: 2, background: '#cbd5e1' }} />
        <div style={{ position: 'absolute', right: BRANCH_W + GAP / 2, bottom: 16, width: 2, height: 12, background: '#cbd5e1' }} />
      </div>
      <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #cbd5e1' }} />
    </div>
  );
}

// ── Node Picker overlay ───────────────────────────────────────────────────────
function NodePicker({ onSelect, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 24, width: 400, boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Adicionar bloco</div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16, marginTop: 3 }}>Escolha uma ação ou condição lógica</div>

        {[
          { title: 'CRM', types: CRM_TYPES },
          { title: 'Ações', types: ACTION_TYPES },
          { title: 'Controle de Fluxo', types: CONTROL_TYPES },
        ].map(group => (
          <div key={group.title}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 12 }}>{group.title}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {group.types.map(type => {
                const m = NODE_META[type];
                return (
                  <button
                    key={type}
                    onClick={() => { onSelect(type); onClose(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 10,
                      border: '1px solid #e2e8f0', background: 'white',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = m.bg; e.currentTarget.style.borderColor = m.color; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                  >
                    <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{m.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <button onClick={onClose} style={{ marginTop: 16, width: '100%', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 13, color: '#64748b', fontFamily: 'inherit' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Edit Panel (right sidebar) ────────────────────────────────────────────────
// ── SetField editor ───────────────────────────────────────────────────────────
function SetFieldEditor({ step, cfg, onChange, Lbl, insertVar }) {
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages]       = useState([]);

  useEffect(() => {
    fetch(`${API}/pipelines`).then(r => r.json()).then(setPipelines).catch(() => {});
  }, []);

  useEffect(() => {
    if (cfg.pipeline_id) {
      fetch(`${API}/stages?pipeline_id=${cfg.pipeline_id}`).then(r => r.json()).then(setStages).catch(() => {});
    } else {
      setStages([]);
    }
  }, [cfg.pipeline_id]);

  const set = (k, v) => onChange({ ...step, config: { ...cfg, [k]: v } });
  const fieldDef = MODIFIABLE_FIELDS.find(f => f.value === cfg.field);
  const isStage  = cfg.field === 'deal.stage_id';
  const isText   = fieldDef?.type === 'text' || fieldDef?.type === 'textarea' || fieldDef?.type === 'number';

  const handleFieldChange = (newField) => {
    onChange({ ...step, config: { field: newField, value: '', pipeline_id: null, stage_id: null, stage_name: '' } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Field selector */}
      <div>
        <Lbl>Campo a modificar</Lbl>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {MODIFIABLE_FIELDS.map(f => (
            <button
              key={f.value}
              onClick={() => handleFieldChange(f.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${cfg.field === f.value ? '#0ea5e9' : '#e2e8f0'}`,
                background: cfg.field === f.value ? '#f0f9ff' : 'white',
                textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.12s',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: cfg.field === f.value ? '#0ea5e9' : '#e2e8f0',
              }} />
              <span style={{ fontSize: 12, fontWeight: cfg.field === f.value ? 700 : 500, color: cfg.field === f.value ? '#0369a1' : '#475569' }}>
                {f.label}
              </span>
              <code style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8', background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>
                {f.value}
              </code>
            </button>
          ))}
        </div>
      </div>

      {/* Stage selector */}
      {isStage && (
        <>
          <div>
            <Lbl>Pipeline</Lbl>
            <select
              className="form-select"
              value={cfg.pipeline_id || ''}
              onChange={e => onChange({ ...step, config: { ...cfg, pipeline_id: parseInt(e.target.value), stage_id: null, stage_name: '' } })}
            >
              <option value="">Selecionar pipeline...</option>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {cfg.pipeline_id && (
            <div>
              <Lbl>Etapa destino</Lbl>
              {stages.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Carregando etapas...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {stages.map(s => (
                    <button
                      key={s.id}
                      onClick={() => onChange({ ...step, config: { ...cfg, stage_id: s.id, stage_name: s.name } })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                        border: `2px solid ${cfg.stage_id === s.id ? s.color : '#e2e8f0'}`,
                        background: cfg.stage_id === s.id ? s.color + '15' : 'white',
                        textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: cfg.stage_id === s.id ? 700 : 500, color: '#0f172a' }}>{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Text / number value input */}
      {isText && (
        <div>
          <Lbl>Novo valor</Lbl>

          {/* Variable chips for text fields */}
          {(fieldDef?.type === 'text' || fieldDef?.type === 'textarea') && (
            <div style={{ background: '#1e293b', borderRadius: 7, padding: '8px 10px', marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Inserir variável</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {VARIABLES.map(v => (
                  <VarChip key={v.key} varKey={v.key} onInsert={() => set('value', (cfg.value || '') + `{{${v.key}}}`)} />
                ))}
              </div>
            </div>
          )}

          {fieldDef?.type === 'textarea' ? (
            <textarea
              className="form-textarea"
              style={{ fontSize: 12, minHeight: 70 }}
              value={cfg.value || ''}
              onChange={e => set('value', e.target.value)}
              placeholder="Novo conteúdo..."
            />
          ) : (
            <input
              type={fieldDef?.type === 'number' ? 'number' : 'text'}
              className="form-input"
              style={{ fontSize: 12 }}
              value={cfg.value || ''}
              onChange={e => set('value', e.target.value)}
              placeholder={fieldDef?.type === 'number' ? '0.00' : 'Novo valor...'}
            />
          )}

          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>
            Suporta variáveis: <code style={{ fontSize: 10 }}>{'{{deal.price}}'}</code>
          </div>
        </div>
      )}
    </div>
  );
}

function VarChip({ varKey, onInsert }) {
  return (
    <button
      onClick={() => onInsert(varKey)}
      title={varKey}
      style={{
        background: '#1e293b', border: '1px solid #334155',
        color: '#10b981', borderRadius: 4, padding: '2px 6px',
        fontSize: 10, fontFamily: 'monospace', cursor: 'pointer', whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#10b981'; }}
    >{`{{${varKey}}}`}</button>
  );
}

// ── Condition Editor (Se/Então visual builder) ────────────────────────────────
function ConditionEditor({ step, onChange }) {
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages]       = useState([]);

  const cond = (() => {
    try { return JSON.parse(step.condition || '{}'); } catch { return {}; }
  })();

  const setCond = (updates) => {
    onChange({ ...step, condition: JSON.stringify({ ...cond, ...updates }) });
  };

  const fieldDef  = CONDITION_FIELDS.find(f => f.value === cond.field);
  const operators = OPERATORS_BY_TYPE[fieldDef?.type || 'text'] || [];

  useEffect(() => {
    fetch(`${API}/pipelines`).then(r => r.json()).then(setPipelines).catch(() => {});
  }, []);

  useEffect(() => {
    if (cond.pipeline_id) {
      fetch(`${API}/stages?pipeline_id=${cond.pipeline_id}`).then(r => r.json()).then(setStages).catch(() => {});
    } else {
      setStages([]);
    }
  }, [cond.pipeline_id]);

  const handleFieldChange = (newField) => {
    onChange({ ...step, condition: JSON.stringify({ field: newField, operator: '', value: '' }) });
  };

  const Lbl = ({ children }) => (
    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
      {children}
    </label>
  );

  const typeColors = {
    number: { bg: '#fef3c7', color: '#b45309', label: 'numérico' },
    text:   { bg: '#f0fdf4', color: '#166534', label: 'texto'    },
    stage:  { bg: '#e0f2fe', color: '#0369a1', label: 'lista'    },
  };
  const tc = typeColors[fieldDef?.type] || {};

  const groups = [...new Set(CONDITION_FIELDS.map(f => f.group))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Step 1 — Field */}
      <div>
        <Lbl>1. Campo a avaliar</Lbl>
        <select
          className="form-select"
          value={cond.field || ''}
          onChange={e => handleFieldChange(e.target.value)}
        >
          <option value="">Selecionar campo...</option>
          {groups.map(group => (
            <optgroup key={group} label={group}>
              {CONDITION_FIELDS.filter(f => f.group === group).map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {fieldDef && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <code style={{ fontSize: 10, color: '#8b5cf6', background: '#f5f3ff', padding: '1px 5px', borderRadius: 3 }}>{cond.field}</code>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '1px 5px', borderRadius: 3, background: tc.bg, color: tc.color }}>
              {tc.label}
            </span>
          </div>
        )}
      </div>

      {/* Step 2 — Operator */}
      {cond.field && (
        <div>
          <Lbl>2. Condição</Lbl>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {operators.map(op => (
              <button
                key={op.value}
                onClick={() => setCond({ operator: op.value })}
                style={{
                  padding: '5px 11px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                  border: `2px solid ${cond.operator === op.value ? '#8b5cf6' : '#e2e8f0'}`,
                  background: cond.operator === op.value ? '#f5f3ff' : 'white',
                  fontSize: 11, fontWeight: cond.operator === op.value ? 700 : 500,
                  color: cond.operator === op.value ? '#7c3aed' : '#475569',
                  transition: 'all 0.12s',
                }}
              >{op.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 — Value (stage) */}
      {cond.field && cond.operator && fieldDef?.type === 'stage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <Lbl>3. Pipeline</Lbl>
            <select
              className="form-select"
              value={cond.pipeline_id || ''}
              onChange={e => setCond({ pipeline_id: parseInt(e.target.value), stage_id: null, stage_name: '', value: '' })}
            >
              <option value="">Selecionar pipeline...</option>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {cond.pipeline_id && (
            <div>
              <Lbl>Etapa</Lbl>
              {stages.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Carregando etapas...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {stages.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setCond({ stage_id: s.id, stage_name: s.name, value: String(s.id) })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                        border: `2px solid ${cond.stage_id === s.id ? s.color : '#e2e8f0'}`,
                        background: cond.stage_id === s.id ? s.color + '15' : 'white',
                        textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: cond.stage_id === s.id ? 700 : 500, color: '#0f172a' }}>{s.name}</span>
                      <code style={{ marginLeft: 'auto', fontSize: 9, color: '#94a3b8', background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>ID {s.id}</code>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 8, padding: '8px 10px', background: '#f8fafc', borderRadius: 7, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Ou inserir ID manualmente:</div>
                <input
                  type="number"
                  className="form-input"
                  style={{ fontSize: 12 }}
                  value={cond.stage_id || ''}
                  onChange={e => {
                    const id = parseInt(e.target.value);
                    const st = stages.find(s => s.id === id);
                    setCond({ stage_id: id || null, stage_name: st?.name || `Etapa ${e.target.value}`, value: e.target.value });
                  }}
                  placeholder="ID da etapa..."
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Value (number) */}
      {cond.field && cond.operator && fieldDef?.type === 'number' && (
        <div>
          <Lbl>3. Valor</Lbl>
          <input
            type="number"
            className="form-input"
            style={{ fontSize: 12 }}
            value={cond.value || ''}
            onChange={e => setCond({ value: e.target.value })}
            placeholder="Ex: 1000"
          />
        </div>
      )}

      {/* Step 3 — Value (text) */}
      {cond.field && cond.operator && fieldDef?.type === 'text' && (
        <div>
          <Lbl>3. Valor</Lbl>
          <input
            type="text"
            className="form-input"
            style={{ fontSize: 12 }}
            value={cond.value || ''}
            onChange={e => setCond({ value: e.target.value })}
            placeholder="Ex: gmail.com"
          />
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
            Suporta variáveis: <code style={{ fontSize: 9 }}>{'{{deal.title}}'}</code>
          </div>
        </div>
      )}

      {/* Preview */}
      {cond.field && cond.operator && (cond.value || cond.stage_name) && (() => {
        const opLabel = operators.find(o => o.value === cond.operator)?.label;
        const valLabel = fieldDef?.type === 'stage' ? cond.stage_name : cond.value;
        return (
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '9px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Preview</div>
            <div style={{ fontSize: 12, color: '#0f172a', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <code style={{ background: '#ede9fe', padding: '2px 6px', borderRadius: 3, color: '#7c3aed', fontSize: 11 }}>{cond.field}</code>
              <strong style={{ color: '#6d28d9' }}>{opLabel}</strong>
              <code style={{ background: '#ede9fe', padding: '2px 6px', borderRadius: 3, color: '#7c3aed', fontSize: 11 }}>
                {valLabel}{cond.stage_id ? ` (ID ${cond.stage_id})` : ''}
              </code>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ChangeStageEditor({ step, cfg, onChange, Lbl, label = 'Etapa destino' }) {
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);

  useEffect(() => {
    fetch(`${API}/pipelines`).then(r => r.json()).then(setPipelines).catch(() => {});
  }, []);

  useEffect(() => {
    if (cfg.pipeline_id) {
      fetch(`${API}/stages?pipeline_id=${cfg.pipeline_id}`).then(r => r.json()).then(setStages).catch(() => {});
    } else {
      setStages([]);
    }
  }, [cfg.pipeline_id]);

  const set = (patch) => onChange({ ...step, config: { ...cfg, ...patch } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Lbl>Pipeline</Lbl>
        <select className="form-select" value={cfg.pipeline_id || ''} onChange={e => {
          const p = pipelines.find(x => x.id === +e.target.value);
          set({ pipeline_id: +e.target.value, pipeline_name: p?.name || '', stage_id: null, stage_name: '' });
        }}>
          <option value="">Selecionar pipeline...</option>
          {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {cfg.pipeline_id && (
        <div>
          <Lbl>{label}</Lbl>
          {stages.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Carregando etapas...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {stages.map(s => (
                <button key={s.id} onClick={() => set({ stage_id: s.id, stage_name: s.name })} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                  border: `2px solid ${cfg.stage_id === s.id ? s.color : '#e2e8f0'}`,
                  background: cfg.stage_id === s.id ? s.color + '15' : 'white',
                  textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.12s',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: cfg.stage_id === s.id ? 700 : 500, color: '#0f172a' }}>{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditPanel({ step, users, onChange, onClose }) {
  const meta = NODE_META[step.type] || {};
  const cfg = step.config || {};
  const set = (k, v) => onChange({ ...step, config: { ...cfg, [k]: v } });

  const insertVar = (field, key) => {
    if (field === '__condition') {
      onChange({ ...step, condition: (step.condition || '') + `{{${key}}}` });
    } else {
      set(field, (cfg[field] || '') + `{{${key}}}`);
    }
  };

  // set_field tem seu próprio painel de variáveis interno
  const textField = step.type === 'webhook' ? 'payload' : step.type === 'add_note' ? 'content' : null;

  const Lbl = ({ children }) => (
    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
      {children}
    </label>
  );

  return (
    <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: 'white' }}>
      {/* Panel header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: meta.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{meta.icon}</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: meta.color }}>{meta.label}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Variable chips */}
        {textField && (
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '10px 10px' }}>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>Inserir variável</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {VARIABLES.map(v => <VarChip key={v.key} varKey={v.key} onInsert={k => insertVar(textField, k)} />)}
            </div>
          </div>
        )}

        {/* Webhook */}
        {step.type === 'webhook' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8 }}>
            <div>
              <Lbl>Método</Lbl>
              <select className="form-select" style={{ fontSize: 12 }} value={cfg.method || 'POST'} onChange={e => set('method', e.target.value)}>
                {['POST', 'GET', 'PUT', 'PATCH'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <Lbl>URL</Lbl>
              <input className="form-input" style={{ fontSize: 12 }} value={cfg.url || ''} onChange={e => set('url', e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div>
            <Lbl>Payload (JSON)</Lbl>
            <textarea className="form-textarea" style={{ fontSize: 11, fontFamily: 'monospace', minHeight: 120 }} value={cfg.payload || ''} onChange={e => set('payload', e.target.value)} />
          </div>
        </>}

        {/* Assign user */}
        {step.type === 'assign_user' && <div>
          <Lbl>Responsável a atribuir</Lbl>
          <select className="form-select" value={cfg.user_id || ''} onChange={e => {
            const u = users.find(u => u.id === parseInt(e.target.value));
            onChange({ ...step, config: { user_id: e.target.value, user_name: u?.name || '' } });
          }}>
            <option value="">Selecionar usuário...</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>}

        {/* Add note */}
        {step.type === 'add_note' && <div>
          <Lbl>Conteúdo da nota</Lbl>
          <textarea className="form-textarea" style={{ fontSize: 12, minHeight: 80 }} value={cfg.content || ''} onChange={e => set('content', e.target.value)} placeholder='Ex: Negócio "{{deal.title}}" movido para {{stage.name}}.' />
        </div>}

        {/* Set price */}
        {step.type === 'set_price' && <div>
          <Lbl>Novo valor (R$)</Lbl>
          <input type="number" className="form-input" value={cfg.price || ''} onChange={e => set('price', e.target.value)} placeholder="0.00" />
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>Substitui o valor atual do negócio.</div>
        </div>}

        {/* Modificar Elemento */}
        {step.type === 'set_field' && (
          <SetFieldEditor step={step} cfg={cfg} onChange={onChange} Lbl={Lbl} insertVar={insertVar} />
        )}

        {/* If/Else */}
        {step.type === 'if_else' && (
          <ConditionEditor step={step} onChange={onChange} />
        )}

        {/* Change Stage */}
        {step.type === 'change_stage' && (
          <ChangeStageEditor step={step} cfg={cfg} onChange={onChange} Lbl={Lbl} />
        )}

        {/* Move Pipeline */}
        {step.type === 'move_pipeline' && (
          <ChangeStageEditor step={step} cfg={cfg} onChange={onChange} Lbl={Lbl} label="Pipeline destino" />
        )}

        {/* Create Task */}
        {step.type === 'create_task' && <>
          <div>
            <Lbl>Título da tarefa</Lbl>
            <input className="form-input" style={{ fontSize: 12 }} value={cfg.title || ''} onChange={e => set('title', e.target.value)} placeholder="Ex: Tarefa: {{deal.title}}" />
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Suporta variáveis: <code style={{ fontSize: 10 }}>{'{{deal.title}}'}</code></div>
          </div>
          <div>
            <Lbl>Descrição</Lbl>
            <textarea className="form-textarea" style={{ fontSize: 12, minHeight: 60 }} value={cfg.description || ''} onChange={e => set('description', e.target.value)} placeholder="Opcional..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <Lbl>Prioridade</Lbl>
              <select className="form-select" style={{ fontSize: 12 }} value={cfg.priority || 'normal'} onChange={e => set('priority', e.target.value)}>
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <Lbl>Prazo (dias)</Lbl>
              <input type="number" className="form-input" style={{ fontSize: 12 }} value={cfg.due_days ?? 1} onChange={e => set('due_days', +e.target.value)} min={0} placeholder="1" />
            </div>
          </div>
        </>}

        {/* Pause */}
        {step.type === 'pause' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8 }}>
            <div>
              <Lbl>Quantidade</Lbl>
              <input type="number" className="form-input" style={{ fontSize: 12 }} value={cfg.delay_amount ?? 1} onChange={e => set('delay_amount', +e.target.value)} min={1} />
            </div>
            <div>
              <Lbl>Unidade</Lbl>
              <select className="form-select" style={{ fontSize: 12 }} value={cfg.delay_unit || 'hours'} onChange={e => set('delay_unit', e.target.value)}>
                <option value="minutes">Minutos</option>
                <option value="hours">Horas</option>
                <option value="days">Dias</option>
              </select>
            </div>
          </div>
          <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 7, padding: '8px 10px', fontSize: 11, color: '#854d0e' }}>
            Pausa registrada no fluxo. Na versão atual a execução é imediata; suporte a delay assíncrono em breve.
          </div>
        </>}

        {/* Send Email */}
        {step.type === 'send_email' && <>
          <div>
            <Lbl>Para (e-mail)</Lbl>
            <input className="form-input" style={{ fontSize: 12 }} value={cfg.to || ''} onChange={e => set('to', e.target.value)} placeholder="{{contact.email}}" />
          </div>
          <div>
            <Lbl>Assunto</Lbl>
            <input className="form-input" style={{ fontSize: 12 }} value={cfg.subject || ''} onChange={e => set('subject', e.target.value)} placeholder="Ex: Seu negócio foi atualizado" />
          </div>
          <div>
            <Lbl>Corpo do e-mail</Lbl>
            <textarea className="form-textarea" style={{ fontSize: 12, minHeight: 100 }} value={cfg.body || ''} onChange={e => set('body', e.target.value)} placeholder="Olá,&#10;Seu negócio &quot;{{deal.title}}&quot; foi atualizado." />
          </div>
        </>}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
// mode='automation': triggered by stage entry (AutomationsView)
// mode='workflow':   manual execution (WorkflowsView)
export default function FlowBuilderModal({
  // automation mode
  rule, stageId, pipelineId, stageName,
  // workflow mode
  workflow,
  // shared
  mode = 'automation', users, onSave, onClose,
}) {
  const isWorkflow = mode === 'workflow';

  const parseInitialSteps = () => {
    if (isWorkflow) {
      // workflow: single step with action_type='flow' containing the flow JSON
      const flowStep = workflow?.steps?.find(s => s.action_type === 'flow');
      if (flowStep) return parseFlow(flowStep.action_config);
      return [];
    }
    return parseFlow(rule?.config);
  };

  const [ruleName, setRuleName]     = useState(isWorkflow ? (workflow?.name || 'Novo fluxo') : (rule?.name || 'Nova automação'));
  const [entityType, setEntityType] = useState(isWorkflow ? (workflow?.entity_type || 'deal') : (rule?.entity_type || 'deal'));
  const [wfPipelineId, setWfPipelineId] = useState(isWorkflow ? (workflow?.pipeline_id || '') : null);
  const [isActive, setIsActive]     = useState(isWorkflow ? (workflow?.is_active !== false) : true);
  const [steps, setSteps]           = useState(parseInitialSteps);
  const [picker, setPicker]         = useState(null);
  const [active, setActiveRaw]      = useState(null);
  const [saving, setSaving]         = useState(false);
  const [pipelines, setPipelines]   = useState([]);

  useEffect(() => {
    if (isWorkflow) {
      fetch(`${API}/pipelines`).then(r => r.json()).then(d => setPipelines(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [isWorkflow]);

  const setActive = (step) => setActiveRaw(step);

  const handleEditChange = (updated) => {
    setActiveRaw(updated);
    setSteps(prev => updateById(prev, updated.id, () => updated));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isWorkflow) {
        await onSave({
          name: ruleName,
          entity_type: entityType,
          pipeline_id: wfPipelineId ? +wfPipelineId : null,
          is_active: isActive,
          steps: [{
            action_type: 'flow',
            step_order: 0,
            action_config: JSON.stringify({ version: 1, steps }),
          }],
        });
      } else {
        await onSave({
          name: ruleName,
          action_type: 'flow',
          config: JSON.stringify({ version: 1, steps }),
          stage_id: stageId,
          pipeline_id: pipelineId,
          order: rule?.order ?? 0,
          enabled: rule?.enabled ?? true,
          entity_type: entityType,
        });
      }
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', zIndex: 400, display: 'flex', flexDirection: 'column', padding: 20 }}>
      <div style={{ flex: 1, background: '#f8fafc', borderRadius: 16, boxShadow: '0 30px 80px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '12px 20px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            ← Voltar
          </button>
          <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
          <span style={{ fontSize: 12, color: isWorkflow ? '#6366f1' : '#10b981', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {isWorkflow ? '⚡ Fluxo de Trabalho' : '⚡ Automação'}
          </span>
          <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
          <input
            value={ruleName}
            onChange={e => setRuleName(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, fontWeight: 700, color: '#0f172a', background: 'transparent', fontFamily: 'inherit', minWidth: 0 }}
            placeholder={isWorkflow ? 'Nome do fluxo...' : 'Nome da regra...'}
          />
          <select value={entityType} onChange={e => setEntityType(e.target.value)} style={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', color: '#475569', background: '#f8fafc', cursor: 'pointer' }}>
            <option value="deal">Negócios</option>
            <option value="lead">Leads</option>
            <option value="any">Qualquer</option>
          </select>
          {isWorkflow ? (
            <>
              <select value={wfPipelineId} onChange={e => setWfPipelineId(e.target.value)} style={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', color: '#475569', background: '#f8fafc', cursor: 'pointer' }}>
                <option value="">Todos os pipelines</option>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button type="button" onClick={() => setIsActive(v => !v)} title={isActive ? 'Ativo' : 'Inativo'} style={{
                width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: isActive ? '#10b981' : '#e2e8f0', position: 'relative', padding: 0, flexShrink: 0,
              }}>
                <span style={{ position: 'absolute', top: 2, left: isActive ? 17 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </button>
            </>
          ) : (
            <span style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>
              Gatilho: <strong style={{ color: '#0f172a' }}>{stageName}</strong>
            </span>
          )}
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ fontSize: 13, minWidth: 110, whiteSpace: 'nowrap' }}>
            {saving ? 'Salvando...' : isWorkflow ? 'Salvar fluxo' : 'Salvar regra'}
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Canvas */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '32px 40px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 360 }}>

              {/* Trigger node */}
              <div style={{
                width: 310, borderRadius: 12, padding: '11px 14px',
                background: isWorkflow ? '#eef2ff' : '#ecfdf5',
                border: `2px solid ${isWorkflow ? '#6366f1' : '#10b981'}`,
                display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: isWorkflow ? '#6366f120' : '#10b98120', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>⚡</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: isWorkflow ? '#6366f1' : '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gatilho</div>
                  <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 600, marginTop: 1 }}>
                    {isWorkflow ? 'Execução Manual' : `Quando entrar em: ${stageName}`}
                  </div>
                </div>
              </div>

              <FlowSteps
                steps={steps}
                onUpdate={setSteps}
                activeId={active?.id}
                setActive={setActive}
                setPicker={setPicker}
              />

              {/* End node */}
              <Arrow />
              <div style={{
                border: '2px dashed #e2e8f0', borderRadius: 12, padding: '9px 24px',
                fontSize: 12, color: '#94a3b8', fontWeight: 600, background: 'white',
              }}>Fim do fluxo</div>
            </div>
          </div>

          {/* Right edit panel */}
          {active && (
            <EditPanel
              step={active}
              users={users}
              onChange={handleEditChange}
              onClose={() => setActiveRaw(null)}
            />
          )}
        </div>
      </div>

      {/* Node picker */}
      {picker && (
        <NodePicker
          onSelect={picker.onSelect}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

