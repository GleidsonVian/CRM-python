import React, { useState, useEffect } from 'react';
import { useConfirm } from '../App';

const API = 'http://localhost:8001';

const ENTITIES = [
  { value: 'deal',    label: 'Negócios',  icon: '📋', desc: 'Campos que aparecem em cada card do pipeline' },
  { value: 'lead',    label: 'Leads',     icon: '🎯', desc: 'Campos que aparecem no perfil de cada lead' },
  { value: 'contact', label: 'Contatos',  icon: '👤', desc: 'Campos que aparecem no perfil de cada contato' },
  { value: 'company', label: 'Empresas',  icon: '🏢', desc: 'Campos que aparecem no perfil de cada empresa' },
  { value: 'user',    label: 'Equipe',    icon: '👥', desc: 'Campos que aparecem no perfil de cada membro' },
];

const FIELD_TYPES = [
  { value: 'text',       label: 'Texto',       icon: 'T',   desc: 'Linha de texto livre' },
  { value: 'textarea',   label: 'Texto longo', icon: '¶',   desc: 'Múltiplas linhas' },
  { value: 'number',     label: 'Número',      icon: '#',   desc: 'Valor numérico' },
  { value: 'currency',   label: 'Moeda (R$)',  icon: 'R$',  desc: 'Valor monetário' },
  { value: 'attachment', label: 'Anexo',       icon: '📎',  desc: 'Arquivos: PDF, áudio, imagem…' },
  { value: 'date',     label: 'Data',        icon: '📅',  desc: 'Seletor de data' },
  { value: 'checkbox', label: 'Sim / Não',   icon: '☑',   desc: 'Verdadeiro ou falso' },
  { value: 'select',   label: 'Lista',       icon: '▾',   desc: 'Opções predefinidas (com ID)' },
  { value: 'url',      label: 'URL',         icon: '🔗',  desc: 'Endereço web' },
  { value: 'phone',    label: 'Telefone',    icon: '📞',  desc: 'Número de telefone' },
  { value: 'email',    label: 'E-mail',      icon: '@',   desc: 'Endereço de e-mail' },
];

const EMPTY_FIELD = {
  name: '', key: '', uid: '', field_type: 'text', options: '[]',
  required: false, show_on_card: false, order: 0,
};

function slugify(str) {
  return str.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
}

