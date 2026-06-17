import React, { useState, useEffect, useCallback } from 'react';
import { API_URL as API } from '../config.js';
import { useAuth } from '../AuthContext';

const LEAD_NATIVE_FIELDS = [
  { key: 'first_name',   label: 'Nome' },
  { key: 'last_name',    label: 'Sobrenome' },
  { key: 'email',        label: 'E-mail' },
  { key: 'phone',        label: 'Telefone' },
  { key: 'company_name', label: 'Empresa' },
  { key: 'comment',      label: 'Comentário' },
  { key: 'source_info',  label: 'Fonte' },
];

const CARD_NATIVE_FIELDS = [
  { key: 'title',        label: 'Título do negócio' },
  { key: 'price',        label: 'Valor', field_type: 'number' },
  { key: 'description',  label: 'Descrição' },
  { key: 'comment',      label: 'Comentário' },
  { key: 'source_info',  label: 'Fonte' },
];

const defaultField = () => ({
  key: '',
  label: '',
  required: false,
  placeholder: '',
  field_type: 'text',
});

export default function FormBuilderModal({ form, onSave, onClose }) {
  const { token } = useAuth();
  const authFetch = useCallback((url, opts = {}) => {
    const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers };
    return fetch(url, { ...opts, headers });
  }, [token]);

  const [name, setName] = useState(form?.name || 'Novo formulário');
  const [title, setTitle] = useState(form?.title || '');
  const [subtitle, setSubtitle] = useState(form?.subtitle || '');
  const [buttonText, setButtonText] = useState(form?.button_text || 'Enviar');
  const [successMessage, setSuccessMessage] = useState(
    form?.success_message || 'Obrigado! Sua resposta foi registrada.'
  );
  const [entityType, setEntityType] = useState(form?.entity_type || 'lead');
  const [pipelineId, setPipelineId] = useState(form?.pipeline_id || '');
  const [stageId, setStageId] = useState(form?.stage_id || '');
  const [fields, setFields] = useState(form?.fields_config || []);
  const [isActive, setIsActive] = useState(form?.is_active !== false);

  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [customFields, setCustomFields] = useState([]);

  useEffect(() => {
    authFetch(`${API}/pipelines`).then(r => r.json()).then(data => {
      setPipelines(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [authFetch]);

  useEffect(() => {
    if (pipelineId) {
      authFetch(`${API}/stages?pipeline_id=${pipelineId}`).then(r => r.json()).then(data => {
        setStages(Array.isArray(data) ? data : []);
      }).catch(() => {});
    } else {
      setStages([]);
    }
  }, [pipelineId, authFetch]);

  useEffect(() => {
    const entity = entityType === 'lead' ? 'lead' : 'deal';
    authFetch(`${API}/custom-fields?entity=${entity}`).then(r => r.json()).then(data => {
      setCustomFields(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [entityType, authFetch]);

  const nativeOptions = entityType === 'lead' ? LEAD_NATIVE_FIELDS : CARD_NATIVE_FIELDS;

  const allFieldOptions = [
    ...nativeOptions.map(f => ({ key: f.key, label: f.label })),
    ...customFields.map(f => ({ key: `cf:${f.id}`, label: f.name + ' (personalizado)' })),
  ];

  const addField = () => {
    setFields(prev => [...prev, defaultField()]);
  };

  const removeField = (idx) => {
    setFields(prev => prev.filter((_, i) => i !== idx));
  };

  const updateField = (idx, changes) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...changes } : f));
  };

  const handleFieldKeyChange = (idx, key) => {
    const option = allFieldOptions.find(o => o.key === key);
    updateField(idx, { key, label: option?.label || '' });
  };

  const handleSave = () => {
    onSave({
      name,
      title,
      subtitle,
      button_text: buttonText,
      success_message: successMessage,
      entity_type: entityType,
      pipeline_id: pipelineId ? parseInt(pipelineId) : null,
      stage_id: stageId ? parseInt(stageId) : null,
      is_active: isActive,
      fields_config: fields,
    }, form?.id);
  };

  // ── Live preview ──────────────────────────────────────────────────────────

  const Preview = () => (
    <div style={{
      background: '#f8fafc', borderRadius: 12, padding: '28px 24px',
      border: '1px solid #e2e8f0', maxWidth: 400,
    }}>
      {title && (
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>
          {title}
        </h2>
      )}
      {subtitle && (
        <p style={{ fontSize: 13.5, color: '#64748b', margin: '0 0 20px', lineHeight: 1.6 }}>
          {subtitle}
        </p>
      )}
      {fields.length === 0 && (
        <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
          Adicione campos para visualizar o formulário
        </div>
      )}
      {fields.map((f, i) => (
        <div key={i} style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
            {f.label || f.key || `Campo ${i + 1}`}
            {f.required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
          </label>
          {f.field_type === 'textarea' ? (
            <textarea
              disabled
              placeholder={f.placeholder}
              style={{
                width: '100%', borderRadius: 7, border: '1px solid #d1d5db',
                padding: '8px 10px', fontSize: 13.5, resize: 'vertical',
                minHeight: 72, background: '#fff', boxSizing: 'border-box',
              }}
            />
          ) : (
            <input
              disabled
              type={f.field_type === 'number' ? 'number' : 'text'}
              placeholder={f.placeholder}
              style={{
                width: '100%', borderRadius: 7, border: '1px solid #d1d5db',
                padding: '8px 10px', fontSize: 13.5, background: '#fff', boxSizing: 'border-box',
              }}
            />
          )}
        </div>
      ))}
      {fields.length > 0 && (
        <button
          disabled
          style={{
            width: '100%', padding: '10px', borderRadius: 8,
            background: '#6366f1', color: '#fff', border: 'none',
            fontWeight: 600, fontSize: 14, cursor: 'not-allowed', opacity: 0.85,
            marginTop: 4,
          }}
        >
          {buttonText || 'Enviar'}
        </button>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const inputStyle = {
    width: '100%', borderRadius: 7, border: '1px solid var(--border)',
    padding: '7px 10px', fontSize: 13, background: 'var(--bg-input)',
    color: 'var(--text-primary)', boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--text-muted)', marginBottom: 4,
  };

  const sectionStyle = {
    marginBottom: 20, padding: '14px 16px',
    background: 'var(--bg-hover)', borderRadius: 10,
    border: '1px solid var(--border)',
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100, alignItems: 'flex-start', paddingTop: 0 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: 14,
          width: '95vw', maxWidth: 1100, height: '95vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.22)', overflow: 'hidden',
          margin: 'auto',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            {form ? 'Editar formulário' : 'Novo formulário'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Salvar</button>
          </div>
        </div>

        {/* Body — two columns */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left panel */}
          <div style={{
            width: 480, flexShrink: 0, overflowY: 'auto',
            padding: '20px 20px', borderRight: '1px solid var(--border)',
          }}>
            {/* Form info */}
            <div style={sectionStyle}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Informações do formulário</div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Nome interno</label>
                <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Nome do formulário" />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Título (exibido no formulário)</label>
                <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Entre em contato" />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Subtítulo</label>
                <input style={inputStyle} value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Ex: Preencha e retornaremos em breve" />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Texto do botão</label>
                  <input style={inputStyle} value={buttonText} onChange={e => setButtonText(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Status</label>
                  <select style={inputStyle} value={isActive ? '1' : '0'} onChange={e => setIsActive(e.target.value === '1')}>
                    <option value="1">Ativo</option>
                    <option value="0">Inativo</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={labelStyle}>Mensagem de sucesso</label>
                <input style={inputStyle} value={successMessage} onChange={e => setSuccessMessage(e.target.value)} />
              </div>
            </div>

            {/* Target */}
            <div style={sectionStyle}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Destino no CRM</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Tipo de entidade</label>
                  <select style={inputStyle} value={entityType} onChange={e => { setEntityType(e.target.value); setFields([]); }}>
                    <option value="lead">Lead</option>
                    <option value="card">Negócio</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Pipeline</label>
                  <select style={inputStyle} value={pipelineId} onChange={e => { setPipelineId(e.target.value); setStageId(''); }}>
                    <option value="">— Nenhum —</option>
                    {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Etapa inicial</label>
                  <select style={inputStyle} value={stageId} onChange={e => setStageId(e.target.value)} disabled={!pipelineId}>
                    <option value="">— Primeira etapa —</option>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Fields */}
            <div style={sectionStyle}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Campos do formulário</div>
              {fields.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 12.5, marginBottom: 10, textAlign: 'center', padding: '8px 0' }}>
                  Nenhum campo. Clique em "Adicionar campo" abaixo.
                </div>
              )}
              {fields.map((field, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-card)', borderRadius: 8,
                    border: '1px solid var(--border)', padding: 12,
                    marginBottom: 8, position: 'relative',
                  }}
                >
                  <button
                    onClick={() => removeField(idx)}
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#ef4444', fontSize: 16, lineHeight: 1, padding: 0,
                    }}
                    title="Remover campo"
                  >×</button>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 2 }}>
                      <label style={labelStyle}>Campo</label>
                      <select
                        style={inputStyle}
                        value={field.key}
                        onChange={e => handleFieldKeyChange(idx, e.target.value)}
                      >
                        <option value="">— Selecionar campo —</option>
                        <optgroup label="Campos nativos">
                          {nativeOptions.map(o => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                          ))}
                        </optgroup>
                        {customFields.length > 0 && (
                          <optgroup label="Campos personalizados">
                            {customFields.map(o => (
                              <option key={o.id} value={`cf:${o.id}`}>{o.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Tipo</label>
                      <select
                        style={inputStyle}
                        value={field.field_type || 'text'}
                        onChange={e => updateField(idx, { field_type: e.target.value })}
                      >
                        <option value="text">Texto</option>
                        <option value="email">E-mail</option>
                        <option value="tel">Telefone</option>
                        <option value="number">Número</option>
                        <option value="textarea">Área de texto</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 2 }}>
                      <label style={labelStyle}>Label</label>
                      <input
                        style={inputStyle}
                        value={field.label}
                        onChange={e => updateField(idx, { label: e.target.value })}
                        placeholder="Ex: Seu nome"
                      />
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={labelStyle}>Placeholder</label>
                      <input
                        style={inputStyle}
                        value={field.placeholder}
                        onChange={e => updateField(idx, { placeholder: e.target.value })}
                        placeholder="Ex: Digite aqui..."
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 }}>
                      <label style={{ ...labelStyle, marginBottom: 6 }}>Obrig.</label>
                      <input
                        type="checkbox"
                        checked={!!field.required}
                        onChange={e => updateField(idx, { required: e.target.checked })}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                className="btn btn-ghost"
                onClick={addField}
                style={{ width: '100%', marginTop: 4, fontSize: 13 }}
              >
                + Adicionar campo
              </button>
            </div>
          </div>

          {/* Right panel — preview */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '24px',
            background: 'var(--bg-hover)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              Prévia do formulário
            </div>
            <div style={{ width: '100%', maxWidth: 420 }}>
              <Preview />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
