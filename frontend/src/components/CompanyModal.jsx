import React, { useEffect, useState } from 'react';

import { API_URL as API } from '../config.js';

const avatarColor = (name) => {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

const fmtCurrency = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const COMPANY_TYPES = ['Cliente', 'Parceiro', 'Fornecedor', 'Concorrente', 'Integrador', 'Outros'];
const INDUSTRIES = [
  'Tecnologia da Informação', 'Finanças', 'Saúde', 'Educação', 'Varejo', 'Indústria',
  'Imobiliário', 'Serviços', 'Mídia', 'Telecomunicações', 'Governo', 'Outros',
];
const EMPLOYEE_RANGES = ['menos que 50', '50–200', '200–500', '500–1000', 'mais de 1000'];

function FieldRow({ label, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '7px 0',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <span style={{ fontSize: 14, color: '#94a3b8', minWidth: 160, paddingTop: 2, flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function InlineInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || 'o campo está vazio'}
      style={{
        width: '100%', border: 'none', outline: 'none', background: 'transparent',
        fontSize: 14, color: '#0f172a', fontFamily: 'inherit', padding: 0,
      }}
    />
  );
}

function InlineSelect({ value, onChange, options, emptyLabel = 'o campo está vazio' }) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={{
        border: 'none', outline: 'none', background: 'transparent',
        fontSize: 14, color: '#0f172a', fontFamily: 'inherit', padding: 0,
        cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
      }}
    >
      <option value="">{emptyLabel}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Toggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div onClick={() => onChange(!value)} style={{
        width: 32, height: 18, borderRadius: 9,
        background: value ? '#10b981' : '#e2e8f0',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
      }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%', background: 'white',
          position: 'absolute', top: 2, left: value ? 16 : 2,
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      <span style={{ fontSize: 14, color: value ? '#10b981' : '#94a3b8' }}>
        {value ? 'Sim' : 'Não'}
      </span>
    </div>
  );
}

function Section({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 0, borderBottom: '2px solid #f1f5f9' }}>
      <div onClick={() => setOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', cursor: 'pointer', background: '#f8fafc',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#475569',
          textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ padding: '4px 20px 12px' }}>{children}</div>}
    </div>
  );
}

