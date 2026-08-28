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
  const [displayRules, setDisplayRules] = useState(form?.display_rules || []);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [previewValues, setPreviewValues] = useState({});
  const [leftTab, setLeftTab] = useState('fields'); // 'fields' | 'rules' | 'settings'

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

  // ── Display rules helpers ─────────────────────────────────────────────────
  const addRule = () => {
    setDisplayRules(prev => [...prev, {
      id: `rule_${Date.now()}`,
      trigger_field: '',
      trigger_value: '',
      action: 'show',
      target_fields: [],
    }]);
  };

  const removeRule = (id) => {
    setDisplayRules(prev => prev.filter(r => r.id !== id));
  };

  const updateRule = (id, changes) => {
    setDisplayRules(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
  };

  const toggleRuleTarget = (id, fieldKey) => {
    setDisplayRules(prev => prev.map(r => {
      if (r.id !== id) return r;
      const has = r.target_fields.includes(fieldKey);
      return { ...r, target_fields: has ? r.target_fields.filter(k => k !== fieldKey) : [...r.target_fields, fieldKey] };
    }));
  };

  const TEMPLATES = {
    contato: {
      name: 'Formulário de Contato',
      title: 'Entre em contato',
      subtitle: 'Preencha o formulário e entraremos em contato em breve.',
      button_text: 'Enviar mensagem',
      success_message: 'Mensagem enviada! Em breve entraremos em contato.',
      entity_type: 'lead',
      fields: [
        { key: 'first_name',   label: 'Nome',     required: true,  placeholder: 'Seu nome',       field_type: 'text' },
        { key: 'last_name',    label: 'Sobrenome', required: false, placeholder: 'Seu sobrenome',  field_type: 'text' },
        { key: 'email',        label: 'E-mail',    required: true,  placeholder: 'seu@email.com',  field_type: 'text' },
        { key: 'phone',        label: 'Telefone',  required: false, placeholder: '(11) 99999-9999', field_type: 'text' },
        { key: 'comment',      label: 'Mensagem',  required: false, placeholder: 'Como podemos ajudar?', field_type: 'textarea' },
      ],
    },
    orcamento: {
      name: 'Solicitação de Orçamento',
      title: 'Solicite um orçamento',
      subtitle: 'Preencha os dados abaixo para receber nossa proposta.',
      button_text: 'Solicitar orçamento',
      success_message: 'Solicitação recebida! Em breve enviaremos sua proposta.',
      entity_type: 'deal',
      fields: [
        { key: 'first_name',   label: 'Nome',      required: true,  placeholder: 'Seu nome',       field_type: 'text' },
        { key: 'email',        label: 'E-mail',     required: true,  placeholder: 'seu@email.com',  field_type: 'text' },
        { key: 'phone',        label: 'Telefone',   required: true,  placeholder: '(11) 99999-9999', field_type: 'text' },
        { key: 'company_name', label: 'Empresa',    required: false, placeholder: 'Nome da empresa', field_type: 'text' },
        { key: 'comment',      label: 'Descrição',  required: false, placeholder: 'Descreva o que você precisa', field_type: 'textarea' },
      ],
    },
  };

  const applyTemplate = (tplKey) => {
    const tpl = TEMPLATES[tplKey];
    setName(tpl.name);
    setTitle(tpl.title);
    setSubtitle(tpl.subtitle);
    setButtonText(tpl.button_text);
    setSuccessMessage(tpl.success_message);
    setEntityType(tpl.entity_type);
    setFields(tpl.fields);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await onSave({
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
        display_rules: displayRules,
      }, form?.id);
    } catch (e) {
      setSaveError(e.message || 'Erro ao salvar formulário');
    } finally {
      setSaving(false);
    }
  };

  // ── Live preview — identical to PublicForm ────────────────────────────────

  const inputBase = {
    width: '100%', borderRadius: 8, border: '1.5px solid #d1d5db',
    padding: '10px 12px', fontSize: 16, color: '#1e293b',
    background: '#fff', boxSizing: 'border-box', outline: 'none',
    transition: 'border-color 0.15s',
  };

  const isFieldVisible = (field, vals, rules) => {
    const activeRules = (rules || displayRules).filter(r => r.target_fields?.includes(field.key));
    for (const rule of activeRules) {
      const actual = (vals[rule.trigger_field] || '').toString().toLowerCase().trim();
      const expected = (rule.trigger_value || '').toString().toLowerCase().trim();
      const condMet = actual === expected;
      if (rule.action === 'show' && !condMet) return false;
      if (rule.action === 'hide' && condMet) return false;
    }
    // Legacy per-field condition
    const cond = field.condition;
    if (cond?.field_key) {
      const actual = (vals[cond.field_key] || '').toString().toLowerCase().trim();
      const expected = (cond.value || '').toString().toLowerCase().trim();
      if (actual !== expected) return false;
    }
    return true;
  };

  const Preview = ({ compact = false }) => (
    <div style={{
      background: '#fff', borderRadius: compact ? 12 : 16,
      padding: compact ? '24px 20px' : '40px 36px',
      boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
      width: '100%', maxWidth: compact ? 420 : 500,
    }}>
      {title && (
        <h1 style={{ fontSize: compact ? 22 : 26, fontWeight: 800, color: '#1e293b', margin: '0 0 8px', lineHeight: 1.2 }}>
          {title}
        </h1>
      )}
      {subtitle && (
        <p style={{ fontSize: 16, color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
          {subtitle}
        </p>
      )}
      {fields.length === 0 ? (
        <div style={{ color: '#94a3b8', fontSize: 15, textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
          Adicione campos para visualizar o formulário
        </div>
      ) : (
        <div>
          {fields.map((f, i) => {
            if (!isFieldVisible(f, previewValues)) return null;
            return (
              <div key={i} style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 15.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  {f.label || f.key || `Campo ${i + 1}`}
                  {f.required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
                </label>
                {f.field_type === 'textarea' ? (
                  <textarea
                    placeholder={f.placeholder}
                    value={previewValues[f.key] || ''}
                    onChange={e => setPreviewValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ ...inputBase, minHeight: 90, resize: 'vertical' }}
                  />
                ) : (
                  <input
                    type={f.field_type || 'text'}
                    placeholder={f.placeholder}
                    value={previewValues[f.key] || ''}
                    onChange={e => setPreviewValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={inputBase}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#d1d5db'}
                  />
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => {}}
            style={{
              width: '100%', padding: '12px', borderRadius: 9,
              background: '#6366f1', color: '#fff', border: 'none',
              fontWeight: 700, fontSize: 17, cursor: 'pointer', marginTop: 4,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#4f46e5'}
            onMouseLeave={e => e.currentTarget.style.background = '#6366f1'}
          >
            {buttonText || 'Enviar'}
          </button>
          <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
            Prévia — o envio não funciona aqui
          </p>
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const inputStyle = {
    width: '100%', borderRadius: 7, border: '1px solid var(--border)',
    padding: '7px 10px', fontSize: 15, background: 'var(--bg-input)',
    color: 'var(--text-primary)', boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block', fontSize: 14, fontWeight: 600,
    color: 'var(--text-muted)', marginBottom: 4,
  };

  const sectionStyle = {
    marginBottom: 20, padding: '14px 16px',
    background: 'var(--bg-hover)', borderRadius: 10,
    border: '1px solid var(--border)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-card)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', borderBottom: '1px solid var(--border)',
        flexShrink: 0, background: 'var(--bg-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 15, padding: '5px 10px' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Formulários
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>
            {form ? name : 'Novo formulário'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {!form && (
            <>
              <span style={{ fontSize: 14, color: 'var(--text-muted)', marginRight: 2 }}>Modelos:</span>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 14, padding: '4px 10px' }}
                onClick={() => applyTemplate('contato')}
              >
                📋 Contato
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 14, padding: '4px 10px' }}
                onClick={() => applyTemplate('orcamento')}
              >
                💼 Orçamento
              </button>
              <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
            </>
          )}
          {saveError && (
            <span style={{ fontSize: 14, color: '#ef4444', background: '#fef2f2', padding: '4px 10px', borderRadius: 6 }}>
              ⚠ {saveError}
            </span>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => { setPreviewValues({}); setFullscreenPreview(true); }}
            style={{ fontSize: 14, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1 5V1h4M8 1h4v4M12 8v4H8M5 12H1V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Visualizar
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Body — two columns */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel */}
        <div style={{
          width: 500, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderRight: '1px solid var(--border)',
        }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex', borderBottom: '1px solid var(--border)',
            background: 'var(--bg-hover)', flexShrink: 0,
          }}>
            {[
              { key: 'fields',   label: 'Campos' },
              { key: 'rules',    label: 'Regras de exibição' },
              { key: 'settings', label: 'Configurações' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setLeftTab(tab.key)}
                style={{
                  padding: '10px 16px', fontSize: 14.5, fontWeight: leftTab === tab.key ? 700 : 400,
                  color: leftTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: leftTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1, transition: 'all 0.15s',
                }}
              >
                {tab.label}
                {tab.key === 'rules' && displayRules.length > 0 && (
                  <span style={{
                    marginLeft: 5, background: 'var(--accent)', color: '#fff',
                    borderRadius: 8, fontSize: 12, padding: '1px 5px', fontWeight: 700,
                  }}>{displayRules.length}</span>
                )}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {leftTab === 'settings' && <>
            {/* Form info */}
            <div style={sectionStyle}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Informações do formulário</div>
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
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Destino no CRM</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Tipo de entidade</label>
                  <select style={inputStyle} value={entityType} onChange={e => { setEntityType(e.target.value); setFields([]); setPipelineId(''); setStageId(''); }}>
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
                    {pipelines
                      .filter(p => entityType === 'lead' ? p.name === 'Leads' : p.name !== 'Leads')
                      .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
            </>}

            {/* ── Rules tab ── */}
            {leftTab === 'rules' && <>
              {(() => {
                const fieldsWithKey = fields.filter(f => f.key);
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Regras de exibição</div>
                        <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 2 }}>
                          Mostre ou oculte campos com base em respostas de outros campos.
                        </div>
                      </div>
                      <button className="btn btn-primary" style={{ fontSize: 14, padding: '5px 12px' }} onClick={addRule}>
                        + Nova regra
                      </button>
                    </div>

                    {displayRules.length === 0 && (
                      <div style={{
                        textAlign: 'center', padding: '40px 20px',
                        border: '2px dashed var(--border)', borderRadius: 10,
                        color: 'var(--text-muted)', fontSize: 15,
                      }}>
                        <div style={{ fontSize: 30, marginBottom: 8 }}>🔀</div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Nenhuma regra criada</div>
                        <div style={{ fontSize: 14 }}>Clique em "+ Nova regra" para criar condições de exibição.</div>
                      </div>
                    )}

                    {fieldsWithKey.length < 2 && displayRules.length === 0 && (
                      <div style={{ marginTop: 10, fontSize: 14, color: '#f59e0b', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px' }}>
                        Adicione pelo menos 2 campos na aba "Campos" para criar regras de exibição.
                      </div>
                    )}

                    {displayRules.map((rule) => (
                      <div key={rule.id} style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 10, padding: 14, marginBottom: 10, position: 'relative',
                      }}>
                        <button
                          onClick={() => removeRule(rule.id)}
                          style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18, lineHeight: 1, padding: 0 }}
                          title="Excluir regra"
                        >×</button>

                        {/* Trigger */}
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Condição
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                          <span style={{ fontSize: 14.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Se o campo</span>
                          <select
                            style={{ ...inputStyle, flex: '1 1 130px', fontSize: 14 }}
                            value={rule.trigger_field}
                            onChange={e => updateRule(rule.id, { trigger_field: e.target.value })}
                          >
                            <option value="">— selecionar —</option>
                            {fieldsWithKey.map(f => (
                              <option key={f.key} value={f.key}>{f.label || f.key}</option>
                            ))}
                          </select>
                          <span style={{ fontSize: 14.5, color: 'var(--text-muted)' }}>for igual a</span>
                          <input
                            style={{ ...inputStyle, flex: '1 1 90px', fontSize: 14 }}
                            placeholder="valor"
                            value={rule.trigger_value}
                            onChange={e => updateRule(rule.id, { trigger_value: e.target.value })}
                          />
                        </div>

                        {/* Action */}
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Ação
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          {['show', 'hide'].map(act => (
                            <label key={act} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 15 }}>
                              <input
                                type="radio"
                                name={`action_${rule.id}`}
                                checked={rule.action === act}
                                onChange={() => updateRule(rule.id, { action: act })}
                                style={{ accentColor: '#6366f1' }}
                              />
                              {act === 'show' ? 'Mostrar' : 'Ocultar'} os campos:
                            </label>
                          ))}
                        </div>

                        {/* Target fields */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {fieldsWithKey
                            .filter(f => f.key !== rule.trigger_field)
                            .map(f => (
                              <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 14.5, padding: '3px 0' }}>
                                <input
                                  type="checkbox"
                                  checked={rule.target_fields.includes(f.key)}
                                  onChange={() => toggleRuleTarget(rule.id, f.key)}
                                  style={{ accentColor: '#6366f1' }}
                                />
                                <span style={{
                                  background: rule.target_fields.includes(f.key) ? '#eef2ff' : 'var(--bg-hover)',
                                  color: rule.target_fields.includes(f.key) ? '#4f46e5' : 'var(--text-muted)',
                                  borderRadius: 5, padding: '2px 8px', fontSize: 14, fontWeight: rule.target_fields.includes(f.key) ? 600 : 400,
                                  transition: 'all 0.1s',
                                }}>
                                  {f.label || f.key}
                                </span>
                              </label>
                            ))}
                          {fieldsWithKey.filter(f => f.key !== rule.trigger_field).length === 0 && (
                            <div style={{ fontSize: 14, color: '#94a3b8', fontStyle: 'italic' }}>
                              Adicione mais campos para selecionar os alvos.
                            </div>
                          )}
                        </div>

                        {/* Summary */}
                        {rule.trigger_field && rule.trigger_value && rule.target_fields.length > 0 && (
                          <div style={{
                            marginTop: 10, padding: '6px 10px',
                            background: rule.action === 'show' ? '#f0fdf4' : '#fef2f2',
                            borderRadius: 6, fontSize: 13.5,
                            color: rule.action === 'show' ? '#15803d' : '#b91c1c',
                          }}>
                            {rule.action === 'show' ? 'Mostrar' : 'Ocultar'}{' '}
                            <strong>{rule.target_fields.map(k => fields.find(f => f.key === k)?.label || k).join(', ')}</strong>
                            {' '}quando <strong>{fields.find(f => f.key === rule.trigger_field)?.label || rule.trigger_field}</strong> = <strong>{rule.trigger_value}</strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>}

            {/* ── Fields tab ── */}
            {leftTab === 'fields' && <>
            {/* Fields */}
            <div style={sectionStyle}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Campos do formulário</div>
              {fields.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 14.5, marginBottom: 10, textAlign: 'center', padding: '8px 0' }}>
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
                      color: '#ef4444', fontSize: 18, lineHeight: 1, padding: 0,
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

                  {/* Conditional visibility */}
                  {(() => {
                    const prevFields = fields.slice(0, idx).filter(f => f.key);
                    const hasCond = !!(field.condition?.field_key);
                    return (
                      <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                            Visibilidade
                          </span>
                          <button
                            type="button"
                            onClick={() => updateField(idx, {
                              condition: hasCond ? null : { field_key: '', value: '' }
                            })}
                            style={{
                              fontSize: 13, padding: '2px 8px', borderRadius: 5,
                              border: '1px solid var(--border)', cursor: 'pointer',
                              background: hasCond ? '#ede9fe' : 'var(--bg-hover)',
                              color: hasCond ? '#7c3aed' : 'var(--text-muted)',
                              fontWeight: hasCond ? 700 : 400,
                            }}
                          >
                            {hasCond ? 'Condicional' : 'Sempre visivel'}
                          </button>
                        </div>
                        {hasCond && (
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              Mostrar se
                            </span>
                            <select
                              style={{ ...inputStyle, flex: '1 1 110px', fontSize: 14 }}
                              value={field.condition?.field_key || ''}
                              onChange={e => updateField(idx, { condition: { ...field.condition, field_key: e.target.value } })}
                            >
                              <option value="">— campo —</option>
                              {prevFields.map(pf => (
                                <option key={pf.key} value={pf.key}>
                                  {pf.label || pf.key}
                                </option>
                              ))}
                            </select>
                            <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>=</span>
                            <input
                              style={{ ...inputStyle, flex: '1 1 80px', fontSize: 14 }}
                              placeholder="valor"
                              value={field.condition?.value || ''}
                              onChange={e => updateField(idx, { condition: { ...field.condition, value: e.target.value } })}
                            />
                            {prevFields.length === 0 && (
                              <span style={{ fontSize: 13, color: '#f59e0b', width: '100%' }}>
                                Adicione campos antes deste para usar como condição.
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
              <button
                className="btn btn-ghost"
                onClick={addField}
                style={{ width: '100%', marginTop: 4, fontSize: 15 }}
              >
                + Adicionar campo
              </button>
            </div>
            </>}
          </div>
        </div>

        {/* Right panel — preview */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '24px',
            background: 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              Prévia do formulário
            </div>
            <div style={{ width: '100%', maxWidth: 420 }}>
              <Preview compact />
            </div>
          </div>
        </div>

      {/* Fullscreen preview modal — inside root div so JSX stays valid */}
      {fullscreenPreview && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '32px 16px',
          }}
        >
          <button
            onClick={() => setFullscreenPreview(false)}
            style={{
              position: 'fixed', top: 16, right: 16, zIndex: 10,
              background: 'rgba(0,0,0,0.12)', border: 'none', borderRadius: 8,
              padding: '6px 14px', cursor: 'pointer', color: '#1e293b',
              fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
              backdropFilter: 'blur(6px)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Fechar prévia
          </button>
          <div style={{ width: '100%', maxWidth: 500 }}>
            <Preview />
          </div>
        </div>
      )}
    </div>
  );
}
