import React, { useState, useEffect, useCallback } from 'react';
import { API_URL as API } from '../config.js';
import { useAuth } from '../AuthContext';
import FormBuilderModal from './FormBuilderModal';

export default function FormsView() {
  const { token } = useAuth();
  const authFetch = useCallback((url, opts = {}) => {
    const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers };
    return fetch(url, { ...opts, headers });
  }, [token]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingForm, setEditingForm] = useState(null);

  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch(`${API}/crm-forms`);
      const data = await r.json();
      setForms(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { loadForms(); }, [loadForms]);

  const handleNew = () => {
    setEditingForm(null);
    setBuilderOpen(true);
  };

  const handleEdit = (form) => {
    setEditingForm(form);
    setBuilderOpen(true);
  };

  const handleDelete = async (form) => {
    if (!window.confirm(`Excluir formulário "${form.name}"?`)) return;
    await authFetch(`${API}/crm-forms/${form.id}`, { method: 'DELETE' });
    loadForms();
  };

  const handleToggleActive = async (form) => {
    await authFetch(`${API}/crm-forms/${form.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !form.is_active }),
    });
    loadForms();
  };

  const handleCopyLink = (form) => {
    const link = `${window.location.origin}/#form/${form.uid}`;
    navigator.clipboard.writeText(link).then(() => {
      alert('Link copiado!');
    });
  };

  const handleSave = async (formData, formId) => {
    if (formId) {
      await authFetch(`${API}/crm-forms/${formId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
    } else {
      await authFetch(`${API}/crm-forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
    }
    setBuilderOpen(false);
    loadForms();
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            📋 Formulários CRM
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Crie formulários públicos que criam Leads ou Negócios automaticamente.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleNew}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          + Novo formulário
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 40 }}>
          Carregando...
        </div>
      ) : forms.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          border: '2px dashed var(--border)', borderRadius: 12,
          color: 'var(--text-muted)', fontSize: 14,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhum formulário criado</div>
          <div>Clique em "Novo formulário" para começar.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                {['Nome', 'Tipo', 'Link público', 'Respostas', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forms.map((form, i) => (
                <tr
                  key={form.id}
                  style={{
                    borderBottom: i < forms.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 14px' }}>
                    <button
                      onClick={() => handleEdit(form)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontWeight: 600, fontSize: 14, color: 'var(--text-primary)',
                        padding: 0, textAlign: 'left',
                      }}
                    >
                      {form.name}
                    </button>
                    {form.title && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{form.title}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      background: form.entity_type === 'lead' ? '#dbeafe' : '#d1fae5',
                      color: form.entity_type === 'lead' ? '#1d4ed8' : '#065f46',
                      borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600,
                    }}>
                      {form.entity_type === 'lead' ? 'Lead' : 'Negócio'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <code style={{
                        fontSize: 11.5, color: 'var(--text-muted)',
                        background: 'var(--bg-hover)', borderRadius: 4, padding: '2px 6px',
                        maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        #form/{form.uid}
                      </code>
                      <button
                        onClick={() => handleCopyLink(form)}
                        title="Copiar link"
                        style={{
                          background: 'none', border: '1px solid var(--border)',
                          borderRadius: 5, cursor: 'pointer', padding: '3px 7px',
                          fontSize: 12, color: 'var(--text-muted)',
                        }}
                      >
                        Copiar
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {form.submission_count ?? 0}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!form.is_active}
                        onChange={() => handleToggleActive(form)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 12, color: form.is_active ? '#16a34a' : 'var(--text-muted)' }}>
                        {form.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </label>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleEdit(form)}
                        className="btn btn-ghost"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(form)}
                        className="btn btn-ghost"
                        style={{ fontSize: 12, padding: '4px 10px', color: '#ef4444' }}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {builderOpen && (
        <FormBuilderModal
          form={editingForm}
          onSave={handleSave}
          onClose={() => setBuilderOpen(false)}
        />
      )}
    </div>
  );
}
