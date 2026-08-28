import React, { useState, useEffect, Fragment, useRef } from 'react';

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
  date: [
    { value: '==', label: 'igual a'        },
    { value: '!=', label: 'diferente de'   },
    { value: '>',  label: 'depois de'      },
    { value: '<',  label: 'antes de'       },
  ],
  boolean: [
    { value: '==', label: 'é verdadeiro'  },
    { value: '!=', label: 'é falso'       },
  ],
};

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

function parseFlow(configOrStr) {
  if (!configOrStr) return [];
  try {
    const p = typeof configOrStr === 'string' ? JSON.parse(configOrStr) : configOrStr;
    if (p && p.version === 1) return p.steps || [];
  } catch {}
  return [];
}

function stepSummary(step) {
  const c = step.config || {};
  switch (step.type) {
    case 'webhook': {
      if (!c.url) return 'URL não configurada';
      const mapped = Object.values(c.response_mapping || {}).filter(Boolean).length;
      return `${c.method || 'POST'} ${c.url}` + (mapped ? `  ·  preenche ${mapped} campo(s)` : '');
    }
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
      background: 'white', cursor: 'pointer', fontSize: 19, color: '#94a3b8',
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
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit',
          }}
        >×</button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: meta.color + '20',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
        }}>{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{meta.label}</div>
          <div style={{ fontSize: 14, color: '#475569', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              padding: '3px 14px', fontSize: 13, fontWeight: 700,
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
        <div style={{ fontWeight: 700, fontSize: 17, color: '#0f172a' }}>Adicionar bloco</div>
        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16, marginTop: 3 }}>Escolha uma ação ou condição lógica</div>

        {[
          { title: 'CRM', types: CRM_TYPES },
          { title: 'Ações', types: ACTION_TYPES },
          { title: 'Controle de Fluxo', types: CONTROL_TYPES },
        ].map(group => (
          <div key={group.title}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 12 }}>{group.title}</div>
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
                    <span style={{ fontSize: 22, width: 28, textAlign: 'center', flexShrink: 0 }}>{m.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <button onClick={onClose} style={{ marginTop: 16, width: '100%', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 15, color: '#64748b', fontFamily: 'inherit' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Edit Panel (right sidebar) ────────────────────────────────────────────────
// ── SetField editor ───────────────────────────────────────────────────────────
function SetFieldEditor({ step, cfg, onChange, Lbl, variables = [] }) {
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
              <span style={{ fontSize: 14, fontWeight: cfg.field === f.value ? 700 : 500, color: cfg.field === f.value ? '#0369a1' : '#475569' }}>
                {f.label}
              </span>
              <code style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>
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
                <div style={{ fontSize: 14, color: '#94a3b8', fontStyle: 'italic' }}>Carregando etapas...</div>
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
                      <span style={{ fontSize: 14, fontWeight: cfg.stage_id === s.id ? 700 : 500, color: '#0f172a' }}>{s.name}</span>
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

          {fieldDef?.type === 'number' ? (
            <input
              type="number"
              className="form-input"
              style={{ fontSize: 14 }}
              value={cfg.value || ''}
              onChange={e => set('value', e.target.value)}
              placeholder="0.00"
            />
          ) : (
            <VarInput
              as={fieldDef?.type === 'textarea' ? 'textarea' : 'input'}
              minHeight={fieldDef?.type === 'textarea' ? 70 : undefined}
              value={cfg.value}
              onChange={v => set('value', v)}
              variables={variables}
              placeholder={fieldDef?.type === 'textarea' ? 'Novo conteúdo...' : 'Novo valor...'}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Maps backend field_type to the condition type system
function cfTypeToCondType(field_type) {
  if (field_type === 'number' || field_type === 'currency') return 'number';
  if (field_type === 'date')    return 'date';
  if (field_type === 'boolean') return 'boolean';
  return 'text'; // text, textarea, select, multiselect → text operators
}

// ── Condition Editor (Se/Então visual builder) ────────────────────────────────
function ConditionEditor({ step, onChange }) {
  const [pipelines, setPipelines]   = useState([]);
  const [stages, setStages]         = useState([]);
  const [customFields, setCustomFields] = useState([]);

  useEffect(() => {
    const auth = { Authorization: `Bearer ${localStorage.getItem('nexus_token')}` };
    Promise.all([
      fetch(`${API}/custom-fields?entity=deal`,    { headers: auth }).then(r => r.json()).catch(() => []),
      fetch(`${API}/custom-fields?entity=contact`, { headers: auth }).then(r => r.json()).catch(() => []),
    ]).then(([deals, contacts]) => {
      setCustomFields([
        ...deals.map(f => ({ group: 'Campos personalizados — Negócio', value: `custom.${f.key}`, label: f.name, type: cfTypeToCondType(f.field_type), options: f.options })),
        ...contacts.map(f => ({ group: 'Campos personalizados — Contato', value: `custom_contact.${f.key}`, label: f.name, type: cfTypeToCondType(f.field_type), options: f.options })),
      ]);
    });
  }, []);

  const cond = (() => {
    try { return JSON.parse(step.condition || '{}'); } catch { return {}; }
  })();

  const setCond = (updates) => {
    onChange({ ...step, condition: JSON.stringify({ ...cond, ...updates }) });
  };

  const allConditionFields = [...CONDITION_FIELDS, ...customFields];
  const fieldDef  = allConditionFields.find(f => f.value === cond.field);
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
    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
      {children}
    </label>
  );

  const typeColors = {
    number:  { bg: '#fef3c7', color: '#b45309', label: 'numérico' },
    text:    { bg: '#f0fdf4', color: '#166534', label: 'texto'    },
    stage:   { bg: '#e0f2fe', color: '#0369a1', label: 'lista'    },
    date:    { bg: '#fdf2f8', color: '#9d174d', label: 'data'     },
    boolean: { bg: '#f5f3ff', color: '#6d28d9', label: 'booleano' },
  };
  const tc = typeColors[fieldDef?.type] || {};

  const groups = [...new Set(allConditionFields.map(f => f.group))];

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
              {allConditionFields.filter(f => f.group === group).map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {fieldDef && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <code style={{ fontSize: 12, color: '#8b5cf6', background: '#f5f3ff', padding: '1px 5px', borderRadius: 3 }}>{cond.field}</code>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '1px 5px', borderRadius: 3, background: tc.bg, color: tc.color }}>
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
                  fontSize: 13, fontWeight: cond.operator === op.value ? 700 : 500,
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
                <div style={{ fontSize: 14, color: '#94a3b8', fontStyle: 'italic' }}>Carregando etapas...</div>
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
                      <span style={{ fontSize: 14, fontWeight: cond.stage_id === s.id ? 700 : 500, color: '#0f172a' }}>{s.name}</span>
                      <code style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8', background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>ID {s.id}</code>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 8, padding: '8px 10px', background: '#f8fafc', borderRadius: 7, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Ou inserir ID manualmente:</div>
                <input
                  type="number"
                  className="form-input"
                  style={{ fontSize: 14 }}
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
            style={{ fontSize: 14 }}
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
            style={{ fontSize: 14 }}
            value={cond.value || ''}
            onChange={e => setCond({ value: e.target.value })}
            placeholder="Ex: gmail.com"
          />
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Suporta variáveis: <code style={{ fontSize: 11 }}>{'{{deal.title}}'}</code>
          </div>
        </div>
      )}

      {/* Step 3 — Value (date) */}
      {cond.field && cond.operator && fieldDef?.type === 'date' && (
        <div>
          <Lbl>3. Valor</Lbl>
          <input
            type="date"
            className="form-input"
            style={{ fontSize: 14 }}
            value={cond.value || ''}
            onChange={e => setCond({ value: e.target.value })}
          />
        </div>
      )}

      {/* Step 3 — Value (boolean) */}
      {cond.field && cond.operator && fieldDef?.type === 'boolean' && (
        <div>
          <Lbl>3. Valor</Lbl>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: 'true', label: 'Verdadeiro ✓' }, { v: 'false', label: 'Falso ✗' }].map(opt => (
              <button key={opt.v} onClick={() => setCond({ value: opt.v })}
                style={{ flex: 1, padding: '6px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: cond.value === opt.v ? 700 : 500, border: `2px solid ${cond.value === opt.v ? '#8b5cf6' : '#e2e8f0'}`, background: cond.value === opt.v ? '#f5f3ff' : 'white', color: cond.value === opt.v ? '#7c3aed' : '#475569' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {cond.field && cond.operator && (cond.value || cond.stage_name) && (() => {
        const opLabel = operators.find(o => o.value === cond.operator)?.label;
        const valLabel = fieldDef?.type === 'stage' ? cond.stage_name : cond.value;
        return (
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '9px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Preview</div>
            <div style={{ fontSize: 14, color: '#0f172a', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <code style={{ background: '#ede9fe', padding: '2px 6px', borderRadius: 3, color: '#7c3aed', fontSize: 13 }}>{cond.field}</code>
              <strong style={{ color: '#6d28d9' }}>{opLabel}</strong>
              <code style={{ background: '#ede9fe', padding: '2px 6px', borderRadius: 3, color: '#7c3aed', fontSize: 13 }}>
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
            <div style={{ fontSize: 14, color: '#94a3b8', fontStyle: 'italic' }}>Carregando etapas...</div>
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
                  <span style={{ fontSize: 14, fontWeight: cfg.stage_id === s.id ? 700 : 500, color: '#0f172a' }}>{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Variáveis: catálogo vindo do backend ─────────────────────────────────────
// O backend é a fonte da verdade das chaves ({{cf.cep}} etc). A UI nunca inventa
// nome de variável — se não veio do catálogo, o runner não saberia resolver.

const EMPTY_CATALOG = { variables: [], writable_fields: [], sample_card: null };

// O que ainda conta como "nome de campo sendo digitado" depois do "{"
const VAR_NAME_RE = /^\{?[\w.:-]*$/;

// ── Largura do painel de edicao: arrastavel e lembrada entre sessoes ─────────
const PANEL_W_KEY = 'flow_panel_width';
const PANEL_W_MIN = 280;
const PANEL_W_MAX = 900;
const PANEL_W_DEFAULT = 340;

const clampPanelW = w => Math.min(PANEL_W_MAX, Math.max(PANEL_W_MIN, Math.round(w)));

function usePanelWidth() {
  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(PANEL_W_KEY), 10);
    return Number.isFinite(saved) ? clampPanelW(saved) : PANEL_W_DEFAULT;
  });
  const [dragging, setDragging] = useState(false);

  const startDrag = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    setDragging(true);

    const onMove = ev => setWidth(clampPanelW(startW + (startX - ev.clientX)));
    const onUp = ev => {
      const final = clampPanelW(startW + (startX - ev.clientX));
      setWidth(final);
      localStorage.setItem(PANEL_W_KEY, String(final));
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const reset = () => {
    setWidth(PANEL_W_DEFAULT);
    localStorage.setItem(PANEL_W_KEY, String(PANEL_W_DEFAULT));
  };

  return { width, dragging, startDrag, reset };
}

// Alca de arraste na borda esquerda do painel
function ResizeHandle({ onMouseDown, onDoubleClick, active }) {
  const [hover, setHover] = useState(false);
  const lit = hover || active;
  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Arraste para redimensionar (duplo clique para restaurar)"
      style={{
        position: 'absolute', top: 0, bottom: 0, left: -3, width: 7,
        cursor: 'col-resize', zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        width: lit ? 3 : 1, height: '100%',
        background: lit ? '#3b82f6' : 'transparent',
        transition: 'background 0.12s, width 0.12s',
      }} />
      <div style={{
        position: 'absolute', width: 4, height: 32, borderRadius: 3,
        background: lit ? '#3b82f6' : '#cbd5e1',
        opacity: lit ? 1 : 0.6, transition: 'all 0.12s',
      }} />
    </div>
  );
}

function resolvePreview(text, variables) {
  if (!text || !text.includes('{{')) return null;
  const byKey = {};
  variables.forEach(v => { byKey[v.key] = v; });
  let unknown = false;
  const out = text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, k) => {
    const v = byKey[k.trim()];
    if (!v) { unknown = true; return `⟨${k.trim()}?⟩`; }
    return v.sample || `⟨${v.label} vazio⟩`;
  });
  return { text: out, unknown };
}

// ── Campo de texto com autocomplete de variáveis ao digitar "{" ──────────────
function VarInput({
  as = 'input', value, onChange, placeholder, variables = [],
  mono = false, minHeight, showPreview = true, autoFocus = false,
}) {
  const [open, setOpen]     = useState(false);
  const [filter, setFilter] = useState('');
  const [idx, setIdx]       = useState(0);
  const ref  = useRef(null);
  const listRef = useRef(null);

  const filtered = React.useMemo(() => {
    const f = filter.trim().toLowerCase();
    const norm = s => (s || '').toLowerCase();
    const hits = variables.filter(v =>
      !f || norm(v.key).includes(f) || norm(v.label).includes(f)
    );
    // agrupa preservando a ordem dos grupos
    const groups = [];
    hits.forEach(v => {
      let g = groups.find(x => x.name === v.group);
      if (!g) { g = { name: v.group, items: [] }; groups.push(g); }
      g.items.push(v);
    });
    return { flat: hits, groups };
  }, [variables, filter]);

  useEffect(() => { if (idx >= filtered.flat.length) setIdx(0); }, [filtered.flat.length, idx]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-i="${idx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [idx, open]);

  const openMenu = (f = '') => { setFilter(f); setIdx(0); setOpen(true); };

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    const caret = e.target.selectionStart;
    const before = val.slice(0, caret);
    const brace = before.lastIndexOf('{');
    if (brace !== -1) {
      const typed = before.slice(brace + 1).replace(/^\{/, '');
      // só mantém aberto enquanto o que foi digitado após "{" parece um nome de campo
      if (VAR_NAME_RE.test(typed) && typed.length <= 40) { openMenu(typed); return; }
    }
    setOpen(false);
  };

  const insert = (key) => {
    const el = ref.current;
    if (!el) return;
    const val = typeof value === 'string' ? value : '';
    const caret = el.selectionStart;
    const before = val.slice(0, caret);
    const after  = val.slice(caret);
    const brace = before.lastIndexOf('{');
    // se o usuário abriu com "{" (ou "{{"), substitui a partir dali; senão insere no caret
    let start = caret;
    if (brace !== -1 && VAR_NAME_RE.test(before.slice(brace + 1))) {
      start = before[brace - 1] === '{' ? brace - 1 : brace;
    }
    const token = `{{${key}}}`;
    const next = val.slice(0, start) + token + after;
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => {
      if (!ref.current) return;
      const pos = start + token.length;
      ref.current.focus();
      ref.current.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === ' ' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openMenu(''); }
      return;
    }
    const n = filtered.flat.length;
    if (e.key === 'ArrowDown')      { e.preventDefault(); setIdx(i => (i + 1) % Math.max(n, 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => (i - 1 + n) % Math.max(n, 1)); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      if (n > 0) { e.preventDefault(); insert(filtered.flat[idx].key); }
    }
    else if (e.key === 'Escape')    { e.preventDefault(); setOpen(false); }
  };

  const preview = showPreview ? resolvePreview(value, variables) : null;

  const inputStyle = {
    fontSize: mono ? 13 : 14,
    fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
    ...(minHeight ? { minHeight } : {}),
  };

  const Tag = as === 'textarea' ? 'textarea' : 'input';

  return (
    <div style={{ position: 'relative' }}>
      <Tag
        ref={ref}
        {...(as === 'input' ? { type: 'text' } : {})}
        className={as === 'textarea' ? 'form-textarea' : 'form-input'}
        style={inputStyle}
        placeholder={placeholder}
        value={value || ''}
        autoFocus={autoFocus}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />

      {/* dica discreta, para o recurso não ficar escondido */}
      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3 }}>
        Digite <code style={{ background: '#f1f5f9', padding: '0 3px', borderRadius: 3 }}>{'{'}</code> para inserir um campo do CRM
      </div>

      {preview && (
        <div style={{
          marginTop: 4, fontSize: 12, lineHeight: 1.45, padding: '5px 7px', borderRadius: 6,
          background: preview.unknown ? '#fffbeb' : '#f0fdf4',
          border: `1px solid ${preview.unknown ? '#fde68a' : '#bbf7d0'}`,
          color: preview.unknown ? '#92400e' : '#166534',
          wordBreak: 'break-word', whiteSpace: 'pre-wrap',
          maxHeight: 88, overflowY: 'auto',
        }}>
          <strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.75 }}>
            {preview.unknown ? 'Prévia — variável desconhecida' : 'Prévia com dados reais'}
          </strong>
          <div style={{ marginTop: 2 }}>{preview.text}</div>
        </div>
      )}

      {open && (
        <div
          ref={listRef}
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
            marginTop: 2, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
            boxShadow: '0 10px 28px rgba(15,23,42,0.18)', maxHeight: 230, overflowY: 'auto',
          }}
        >
          {filtered.flat.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 13, color: '#94a3b8' }}>
              Nenhum campo com “{filter}”.
            </div>
          ) : filtered.groups.map(g => (
            <div key={g.name}>
              <div style={{
                position: 'sticky', top: 0, background: '#f8fafc', padding: '4px 10px',
                fontSize: 11, fontWeight: 800, color: '#64748b',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                borderBottom: '1px solid #eef2f6',
              }}>{g.name}</div>
              {g.items.map(item => {
                const i = filtered.flat.indexOf(item);
                const on = i === idx;
                return (
                  <div
                    key={item.key}
                    data-i={i}
                    onMouseDown={e => { e.preventDefault(); insert(item.key); }}
                    onMouseEnter={() => setIdx(i)}
                    style={{
                      padding: '5px 10px', cursor: 'pointer',
                      background: on ? '#eff6ff' : 'transparent',
                      borderLeft: `3px solid ${on ? '#3b82f6' : 'transparent'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{item.label}</span>
                      <code style={{ fontSize: 11.5, color: '#64748b', whiteSpace: 'nowrap' }}>{`{{${item.key}}}`}</code>
                    </div>
                    {item.sample ? (
                      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        agora: {item.sample}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Seletor de campo do CRM (destino de gravação), agrupado ──────────────────
function CrmFieldSelect({ value, onChange, fields, placeholder = '— não gravar —' }) {
  const groups = [];
  fields.forEach(f => {
    let g = groups.find(x => x.name === f.group);
    if (!g) { g = { name: f.group, items: [] }; groups.push(g); }
    g.items.push(f);
  });
  return (
    <select
      className="form-select"
      style={{ fontSize: 13, padding: '4px 6px' }}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {groups.map(g => (
        <optgroup key={g.name} label={g.name}>
          {g.items.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

// ── Editor de cabeçalhos HTTP ────────────────────────────────────────────────
function HeadersEditor({ headers = {}, onChange, variables }) {
  const rows = Object.entries(headers);
  const setRow = (i, k, v) => {
    const next = {};
    rows.forEach(([ok, ov], j) => { if (j === i) { if (k) next[k] = v; } else next[ok] = ov; });
    onChange(next);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 22px', gap: 4 }}>
          <input className="form-input" style={{ fontSize: 12.5, padding: '3px 6px' }}
            value={k} placeholder="Authorization"
            onChange={e => setRow(i, e.target.value, v)} />
          <input className="form-input" style={{ fontSize: 12.5, padding: '3px 6px' }}
            value={v} placeholder="Bearer ..."
            onChange={e => setRow(i, k, e.target.value)} />
          <button type="button" onClick={() => setRow(i, '', '')}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 17 }}
            title="Remover">×</button>
        </div>
      ))}
      <button type="button"
        onClick={() => onChange({ ...headers, '': '' })}
        style={{ alignSelf: 'flex-start', border: '1px dashed #cbd5e1', background: 'none',
                 borderRadius: 6, padding: '2px 8px', fontSize: 12, color: '#64748b',
                 cursor: 'pointer', fontFamily: 'inherit' }}>
        + cabeçalho
      </button>
    </div>
  );
}

function Section({ n, title, hint, children, done }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    background: done ? '#f0fdf4' : '#f8fafc', borderBottom: '1px solid #eef2f6' }}>
        <span style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          background: done ? '#16a34a' : '#94a3b8', color: '#fff',
          fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{done ? '✓' : n}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{title}</div>
          {hint && <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{hint}</div>}
        </div>
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>{children}</div>
    </div>
  );
}

// ── Editor do nó Webhook: configurar → testar → mapear a resposta ────────────
function WebhookEditor({ step, cfg, onChange, catalog, Lbl }) {
  const variables = catalog.variables || [];
  const writable  = catalog.writable_fields || [];
  const mapping   = cfg.response_mapping || {};

  const [testing, setTesting]   = useState(false);
  const [result, setResult]     = useState(null);
  const [overrides, setOverrides] = useState({});
  const [showReq, setShowReq]   = useState(false);
  const [showHeaders, setShowHeaders] = useState(Object.keys(cfg.headers || {}).length > 0);

  const set = (k, v) => onChange({ ...step, config: { ...cfg, [k]: v } });
  const setMapping = (m) => onChange({ ...step, config: { ...cfg, response_mapping: m } });

  const method  = (cfg.method || 'POST').toUpperCase();
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);

  // variáveis usadas nos templates — o painel de teste deixa sobrescrever cada uma
  const usedVars = React.useMemo(() => {
    const src = `${cfg.url || ''} ${cfg.payload || ''} ${Object.values(cfg.headers || {}).join(' ')}`;
    return Array.from(new Set(Array.from(src.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g), m => m[1].trim())));
  }, [cfg.url, cfg.payload, cfg.headers]);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/automations/test-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('nexus_token')}`,
        },
        body: JSON.stringify({
          url: cfg.url || '',
          method,
          payload: hasBody ? (cfg.payload || '') : '',
          headers: cfg.headers || {},
          card_id: catalog.sample_card?.id || null,
          overrides: Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== '')),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Falha ao testar');
      setResult(data);
    } catch (e) {
      setResult({ ok: false, error: e.message || 'Erro ao testar', fields: [], status: null });
    } finally {
      setTesting(false);
    }
  };

  // linhas de mapeamento: o que o teste devolveu + o que já estava salvo
  const rows = React.useMemo(() => {
    const seen = new Map();
    (result?.fields || []).forEach(f => seen.set(f.path, { ...f, fromTest: true }));
    Object.keys(mapping).forEach(p => {
      if (!seen.has(p)) seen.set(p, { path: p, sample: '', type: '', fromTest: false });
    });
    return Array.from(seen.values());
  }, [result, mapping]);

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* 1 — requisição */}
      <Section n={1} title="A requisição" hint="Para onde e o que enviar" done={!!cfg.url}>
        <div style={{ display: 'grid', gridTemplateColumns: '82px 1fr', gap: 6 }}>
          <div>
            <Lbl>Método</Lbl>
            <select className="form-select" style={{ fontSize: 14 }} value={method}
              onChange={e => set('method', e.target.value)}>
              {['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <Lbl>URL</Lbl>
            <VarInput value={cfg.url} onChange={v => set('url', v)} variables={variables}
              placeholder="https://viacep.com.br/ws/{{cf.cep}}/json/" />
          </div>
        </div>

        <div>
          <button type="button" onClick={() => setShowHeaders(v => !v)}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                     fontSize: 12.5, color: '#3b82f6', fontFamily: 'inherit' }}>
            {showHeaders ? '▾' : '▸'} Cabeçalhos {Object.keys(cfg.headers || {}).length ? `(${Object.keys(cfg.headers).length})` : '(opcional)'}
          </button>
          {showHeaders && (
            <div style={{ marginTop: 6 }}>
              <HeadersEditor headers={cfg.headers || {}} onChange={h => set('headers', h)} variables={variables} />
            </div>
          )}
        </div>

        {hasBody && (
          <div>
            <Lbl>Corpo (JSON)</Lbl>
            <VarInput as="textarea" mono minHeight={100}
              value={cfg.payload} onChange={v => set('payload', v)} variables={variables} />
          </div>
        )}
      </Section>

      {/* 2 — teste */}
      <Section n={2} title="Testar agora" hint={
        catalog.sample_card
          ? `Usa dados reais de: ${catalog.sample_card.title}`
          : 'Nenhum negócio disponível para amostra'
      } done={!!result?.ok}>

        {usedVars.length > 0 && (
          <div>
            <Lbl>Valores do teste</Lbl>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {usedVars.map(v => {
                const def = variables.find(x => x.key === v);
                return (
                  <div key={v} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#475569', overflow: 'hidden',
                                   textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v}>
                      {def ? def.label : <span style={{ color: '#f59e0b' }}>⚠ {v}</span>}
                    </span>
                    <input className="form-input" style={{ fontSize: 12.5, padding: '3px 6px' }}
                      placeholder={def?.sample || 'vazio no CRM'}
                      value={overrides[v] ?? ''}
                      onChange={e => setOverrides(o => ({ ...o, [v]: e.target.value }))} />
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
              Em branco = usa o valor real do negócio acima.
            </div>
          </div>
        )}

        <button type="button" onClick={runTest} disabled={testing || !cfg.url}
          style={{
            width: '100%', padding: '7px', borderRadius: 8, cursor: cfg.url ? 'pointer' : 'not-allowed',
            border: '1px solid #bfdbfe', background: cfg.url ? '#eff6ff' : '#f8fafc',
            color: cfg.url ? '#1d4ed8' : '#94a3b8', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
          }}>
          {testing ? 'Disparando…' : '▶ Disparar teste'}
        </button>

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700,
              padding: '5px 8px', borderRadius: 6,
              background: result.ok ? '#f0fdf4' : '#fef2f2',
              color: result.ok ? '#15803d' : '#b91c1c',
              border: `1px solid ${result.ok ? '#bbf7d0' : '#fecaca'}`,
            }}>
              {result.ok ? '✓' : '✕'}
              {result.status ? `HTTP ${result.status}` : 'Sem resposta'}
              {result.error ? <span style={{ fontWeight: 500, fontSize: 12 }}>— {result.error}</span> : null}
            </div>

            {result.request && (
              <div>
                <button type="button" onClick={() => setShowReq(v => !v)}
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                           fontSize: 12.5, color: '#3b82f6', fontFamily: 'inherit' }}>
                  {showReq ? '▾' : '▸'} O que foi enviado
                </button>
                {showReq && (
                  <pre style={{
                    marginTop: 5, fontSize: 11.5, background: '#f8fafc', border: '1px solid #e2e8f0',
                    color: '#334155', padding: 7, borderRadius: 6, maxHeight: 120, overflow: 'auto',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  }}>{`${result.request.method} ${result.request.url}\n${result.request.payload || ''}`}</pre>
                )}
              </div>
            )}

            {result.body ? (
              <div>
                <Lbl>Resposta</Lbl>
                <pre style={{
                  fontSize: 11.5, background: '#0f172a', color: '#7dd3fc', padding: 8, borderRadius: 6,
                  maxHeight: 130, overflow: 'auto', margin: 0,
                  fontFamily: 'ui-monospace, Menlo, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>{result.json ? JSON.stringify(result.json, null, 2) : result.body}</pre>
                {!result.json && result.body && (
                  <div style={{ fontSize: 11.5, color: '#f59e0b', marginTop: 3 }}>
                    ⚠ A resposta não é JSON — não é possível mapear em campos.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </Section>

      {/* 3 — mapeamento */}
      <Section n={3}
        title="Gravar a resposta em campos"
        hint={mappedCount ? `${mappedCount} campo(s) mapeado(s)` : 'Escolha onde salvar cada valor devolvido'}
        done={mappedCount > 0}>

        {rows.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5 }}>
            Dispare o teste acima para ver os valores que a API devolve e escolher,
            em cada um, o campo do CRM que deve ser preenchido.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {rows.map(r => {
              const target = mapping[r.path] || '';
              return (
                <div key={r.path} style={{
                  border: `1px solid ${target ? '#bbf7d0' : '#eef2f6'}`,
                  background: target ? '#f0fdf4' : '#f8fafc',
                  borderRadius: 7, padding: 6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'baseline' }}>
                    <code style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{r.path}</code>
                    {r.sample ? (
                      <span style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic',
                                     overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}
                        title={r.sample}>{r.sample}</span>
                    ) : (!r.fromTest && result) ? (
                      <span style={{ fontSize: 11, color: '#f59e0b' }}>não veio no último teste</span>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>→</span>
                    <div style={{ flex: 1 }}>
                      <CrmFieldSelect
                        value={target}
                        fields={writable}
                        onChange={v => {
                          const next = { ...mapping };
                          if (v) next[r.path] = v; else delete next[r.path];
                          setMapping(next);
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {mappedCount > 0 && (
              <button type="button" onClick={() => setMapping({})}
                style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0,
                         cursor: 'pointer', fontSize: 12, color: '#94a3b8', fontFamily: 'inherit' }}>
                limpar mapeamento
              </button>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

function EditPanel({ step, users, catalog = EMPTY_CATALOG, onChange, onClose,
                     width = PANEL_W_DEFAULT, resize }) {
  const variables = catalog.variables || [];
  const meta = NODE_META[step.type] || {};
  const cfg = step.config || {};
  const set = (k, v) => onChange({ ...step, config: { ...cfg, [k]: v } });

  const Lbl = ({ children }) => (
    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
      {children}
    </label>
  );

  return (
    <div style={{
      width, flexShrink: 0, borderLeft: '1px solid #e2e8f0', position: 'relative',
      display: 'flex', flexDirection: 'column', background: 'white',
    }}>
      {resize && (
        <ResizeHandle
          onMouseDown={resize.startDrag}
          onDoubleClick={resize.reset}
          active={resize.dragging}
        />
      )}

      {/* Panel header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: meta.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{meta.icon}</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: meta.color }}>{meta.label}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Webhook */}
        {step.type === 'webhook' && (
          <WebhookEditor step={step} cfg={cfg} onChange={onChange} catalog={catalog} Lbl={Lbl} />
        )}

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
          <VarInput
              as="textarea"
            style={{ fontSize: 14, minHeight: 80 }}
            value={cfg.content || ''}
            onChange={val => set('content', val)}
            placeholder='Ex: Negócio "{{deal.title}}" movido para {{stage.name}}.'
            variables={variables}
          />
        </div>}

        {/* Set price */}
        {step.type === 'set_price' && <div>
          <Lbl>Novo valor (R$)</Lbl>
          <input type="number" className="form-input" value={cfg.price || ''} onChange={e => set('price', e.target.value)} placeholder="0.00" />
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 5 }}>Substitui o valor atual do negócio.</div>
        </div>}

        {/* Modificar Elemento */}
        {step.type === 'set_field' && (
          <SetFieldEditor step={step} cfg={cfg} onChange={onChange} Lbl={Lbl} variables={variables} />
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
            <VarInput
              style={{ fontSize: 14 }}
              value={cfg.title || ''}
              onChange={val => set('title', val)}
              placeholder="Ex: Tarefa: {{deal.title}}"
              variables={variables}
            />
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Suporta variáveis: <code style={{ fontSize: 12 }}>{'{{deal.title}}'}</code></div>
          </div>
          <div>
            <Lbl>Descrição</Lbl>
            <VarInput
              as="textarea"
              style={{ fontSize: 14, minHeight: 60 }}
              value={cfg.description || ''}
              onChange={val => set('description', val)}
              placeholder="Opcional..."
              variables={variables}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <Lbl>Prioridade</Lbl>
              <select className="form-select" style={{ fontSize: 14 }} value={cfg.priority || 'normal'} onChange={e => set('priority', e.target.value)}>
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <Lbl>Prazo (dias)</Lbl>
              <input type="number" className="form-input" style={{ fontSize: 14 }} value={cfg.due_days ?? 1} onChange={e => set('due_days', +e.target.value)} min={0} placeholder="1" />
            </div>
          </div>
        </>}

        {/* Pause */}
        {step.type === 'pause' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8 }}>
            <div>
              <Lbl>Quantidade</Lbl>
              <input type="number" className="form-input" style={{ fontSize: 14 }} value={cfg.delay_amount ?? 1} onChange={e => set('delay_amount', +e.target.value)} min={1} />
            </div>
            <div>
              <Lbl>Unidade</Lbl>
              <select className="form-select" style={{ fontSize: 14 }} value={cfg.delay_unit || 'hours'} onChange={e => set('delay_unit', e.target.value)}>
                <option value="minutes">Minutos</option>
                <option value="hours">Horas</option>
                <option value="days">Dias</option>
              </select>
            </div>
          </div>
          <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 7, padding: '8px 10px', fontSize: 13, color: '#854d0e' }}>
            Pausa registrada no fluxo. Na versão atual a execução é imediata; suporte a delay assíncrono em breve.
          </div>
        </>}

        {/* Send Email */}
        {step.type === 'send_email' && <>
          <div>
            <Lbl>Para (e-mail)</Lbl>
            <VarInput
              style={{ fontSize: 14 }}
              value={cfg.to || ''}
              onChange={val => set('to', val)}
              placeholder="{{contact.email}}"
              variables={variables}
            />
          </div>
          <div>
            <Lbl>Assunto</Lbl>
            <VarInput
              style={{ fontSize: 14 }}
              value={cfg.subject || ''}
              onChange={val => set('subject', val)}
              placeholder="Ex: Seu negócio foi atualizado"
              variables={variables}
            />
          </div>
          <div>
            <Lbl>Corpo do e-mail</Lbl>
            <VarInput
              as="textarea"
              style={{ fontSize: 14, minHeight: 100 }}
              value={cfg.body || ''}
              onChange={val => set('body', val)}
              placeholder="Olá,&#10;Seu negócio &quot;{{deal.title}}&quot; foi atualizado."
              variables={variables}
            />
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
  const [saveError, setSaveError]   = useState('');
  const [justSaved, setJustSaved]   = useState(false);
  const [pipelines, setPipelines]   = useState([]);
  const [catalog, setCatalog]       = useState(EMPTY_CATALOG);
  const panel                       = usePanelWidth();

  // Catalogo de campos/variaveis: fonte unica de verdade, vem do backend
  useEffect(() => {
    const ent = entityType === 'any' ? 'deal' : entityType;
    fetch(`${API}/automations/field-catalog?entity=${ent}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('nexus_token')}` },
    })
      .then(r => r.json())
      .then(d => setCatalog({ ...EMPTY_CATALOG, ...(d || {}) }))
      .catch(() => setCatalog(EMPTY_CATALOG));
  }, [entityType]);

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

  const handleSave = async ({ close = true } = {}) => {
    setSaving(true);
    setSaveError('');
    setJustSaved(false);
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
            action_config: { version: 1, steps },
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
      if (close) {
        onClose();
      } else {
        // fica na tela: so confirma visualmente que gravou
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2200);
      }
    } catch (e) {
      setSaveError(e.message || 'Erro ao salvar');
      setTimeout(() => setSaveError(''), 5000);
    } finally { setSaving(false); }
  };

  // Ctrl+S / Cmd+S = salvar sem sair do editor
  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveRef.current({ close: false });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', zIndex: 400, display: 'flex', flexDirection: 'column', padding: 20 }}>
      <div style={{ flex: 1, background: '#f8fafc', borderRadius: 16, boxShadow: '0 30px 80px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '12px 20px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 15, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            ← Voltar
          </button>
          <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
          <span style={{ fontSize: 14, color: isWorkflow ? '#6366f1' : '#10b981', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {isWorkflow ? '⚡ Fluxo de Trabalho' : '⚡ Automação'}
          </span>
          <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
          <input
            value={ruleName}
            onChange={e => setRuleName(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 17, fontWeight: 700, color: '#0f172a', background: 'transparent', fontFamily: 'inherit', minWidth: 0 }}
            placeholder={isWorkflow ? 'Nome do fluxo...' : 'Nome da regra...'}
          />
          <select value={entityType} onChange={e => setEntityType(e.target.value)} style={{ fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', color: '#475569', background: '#f8fafc', cursor: 'pointer' }}>
            <option value="deal">Negócios</option>
            <option value="lead">Leads</option>
            <option value="any">Qualquer</option>
          </select>
          {isWorkflow ? (
            <>
              <select value={wfPipelineId} onChange={e => setWfPipelineId(e.target.value)} style={{ fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', color: '#475569', background: '#f8fafc', cursor: 'pointer' }}>
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
            <span style={{ fontSize: 14, color: '#64748b', background: '#f1f5f9', padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>
              Gatilho: <strong style={{ color: '#0f172a' }}>{stageName}</strong>
            </span>
          )}
          {saveError && (
            <span style={{ fontSize: 14, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ⚠ {saveError}
            </span>
          )}
          <button
            onClick={() => handleSave({ close: false })}
            disabled={saving}
            title="Salvar e continuar editando (Ctrl+S)"
            style={{
              fontSize: 15, minWidth: 92, whiteSpace: 'nowrap', cursor: saving ? 'default' : 'pointer',
              padding: '6px 12px', borderRadius: 8, fontFamily: 'inherit', fontWeight: 700,
              border: `1px solid ${justSaved ? '#86efac' : '#cbd5e1'}`,
              background: justSaved ? '#f0fdf4' : 'white',
              color: justSaved ? '#15803d' : '#475569',
              transition: 'all 0.15s',
            }}
          >
            {saving ? 'Salvando…' : justSaved ? '✓ Salvo' : 'Salvar'}
          </button>
          <button onClick={() => handleSave({ close: true })} disabled={saving} className="btn btn-primary" style={{ fontSize: 15, minWidth: 110, whiteSpace: 'nowrap' }}>
            {saving ? 'Salvando...' : isWorkflow ? 'Salvar e sair' : 'Salvar e sair'}
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Canvas */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'auto', padding: '32px 40px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 360 }}>

              {/* Trigger node */}
              <div style={{
                width: 310, borderRadius: 12, padding: '11px 14px',
                background: isWorkflow ? '#eef2ff' : '#ecfdf5',
                border: `2px solid ${isWorkflow ? '#6366f1' : '#10b981'}`,
                display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: isWorkflow ? '#6366f120' : '#10b98120', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>⚡</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isWorkflow ? '#6366f1' : '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gatilho</div>
                  <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 600, marginTop: 1 }}>
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
                fontSize: 14, color: '#94a3b8', fontWeight: 600, background: 'white',
              }}>Fim do fluxo</div>
            </div>
          </div>

          {/* Right edit panel */}
          {active && (
            <EditPanel
              step={active}
              users={users}
              catalog={catalog}
              width={panel.width}
              resize={panel}
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