export default function CompanyModal({ company, onClose, onUpdate, onDelete }) {
  const [allUsers, setAllUsers] = useState([]);
  const [allContacts, setAllContacts] = useState([]);
  const [responsibleUser, setResponsibleUser] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [linkedContacts, setLinkedContacts] = useState(company.contacts || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState({
    name: company.name || '',
    company_number: company.company_number || '',
    logo_url: company.logo_url || '',
    company_type: company.company_type || '',
    industry: company.industry || '',
    annual_revenue: company.annual_revenue || 0,
    phone: company.phone || '',
    email: company.email || '',
    website: company.website || '',
    messenger: company.messenger || '',
    address: company.address || '',
    employees: company.employees || '',
    available_to_all: company.available_to_all !== false,
    observers: company.observers || '',
    comment: company.comment || '',
    utm_source: company.utm_source || '',
    utm_medium: company.utm_medium || '',
    utm_campaign: company.utm_campaign || '',
    responsible_user_id: company.responsible_user_id || null,
  });

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch(`${API}/users`).then(r => r.json()).then(users => {
      setAllUsers(users);
      if (company.responsible_user_id) {
        const u = users.find(u => u.id === company.responsible_user_id);
        if (u) setResponsibleUser(u);
      }
    }).catch(() => {});
    fetch(`${API}/contacts`).then(r => r.json()).then(setAllContacts).catch(() => {});
  }, [company.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        annual_revenue: parseFloat(form.annual_revenue) || 0,
        responsible_user_id: responsibleUser?.id || null,
        contact_ids: linkedContacts.map(c => c.id),
      };
      const res = await fetch(`${API}/companies/${company.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const updated = await res.json();
      if (onUpdate) onUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    await fetch(`${API}/companies/${company.id}`, { method: 'DELETE' });
    if (onDelete) onDelete(company.id);
    onClose();
  };

  const addContact = (c) => {
    if (!linkedContacts.find(x => x.id === c.id)) {
      setLinkedContacts(prev => [...prev, c]);
    }
    setContactSearch('');
    setShowContactDropdown(false);
  };

  const removeContact = (id) => setLinkedContacts(prev => prev.filter(c => c.id !== id));

  const initials = (form.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const color = avatarColor(form.name);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-slider" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-top">
            <div className="modal-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 8,
                background: form.logo_url ? 'transparent' : color,
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, fontWeight: 700, flexShrink: 0, overflow: 'hidden',
                border: '2px solid #e2e8f0',
              }}>
                {form.logo_url
                  ? <img src={form.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : initials}
              </div>
              <div>
                <input
                  className="modal-title-input"
                  style={{ fontSize: 19 }}
                  value={form.name}
                  onChange={e => set('name')(e.target.value)}
                  placeholder="Nome da empresa"
                />
                <div className="modal-id">
                  Empresa · ID #{company.id}
                  {form.industry && <span style={{ color: '#6366f1', marginLeft: 8 }}>· {form.industry}</span>}
                </div>
              </div>
            </div>
            <div className="modal-header-actions">
              {confirmDelete ? (
                <>
                  <span style={{ fontSize: 14, color: '#ef4444' }}>Confirmar?</span>
                  <button className="btn btn-danger" style={{ fontSize: 14 }} onClick={handleDelete}>Excluir</button>
                  <button className="btn btn-ghost" style={{ fontSize: 14 }} onClick={() => setConfirmDelete(false)}>Não</button>
                </>
              ) : (
                <button className="btn btn-ghost" style={{ fontSize: 14, color: '#ef4444' }}
                  onClick={() => setConfirmDelete(true)}>Excluir</button>
              )}
              <button className="btn btn-primary" style={{ fontSize: 14 }}
                onClick={handleSave} disabled={saving}>
                {saved ? '✓ Salvo' : saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button className="icon-btn" onClick={onClose}><IconX /></button>
            </div>
          </div>
          <div className="modal-stages-ribbon">
            <div className="ribbon-item active">Perfil</div>
            <div className="ribbon-item">{linkedContacts.length} Contato{linkedContacts.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Body */}
        <div className="modal-content-grid" style={{ alignItems: 'flex-start' }}>

          {/* Left */}
          <div className="modal-left" style={{ padding: 0 }}>

            <Section title="Sobre a empresa">
              <FieldRow label="Nome da empresa *">
                <InlineInput value={form.name} onChange={set('name')} placeholder="Nome da empresa" />
              </FieldRow>
              <FieldRow label="Company #">
                <InlineInput value={form.company_number} onChange={set('company_number')} placeholder="Número identificador" />
              </FieldRow>
              <FieldRow label="Logotipo (URL)">
                <InlineInput value={form.logo_url} onChange={set('logo_url')} placeholder="https://..." />
              </FieldRow>
              <FieldRow label="Tipo de empresa">
                <InlineSelect value={form.company_type} onChange={set('company_type')} options={COMPANY_TYPES} />
              </FieldRow>
              <FieldRow label="Indústria">
                <InlineSelect value={form.industry} onChange={set('industry')} options={INDUSTRIES} />
              </FieldRow>
              <FieldRow label="Receita anual (R$)">
                <InlineInput value={form.annual_revenue} onChange={set('annual_revenue')} type="number" placeholder="0" />
              </FieldRow>
              <FieldRow label="Telefone">
                <InlineInput value={form.phone} onChange={set('phone')} placeholder="+55" type="tel" />
              </FieldRow>
              <FieldRow label="E-mail">
                <InlineInput value={form.email} onChange={set('email')} placeholder="E-mail" type="email" />
              </FieldRow>
              <FieldRow label="Website">
                <InlineInput value={form.website} onChange={set('website')} placeholder="https://" />
              </FieldRow>
              <FieldRow label="Messenger">
                <InlineInput value={form.messenger} onChange={set('messenger')} placeholder="@usuário" />
              </FieldRow>
              <FieldRow label="Endereço">
                <InlineInput value={form.address} onChange={set('address')} placeholder="Endereço" />
              </FieldRow>
              <FieldRow label="Contatos da empresa">
                <div>
                  {linkedContacts.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>{c.first_name} {c.last_name || ''}</span>
                      {c.phone && <span style={{ fontSize: 13, color: '#94a3b8' }}>{c.phone}</span>}
                      <button onClick={() => removeContact(c.id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#cbd5e1', fontSize: 13, padding: 0, marginLeft: 'auto',
                      }}>✕</button>
                    </div>
                  ))}
                  <div style={{ position: 'relative' }}>
                    <input
                      placeholder="+ Adicionar contato"
                      value={contactSearch}
                      onChange={e => { setContactSearch(e.target.value); setShowContactDropdown(true); }}
                      onFocus={() => setShowContactDropdown(true)}
                      onBlur={() => setTimeout(() => setShowContactDropdown(false), 150)}
                      style={{
                        border: 'none', borderBottom: '1px dashed #e2e8f0', outline: 'none',
                        background: 'transparent', fontSize: 14, color: '#6366f1',
                        fontFamily: 'inherit', padding: '2px 0', width: '100%',
                      }}
                    />
                    {showContactDropdown && (
                      <div className="contact-dropdown">
                        {allContacts
                          .filter(c =>
                            !linkedContacts.find(x => x.id === c.id) &&
                            (`${c.first_name} ${c.last_name || ''} ${c.phone || ''} ${c.email || ''}`)
                              .toLowerCase().includes(contactSearch.toLowerCase()))
                          .slice(0, 6)
                          .map(c => (
                            <div key={c.id} className="contact-dropdown-item"
                              onMouseDown={() => addContact(c)}>
                              {c.first_name} {c.last_name || ''}
                              {c.phone && <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>{c.phone}</span>}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </FieldRow>
            </Section>

            <Section title="Mais">
              <FieldRow label="Colaboradores">
                <InlineSelect value={form.employees} onChange={set('employees')} options={EMPLOYEE_RANGES} />
              </FieldRow>
              <FieldRow label="Disponível para todos">
                <Toggle value={form.available_to_all} onChange={set('available_to_all')} />
              </FieldRow>
              <FieldRow label="Pessoa responsável">
                <div>
                  {responsibleUser ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: avatarColor(responsibleUser.name), color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700,
                      }}>
                        {responsibleUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 14 }}>{responsibleUser.name}</span>
                      <button onClick={() => setResponsibleUser(null)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#94a3b8', fontSize: 13, padding: 0,
                      }}>Alterar</button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input
                        placeholder="+ Atribuir responsável"
                        value={userSearch}
                        onChange={e => { setUserSearch(e.target.value); setShowUserDropdown(true); }}
                        onFocus={() => setShowUserDropdown(true)}
                        onBlur={() => setTimeout(() => setShowUserDropdown(false), 150)}
                        style={{
                          border: 'none', borderBottom: '1px dashed #e2e8f0', outline: 'none',
                          background: 'transparent', fontSize: 14, color: '#6366f1',
                          fontFamily: 'inherit', padding: '2px 0', width: '100%',
                        }}
                      />
                      {showUserDropdown && (
                        <div className="contact-dropdown">
                          {allUsers
                            .filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()))
                            .slice(0, 6)
                            .map(u => (
                              <div key={u.id} className="contact-dropdown-item"
                                onMouseDown={() => {
                                  setResponsibleUser(u);
                                  setUserSearch('');
                                  setShowUserDropdown(false);
                                }}>
                                {u.name}
                                <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>{u.role}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </FieldRow>
              <FieldRow label="Observadores">
                <InlineInput value={form.observers} onChange={set('observers')} placeholder="Nomes separados por vírgula" />
              </FieldRow>
              <FieldRow label="Comentário">
                <textarea
                  value={form.comment || ''}
                  onChange={e => set('comment')(e.target.value)}
                  placeholder="Observações sobre esta empresa..."
                  rows={2}
                  style={{
                    width: '100%', border: 'none', borderBottom: '1px solid #f1f5f9',
                    outline: 'none', background: 'transparent', fontSize: 14,
                    color: '#0f172a', fontFamily: 'inherit', resize: 'vertical', padding: 0,
                  }}
                />
              </FieldRow>
              <FieldRow label="Parâmetros UTM">
                {(form.utm_source || form.utm_medium || form.utm_campaign) ? (
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    {form.utm_source && <div>utm_source: <b>{form.utm_source}</b></div>}
                    {form.utm_medium && <div>utm_medium: <b>{form.utm_medium}</b></div>}
                    {form.utm_campaign && <div>utm_campaign: <b>{form.utm_campaign}</b></div>}
                  </div>
                ) : (
                  <span style={{ fontSize: 14, color: '#cbd5e1' }}>Nenhum</span>
                )}
              </FieldRow>
            </Section>

          </div>

          {/* Right — contacts + revenue summary */}
          <div className="modal-right">
            <div className="timeline-header">Resumo</div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                background: '#f8fafc', borderRadius: 8, padding: '12px 14px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Receita anual</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
                  {fmtCurrency(form.annual_revenue)}
                </div>
              </div>
              <div style={{
                background: '#f8fafc', borderRadius: 8, padding: '12px 14px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Tipo</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#475569' }}>
                  {form.company_type || '—'}
                </div>
              </div>
              <div style={{
                background: '#f8fafc', borderRadius: 8, padding: '12px 14px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
                  Contatos ({linkedContacts.length})
                </div>
                {linkedContacts.length === 0 ? (
                  <div style={{ fontSize: 14, color: '#cbd5e1', fontStyle: 'italic' }}>Nenhum</div>
                ) : linkedContacts.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: avatarColor(`${c.first_name}${c.last_name}`),
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {`${c.first_name[0] || ''}${(c.last_name || '')[0] || ''}`.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{c.first_name} {c.last_name || ''}</div>
                      {c.phone && <div style={{ fontSize: 13, color: '#94a3b8' }}>{c.phone}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