// ── Option editor for "select" type ─────────────────────────────────────────
function OptionsEditor({ value, onChange }) {
  let opts = [];
  try { opts = JSON.parse(value || '[]'); } catch {}

  const nextId = opts.length > 0 ? Math.max(...opts.map(o => o.id)) + 1 : 1;
  const [newLabel, setNewLabel] = useState('');

  const addOpt = () => {
    if (!newLabel.trim()) return;
    onChange(JSON.stringify([...opts, { id: nextId, label: newLabel.trim() }]));
    setNewLabel('');
  };

  const removeOpt = (id) => onChange(JSON.stringify(opts.filter(o => o.id !== id)));

  const updateLabel = (id, label) =>
    onChange(JSON.stringify(opts.map(o => o.id === id ? { ...o, label } : o)));

  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Opções da lista
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
        {opts.map(o => (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <code style={{
              fontSize: 9, background: '#e2e8f0', color: '#6366f1',
              padding: '2px 5px', borderRadius: 3, flexShrink: 0, minWidth: 28, textAlign: 'center',
            }}>#{o.id}</code>
            <input
              className="form-input"
              style={{ fontSize: 12, flex: 1 }}
              value={o.label}
              onChange={e => updateLabel(o.id, e.target.value)}
              placeholder="Label..."
            />
            <button
              onClick={() => removeOpt(o.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
            >×</button>
          </div>
        ))}
        {opts.length === 0 && (
          <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Nenhuma opção ainda</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="form-input"
          style={{ fontSize: 12, flex: 1 }}
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="Nova opção..."
          onKeyDown={e => e.key === 'Enter' && addOpt()}
        />
        <button
          onClick={addOpt}
          className="btn btn-primary"
          style={{ fontSize: 12, padding: '0 12px' }}
          disabled={!newLabel.trim()}
        >+ Adicionar</button>
      </div>
    </div>
  );
}

// ── Field editor panel ───────────────────────────────────────────────────────
function FieldEditor({ field, entity, onSave, onCancel, isNew }) {
  const [form, setForm] = useState({
    ...EMPTY_FIELD,
    ...field,
    entity,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleNameChange = (name) => {
    set('name', name);
    if (isNew) set('key', slugify(name));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  };

  return (
    <div style={{
      width: 340, flexShrink: 0, background: 'white',
      borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#f8fafc',
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
          {isNew ? '+ Novo campo' : 'Editar campo'}
        </span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ID display (for existing) */}
        {!isNew && field.id && (
          <div style={{ background: '#0f172a', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Identificadores do campo
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 12px', alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: '#64748b' }}>UID</span>
              <code style={{ fontSize: 14, color: '#f59e0b', fontWeight: 800, letterSpacing: '0.04em' }}>{field.uid}</code>
              <span style={{ fontSize: 9, color: '#64748b' }}>ID</span>
              <code style={{ fontSize: 11, color: '#a78bfa' }}>#{field.id}</code>
              <span style={{ fontSize: 9, color: '#64748b' }}>Chave</span>
              <code style={{ fontSize: 11, color: '#38bdf8' }}>{field.key}</code>
            </div>
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #1e293b', fontSize: 10, color: '#475569' }}>
              Webhook: <code style={{ color: '#f59e0b', fontSize: 10, background: '#1e293b', padding: '1px 5px', borderRadius: 3 }}>{'{{cf.' + field.uid + '}}'}</code>
            </div>
          </div>
        )}

        {/* Name */}
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
            Nome do campo *
          </label>
          <input
            className="form-input"
            value={form.name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Ex: CNPJ, Temperatura do lead..."
            autoFocus
          />
        </div>

        {/* Key */}
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
            Chave (machine key)
          </label>
          <input
            className="form-input"
            style={{ fontFamily: 'monospace', fontSize: 12 }}
            value={form.key}
            onChange={e => set('key', slugify(e.target.value))}
            placeholder="ex: cnpj_empresa"
          />
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
            Usada em webhooks como <code style={{ fontSize: 9 }}>{'{{cf.' + (form.key || 'chave') + '}}'}</code>
          </div>
        </div>

        {/* Type */}
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Tipo do campo
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5 }}>
            {FIELD_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => set('field_type', t.value)}
                title={t.desc}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                  border: `2px solid ${form.field_type === t.value ? '#6366f1' : '#e2e8f0'}`,
                  background: form.field_type === t.value ? '#eef2ff' : 'white',
                  textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.12s',
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                  background: form.field_type === t.value ? '#6366f1' : '#f1f5f9',
                  color: form.field_type === t.value ? 'white' : '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                }}>{t.icon}</span>
                <span style={{ fontSize: 11, fontWeight: form.field_type === t.value ? 700 : 500, color: form.field_type === t.value ? '#4338ca' : '#475569' }}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Options (for select type) */}
        {form.field_type === 'select' && (
          <OptionsEditor value={form.options} onChange={v => set('options', v)} />
        )}

        {/* Required toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
          <div
            onClick={() => set('required', !form.required)}
            style={{
              width: 36, height: 20, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
              background: form.required ? '#10b981' : '#cbd5e1',
              position: 'relative', transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 3,
              left: form.required ? 18 : 3,
              width: 14, height: 14, borderRadius: '50%',
              background: 'white', transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>Campo obrigatório</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Destaca visualmente quando vazio</div>
          </div>
        </label>

        {/* Show on card toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
          <div
            onClick={() => set('show_on_card', !form.show_on_card)}
            style={{
              width: 36, height: 20, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
              background: form.show_on_card ? '#6366f1' : '#cbd5e1',
              position: 'relative', transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 3,
              left: form.show_on_card ? 18 : 3,
              width: 14, height: 14, borderRadius: '50%',
              background: 'white', transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>Mostrar no card do Kanban</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Exibe o valor na visualização do pipeline</div>
          </div>
        </label>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
        <button onClick={onCancel} className="btn" style={{ flex: 1, fontSize: 12, color: '#64748b', border: '1px solid #e2e8f0' }}>
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !form.name.trim()}
          className="btn btn-primary"
          style={{ flex: 2, fontSize: 12 }}
        >
          {saving ? 'Salvando...' : isNew ? 'Criar campo' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function CustomFieldsManager() {
  const [entity, setEntity]   = useState('deal');
  const [fields, setFields]   = useState([]);
  const confirm = useConfirm();
  const [editor, setEditor]   = useState(null);   // null | { field, isNew }
  const [deleting, setDeleting] = useState(null);

  const fetchFields = () => {
    fetch(`${API}/custom-fields?entity=${entity}`)
      .then(r => r.json())
      .then(setFields)
      .catch(() => {});
  };

  useEffect(() => { fetchFields(); }, [entity]);

  const handleSave = async (form) => {
    const isNew = !form.id;
    const url   = isNew ? `${API}/custom-fields` : `${API}/custom-fields/${form.id}`;
    const method = isNew ? 'POST' : 'PUT';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const saved = await res.json();
    setFields(prev => isNew ? [...prev, saved] : prev.map(f => f.id === saved.id ? saved : f));
    setEditor(null);
  };

  const handleDelete = async (field) => {
    if (!await confirm(`Excluir o campo "${field.name}"?`, 'Os valores preenchidos serão perdidos.')) return;
    setDeleting(field.id);
    try {
      await fetch(`${API}/custom-fields/${field.id}`, { method: 'DELETE' });
      setFields(prev => prev.filter(f => f.id !== field.id));
      if (editor?.field?.id === field.id) setEditor(null);
    } finally { setDeleting(null); }
  };

  const activeEntity = ENTITIES.find(e => e.value === entity);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>

      {/* Header */}
      <div style={{
        padding: '16px 24px', background: 'white', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>⚙️ Campos personalizados</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
            Crie campos extras para cada entidade do CRM
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => setEditor({ field: { ...EMPTY_FIELD, entity }, isNew: true })}
            className="btn btn-primary"
            style={{ fontSize: 13 }}
          >
            + Novo campo
          </button>
        </div>
      </div>

      {/* Entity tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', gap: 2, flexShrink: 0 }}>
        {ENTITIES.map(e => (
          <button
            key={e.value}
            onClick={() => { setEntity(e.value); setEditor(null); }}
            style={{
              padding: '11px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              color: entity === e.value ? '#10b981' : '#64748b',
              borderBottom: `2px solid ${entity === e.value ? '#10b981' : 'transparent'}`,
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.12s',
            }}
          >
            <span>{e.icon}</span> {e.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

        {/* Field list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* Info banner */}
          <div style={{
            background: '#f0fdf4', border: '1px solid #d1fae5', borderRadius: 10,
            padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#065f46',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <span style={{ fontSize: 14 }}>{activeEntity?.icon}</span>
            <span>{activeEntity?.desc}</span>
          </div>

          {/* Fields table */}
          {fields.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 20px',
              color: '#94a3b8', fontSize: 13,
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🗂️</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Nenhum campo personalizado</div>
              <div style={{ fontSize: 12 }}>Crie campos para capturar informações específicas do seu negócio</div>
              <button
                onClick={() => setEditor({ field: { ...EMPTY_FIELD, entity }, isNew: true })}
                className="btn btn-primary"
                style={{ marginTop: 16, fontSize: 13 }}
              >+ Criar primeiro campo</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fields.map((field, idx) => {
                const typeMeta = FIELD_TYPES.find(t => t.value === field.field_type);
                const isEditing = editor?.field?.id === field.id;
                let opts = [];
                try { opts = JSON.parse(field.options || '[]'); } catch {}

                return (
                  <div
                    key={field.id}
                    onClick={() => setEditor({ field, isNew: false })}
                    style={{
                      background: isEditing ? '#f0fdf4' : 'white',
                      border: `1.5px solid ${isEditing ? '#10b981' : '#e2e8f0'}`,
                      borderRadius: 10, padding: '12px 14px',
                      cursor: 'pointer', transition: 'all 0.12s',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}
                    onMouseEnter={e => !isEditing && (e.currentTarget.style.borderColor = '#cbd5e1')}
                    onMouseLeave={e => !isEditing && (e.currentTarget.style.borderColor = '#e2e8f0')}
                  >
                    {/* Type icon */}
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: '#6366f110',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: '#6366f1',
                    }}>{typeMeta?.icon}</div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{field.name}</span>
                        {field.required && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' }}>
                            obrigatório
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', background: '#eef2ff', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' }}>
                          {typeMeta?.label}
                        </span>
                        <code style={{ fontSize: 10, color: '#94a3b8' }}>{field.key}</code>
                        {field.field_type === 'select' && opts.length > 0 && (
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>{opts.length} opção{opts.length !== 1 ? 'ões' : ''}</span>
                        )}
                      </div>
                    </div>

                    {/* UID badge */}
                    {field.uid && (
                      <div style={{
                        background: '#1e293b', color: '#f59e0b',
                        borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700,
                        flexShrink: 0, letterSpacing: '0.04em', fontFamily: 'monospace',
                      }}>{field.uid}</div>
                    )}
                    {/* show_on_card indicator */}
                    {field.show_on_card && (
                      <div title="Visível no card do Kanban" style={{ fontSize: 13, flexShrink: 0 }}>🃏</div>
                    )}

                    {/* Delete */}
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(field); }}
                      disabled={deleting === field.id}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
                        fontSize: 14, padding: 4, borderRadius: 4, transition: 'all 0.12s', flexShrink: 0,
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                      title="Excluir campo"
                    >🗑️</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Editor panel */}
        {editor && (
          <FieldEditor
            key={editor.field?.id ?? 'new'}
            field={editor.field}
            entity={entity}
            isNew={editor.isNew}
            onSave={handleSave}
            onCancel={() => setEditor(null)}
          />
        )}
      </div>
    </div>
  );
}

