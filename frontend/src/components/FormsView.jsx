import React, { useState, useEffect, useCallback } from 'react';
import { API_URL as API } from '../config.js';
import { useAuth } from '../AuthContext';
import FormBuilderModal from './FormBuilderModal';
import { toast } from './Toast';

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
  const [submissionsForm, setSubmissionsForm] = useState(null); // form object whose submissions to view
  const [submissions, setSubmissions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);

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

  const handleOpenSubmissions = async (form) => {
    setSubmissionsForm(form);
    setSubsLoading(true);
    try {
      const r = await authFetch(`${API}/crm-forms/${form.id}/submissions`);
      const data = await r.json();
      setSubmissions(Array.isArray(data) ? data : []);
    } catch {
      setSubmissions([]);
    } finally {
      setSubsLoading(false);
    }
  };

  const handleCopyLink = (form) => {
    const link = `${window.location.origin}/#form/${form.uid}`;
    navigator.clipboard.writeText(link).then(() => {
      toast('Link copiado!', { type: 'success' });
    });
  };

  const handleSave = async (formData, formId) => {
    const url = formId ? `${API}/crm-forms/${formId}` : `${API}/crm-forms`;
    const method = formId ? 'PUT' : 'POST';
    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Erro HTTP ${res.status}`);
    }
    setBuilderOpen(false);
    loadForms();
  };

  // When builder is open, show it as a full page (no modal)
  if (builderOpen) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <FormBuilderModal
          form={editingForm}
          onSave={handleSave}
          onClose={() => setBuilderOpen(false)}
        />
      </div>
    );
  }

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
                  <td style={{ padding: '12px 14px' }}>
                    <button
                      onClick={() => handleOpenSubmissions(form)}
                      style={{
                        background: (form.submission_count ?? 0) > 0 ? '#eef2ff' : 'var(--bg-hover)',
                        color: (form.submission_count ?? 0) > 0 ? '#4338ca' : 'var(--text-muted)',
                        border: 'none', borderRadius: 6, padding: '3px 10px',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      title="Ver respostas"
                    >
                      {form.submission_count ?? 0}
                    </button>
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

      {/* Submissions modal */}
      {submissionsForm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setSubmissionsForm(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 14, width: '100%', maxWidth: 900,
              maxHeight: '85vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
                  📋 Respostas — {submissionsForm.name}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {submissions.length} resposta{submissions.length !== 1 ? 's' : ''} recebida{submissions.length !== 1 ? 's' : ''}
                </div>
              </div>
              <button
                onClick={() => setSubmissionsForm(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8', lineHeight: 1 }}
              >×</button>
            </div>

            {/* Modal body */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {subsLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Carregando…</div>
              ) : submissions.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Nenhuma resposta ainda</div>
                  <div style={{ fontSize: 12 }}>As submissões do formulário aparecerão aqui.</div>
                </div>
              ) : (() => {
                // Collect all field keys from submissions + form config
                const fc = submissionsForm.fields_config || [];
                const fieldLabels = {};
                fc.forEach(f => { fieldLabels[f.key] = f.label || f.key; });
                // Also collect keys present in submissions that aren't in config
                const allKeys = [];
                const seenKeys = new Set();
                fc.forEach(f => { if (!seenKeys.has(f.key)) { allKeys.push(f.key); seenKeys.add(f.key); } });
                submissions.forEach(s => {
                  Object.keys(s.data || {}).forEach(k => {
                    if (!seenKeys.has(k)) { allKeys.push(k); seenKeys.add(k); fieldLabels[k] = k; }
                  });
                });

                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                          Data/Hora
                        </th>
                        {allKeys.map(k => (
                          <th key={k} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                            {fieldLabels[k]}
                          </th>
                        ))}
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                          Registro
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((s, i) => {
                        const dt = s.submitted_at
                          ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                              .format(new Date(s.submitted_at.endsWith('Z') ? s.submitted_at : s.submitted_at + 'Z'))
                          : '—';
                        const isLead = s.entity_type === 'lead';
                        const hash = s.entity_id
                          ? isLead ? `#lead/${s.entity_id}` : `#deal/${s.entity_id}`
                          : null;
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '10px 16px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 12 }}>{dt}</td>
                            {allKeys.map(k => (
                              <td key={k} style={{ padding: '10px 12px', color: '#0f172a', maxWidth: 200 }}>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {s.data?.[k] !== undefined && s.data?.[k] !== null && s.data?.[k] !== ''
                                    ? String(s.data[k])
                                    : <span style={{ color: '#cbd5e1' }}>—</span>
                                  }
                                </div>
                              </td>
                            ))}
                            <td style={{ padding: '10px 16px' }}>
                              {hash ? (
                                <a
                                  href={hash}
                                  onClick={() => setSubmissionsForm(null)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    background: isLead ? '#ede9fe' : '#dbeafe',
                                    color: isLead ? '#7c3aed' : '#1d4ed8',
                                    borderRadius: 5, padding: '3px 8px', fontSize: 12, fontWeight: 600,
                                    textDecoration: 'none',
                                  }}
                                >
                                  {isLead ? 'Lead' : 'Negócio'} #{s.entity_id}
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M1 9L9 1M9 1H5M9 1v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </a>
                              ) : (
                                <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
