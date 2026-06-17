import React, { useState, useEffect } from 'react';
import { API_URL as API } from '../config.js';

export default function PublicForm({ uid }) {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setError('not_found');
      setLoading(false);
      return;
    }
    fetch(`${API}/public/forms/${uid}`)
      .then(r => {
        if (r.status === 404) throw new Error('not_found');
        if (r.status === 403) throw new Error('inactive');
        if (!r.ok) throw new Error('error');
        return r.json();
      })
      .then(data => {
        setForm(data);
        // Initialize values
        const initial = {};
        (data.fields_config || []).forEach(f => { initial[f.key] = ''; });
        setValues(initial);
      })
      .catch(e => setError(e.message || 'error'))
      .finally(() => setLoading(false));
  }, [uid]);

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate required
    for (const f of (form?.fields_config || [])) {
      if (f.required && !values[f.key]) {
        setSubmitError(`O campo "${f.label || f.key}" é obrigatório.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const r = await fetch(`${API}/public/forms/${uid}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || 'Erro ao enviar');
      }
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e.message || 'Erro ao enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '32px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  const cardStyle = {
    background: '#fff', borderRadius: 16, padding: '40px 36px',
    boxShadow: '0 4px 32px rgba(0,0,0,0.10)', width: '100%', maxWidth: 500,
  };

  const labelStyle = {
    display: 'block', fontSize: 13.5, fontWeight: 600,
    color: '#374151', marginBottom: 6,
  };

  const inputBase = {
    width: '100%', borderRadius: 8, border: '1.5px solid #d1d5db',
    padding: '10px 12px', fontSize: 14, color: '#1e293b',
    background: '#fff', boxSizing: 'border-box', outline: 'none',
    transition: 'border-color 0.15s',
  };

  // ── States ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: '#64748b', fontSize: 15 }}>Carregando formulário...</div>
      </div>
    );
  }

  if (error === 'not_found') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
            Formulário não encontrado
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Este link não é válido ou o formulário foi removido.
          </p>
        </div>
      </div>
    );
  }

  if (error === 'inactive') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⏸️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
            Formulário inativo
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Este formulário não está mais disponível.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
            Erro ao carregar
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Não foi possível carregar o formulário. Tente novamente mais tarde.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 10px' }}>
            Enviado com sucesso!
          </h2>
          <p style={{ fontSize: 14.5, color: '#475569', margin: 0, lineHeight: 1.6 }}>
            {form?.success_message || 'Obrigado! Sua resposta foi registrada.'}
          </p>
        </div>
      </div>
    );
  }

  const fieldsConfig = form?.fields_config || [];

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {form?.title && (
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: '0 0 8px', lineHeight: 1.2 }}>
            {form.title}
          </h1>
        )}
        {form?.subtitle && (
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 28px', lineHeight: 1.6 }}>
            {form.subtitle}
          </p>
        )}
        {!form?.title && !form?.subtitle && (
          <div style={{ marginBottom: 24 }} />
        )}

        {fieldsConfig.length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
            Este formulário não possui campos.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {fieldsConfig.map((field, i) => (
              <div key={i} style={{ marginBottom: 18 }}>
                <label style={labelStyle}>
                  {field.label || field.key}
                  {field.required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
                </label>
                {field.field_type === 'textarea' ? (
                  <textarea
                    required={!!field.required}
                    placeholder={field.placeholder}
                    value={values[field.key] || ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                    style={{ ...inputBase, minHeight: 90, resize: 'vertical' }}
                  />
                ) : (
                  <input
                    type={field.field_type || 'text'}
                    required={!!field.required}
                    placeholder={field.placeholder}
                    value={values[field.key] || ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                    style={inputBase}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#d1d5db'}
                  />
                )}
              </div>
            ))}

            {submitError && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                fontSize: 13.5, color: '#b91c1c',
              }}>
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: '12px', borderRadius: 9,
                background: submitting ? '#a5b4fc' : '#6366f1',
                color: '#fff', border: 'none', fontWeight: 700,
                fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer',
                marginTop: 4, transition: 'background 0.15s',
              }}
            >
              {submitting ? 'Enviando...' : (form?.button_text || 'Enviar')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
