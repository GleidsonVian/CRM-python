import React, { useState, useEffect, useCallback, useRef } from 'react';

const API = 'http://localhost:8000';

const TYPE_META = {
  text:       { label: 'Texto',       icon: 'T'  },
  textarea:   { label: 'Texto longo', icon: '¶'  },
  number:     { label: 'Número',      icon: '#'  },
  currency:   { label: 'Moeda',       icon: 'R$' },
  date:       { label: 'Data',        icon: '📅' },
  checkbox:   { label: 'Sim/Não',     icon: '☑'  },
  select:     { label: 'Lista',       icon: '▾'  },
  url:        { label: 'URL',         icon: '🔗' },
  phone:      { label: 'Telefone',    icon: '📞' },
  email:      { label: 'E-mail',      icon: '@'  },
  attachment: { label: 'Anexo',       icon: '📎' },
};

const FILE_ICONS = {
  'application/pdf':  '📄',
  'audio/':           '🎵',
  'video/':           '🎬',
  'image/':           '🖼️',
};
function fileIcon(type = '') {
  for (const [k, v] of Object.entries(FILE_ICONS)) {
    if (type.startsWith(k)) return v;
  }
  return '📎';
}
function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

// ── UID badge shown next to each field label ─────────────────────────────────
function UidBadge({ field, showIds }) {
  const [tip, setTip] = useState(false);
  if (!field.uid) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {showIds ? (
        <code
          style={{
            fontSize: 9, background: '#1e293b', color: '#f59e0b',
            padding: '1px 5px', borderRadius: 3, cursor: 'default',
            marginLeft: 4, letterSpacing: '0.04em',
          }}
          title="Identificador único do campo"
        >{field.uid}</code>
      ) : (
        <button
          onMouseEnter={() => setTip(true)}
          onMouseLeave={() => setTip(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, padding: '0 2px', lineHeight: 1 }}
        >ⓘ</button>
      )}

      {tip && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999,
          background: '#1e293b', color: '#e2e8f0', borderRadius: 8,
          padding: '10px 12px', fontSize: 11, width: 240,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', lineHeight: 1.9,
          pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 700, color: '#10b981', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Campo Personalizado
          </div>
          <div><span style={{ color: '#94a3b8' }}>UID:</span>{'  '}<code style={{ color: '#f59e0b', fontWeight: 700 }}>{field.uid}</code></div>
          <div><span style={{ color: '#94a3b8' }}>ID:</span>{'   '}<code style={{ color: '#a78bfa' }}>#{field.id}</code></div>
          <div><span style={{ color: '#94a3b8' }}>Chave:</span>{'  '}<code style={{ color: '#38bdf8' }}>{field.key}</code></div>
          <div><span style={{ color: '#94a3b8' }}>Tipo:</span>{'  '}<span style={{ color: '#e2e8f0' }}>{TYPE_META[field.field_type]?.label}</span></div>
          <div style={{ borderTop: '1px solid #334155', marginTop: 7, paddingTop: 7, fontSize: 10, color: '#64748b' }}>
            Webhook: <code style={{ color: '#38bdf8' }}>{'{{cf.' + field.uid + '}}'}</code>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Attachment field ─────────────────────────────────────────────────────────
function AttachmentField({ fieldId, value, entityId, entity, disabled }) {
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    try { setAttachments(JSON.parse(value || '[]')); } catch { setAttachments([]); }
  }, [value]);

  const saveAttachments = useCallback(async (list) => {
    if (!entityId) return;
    await fetch(`${API}/custom-field-values?entity=${entity}&entity_id=${entityId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ field_id: fieldId, value: JSON.stringify(list) }]),
    });
  }, [fieldId, entity, entityId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API}/upload`, { method: 'POST', body: form });
      const data = await res.json();
      const next = [...attachments, data];
      setAttachments(next);
      await saveAttachments(next);
    } catch {}
    finally { setUploading(false); e.target.value = ''; }
  };

  const remove = async (idx) => {
    const next = attachments.filter((_, i) => i !== idx);
    setAttachments(next);
    await saveAttachments(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {attachments.map((a, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 7, padding: '6px 10px',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{fileIcon(a.type)}</span>
          <a
            href={`${API}${a.url}`}
            target="_blank" rel="noreferrer"
            style={{ flex: 1, fontSize: 12, color: '#0369a1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >{a.name}</a>
          <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>{formatBytes(a.size)}</span>
          {!disabled && (
            <button
              onClick={() => remove(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, padding: 0, lineHeight: 1, flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
            >×</button>
          )}
        </div>
      ))}
      {!disabled && (
        <>
          <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '6px 10px', borderRadius: 7, cursor: uploading ? 'default' : 'pointer',
              border: '1.5px dashed #e2e8f0', background: 'transparent',
              fontSize: 12, color: uploading ? '#94a3b8' : '#64748b', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.12s',
            }}
            onMouseEnter={e => !uploading && (e.currentTarget.style.borderColor = '#10b981', e.currentTarget.style.color = '#10b981')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e8f0', e.currentTarget.style.color = '#64748b')}
          >
            {uploading ? '⏳ Enviando...' : '📎 Adicionar arquivo'}
          </button>
        </>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
// showIds: when true (F12 mode) shows UID inline next to every field label
export default function CustomFieldValues({ entity, entityId, readOnly = false, showIds = false }) {
  const [fields, setFields]   = useState([]);
  const [values, setValues]   = useState({});
  const [saving, setSaving]   = useState({});
  const [saved,  setSaved]    = useState({});

  useEffect(() => {
    if (!entity) return;
    fetch(`${API}/custom-fields?entity=${entity}`)
      .then(r => r.json()).then(setFields).catch(() => {});
  }, [entity]);

  useEffect(() => {
    if (!entityId || !entity) return;
    fetch(`${API}/custom-field-values?entity=${entity}&entity_id=${entityId}`)
      .then(r => r.json())
      .then(data => {
        const map = {};
        data.forEach(v => { map[v.field_id] = v.value || ''; });
        setValues(map);
      }).catch(() => {});
  }, [entity, entityId]);

  const saveField = useCallback(async (fieldId, value) => {
    if (!entityId) return;
    setSaving(p => ({ ...p, [fieldId]: true }));
    try {
      await fetch(`${API}/custom-field-values?entity=${entity}&entity_id=${entityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ field_id: fieldId, value: String(value ?? '') }]),
      });
      setSaved(p => ({ ...p, [fieldId]: true }));
      setTimeout(() => setSaved(p => ({ ...p, [fieldId]: false })), 1500);
    } catch {}
    finally { setSaving(p => ({ ...p, [fieldId]: false })); }
  }, [entity, entityId]);

  const change = (id, v) => setValues(p => ({ ...p, [id]: v }));
  const blur   = (id)    => saveField(id, values[id] ?? '');
  const select = (id, v) => { setValues(p => ({ ...p, [id]: v })); saveField(id, v); };
  const check  = (id, b) => { const v = b ? 'true' : 'false'; setValues(p => ({ ...p, [id]: v })); saveField(id, v); };

  if (fields.length === 0) return null;

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ flex: 1 }}>Campos personalizados</span>
        <span style={{ fontWeight: 400, color: '#cbd5e1', fontSize: 9 }}>{fields.length} campo{fields.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fields.map(field => {
          const val = values[field.id] ?? '';
          let opts = [];
          try { opts = JSON.parse(field.options || '[]'); } catch {}

          return (
            <div key={field.id}>
              {/* Label + UID badge + save indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {field.name}
                  {field.required && <span style={{ color: '#ef4444', fontSize: 10 }}>*</span>}
                  <UidBadge field={field} showIds={showIds} />
                </label>
                {saving[field.id] && <span style={{ fontSize: 10, color: '#94a3b8' }}>⏳</span>}
                {saved[field.id]  && <span style={{ fontSize: 10, color: '#10b981' }}>✓</span>}
              </div>

              {/* Attachment */}
              {field.field_type === 'attachment' ? (
                <AttachmentField
                  fieldId={field.id} value={val}
                  entityId={entityId} entity={entity}
                  disabled={readOnly || !entityId}
                />
              ) : field.field_type === 'checkbox' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={val === 'true'}
                    disabled={readOnly || !entityId}
                    onChange={e => check(field.id, e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: '#10b981' }}
                  />
                  <span style={{ fontSize: 12, color: '#475569' }}>{val === 'true' ? 'Sim' : 'Não'}</span>
                </label>
              ) : field.field_type === 'select' ? (
                <>
                  <select
                    className="form-select"
                    style={{ fontSize: 12 }}
                    value={val}
                    disabled={readOnly || !entityId}
                    onChange={e => select(field.id, e.target.value)}
                  >
                    <option value="">Selecionar...</option>
                    {opts.map(o => (
                      <option key={o.id} value={String(o.id)}>{o.label}</option>
                    ))}
                  </select>
                  {val && showIds && (
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                      ID da opção: <code style={{ color: '#6366f1' }}>{val}</code>
                      {' · '}{opts.find(o => String(o.id) === val)?.label}
                    </div>
                  )}
                </>
              ) : field.field_type === 'textarea' ? (
                <textarea
                  className="form-textarea"
                  style={{ fontSize: 12, minHeight: 60 }}
                  value={val}
                  readOnly={readOnly || !entityId}
                  onChange={e => change(field.id, e.target.value)}
                  onBlur={() => blur(field.id)}
                  placeholder={readOnly ? '—' : `Inserir ${field.name.toLowerCase()}...`}
                />
              ) : (
                <div style={{ position: 'relative' }}>
                  {field.field_type === 'currency' && (
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', pointerEvents: 'none' }}>R$</span>
                  )}
                  <input
                    type={
                      field.field_type === 'number' || field.field_type === 'currency' ? 'number'
                      : field.field_type === 'date'  ? 'date'
                      : field.field_type === 'email' ? 'email'
                      : 'text'
                    }
                    className="form-input"
                    style={{ fontSize: 12, paddingLeft: field.field_type === 'currency' ? 30 : undefined }}
                    value={val}
                    readOnly={readOnly || !entityId}
                    onChange={e => change(field.id, e.target.value)}
                    onBlur={() => blur(field.id)}
                    placeholder={readOnly ? '—' : `Inserir ${field.name.toLowerCase()}...`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
