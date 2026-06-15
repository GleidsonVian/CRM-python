import React, { useEffect, useState } from 'react';
import CustomFieldValues from './CustomFieldValues';

const API = 'http://localhost:8001';

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

const SOURCES = ['Chamada', 'Email', 'Site', 'Indicação', 'Redes Sociais', 'WhatsApp', 'Evento', 'Outro'];
const SALUTATIONS = ['Sr.', 'Sra.', 'Dr.', 'Dra.', 'Prof.'];
const CONTACT_TYPES = ['Clientes', 'Parceiros', 'Fornecedores', 'Concorrentes', 'Outros'];

function FieldRow({ label, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '7px 0',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <span style={{ fontSize: 12, color: '#94a3b8', minWidth: 150, paddingTop: 2, flexShrink: 0 }}>
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
        fontSize: 12, color: '#0f172a', fontFamily: 'inherit', padding: 0,
      }}
      onFocus={e => e.target.style.borderBottom = '1px solid #6366f1'}
      onBlur={e => e.target.style.borderBottom = 'none'}
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
        fontSize: 12, color: '#0f172a', fontFamily: 'inherit', padding: 0,
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
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 32, height: 18, borderRadius: 9,
          background: value ? '#10b981' : '#e2e8f0',
          position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
        }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: '50%', background: 'white',
          position: 'absolute', top: 2, left: value ? 16 : 2,
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      <span style={{ fontSize: 12, color: value ? '#10b981' : '#94a3b8' }}>
        {value ? 'Sim' : 'Não'}
      </span>
    </div>
  );
}

function Section({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 0, borderBottom: '2px solid #f1f5f9' }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', cursor: 'pointer', background: '#f8fafc',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#475569',
          textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ padding: '4px 20px 12px' }}>{children}</div>}
    </div>
  );
}

export default function ContactModal({ contact, onClose, onUpdate, nested = false }) {
  const [deals, setDeals] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [responsibleUser, setResponsibleUser] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    middle_name: contact.middle_name || '',
    salutation: contact.salutation || '',
    email: contact.email || '',
    phone: contact.phone || '',
    cpf: contact.cpf || '',
    address: contact.address || '',
    position: contact.position || '',
    company_name: contact.company_name || '',
    website: contact.website || '',
    messenger: contact.messenger || '',
    source: contact.source || '',
    source_info: contact.source_info || '',
    available_to_all: contact.available_to_all !== false,
    included_in_export: contact.included_in_export !== false,
    contact_type: contact.contact_type || '',
    observers: contact.observers || '',
    comment: contact.comment || '',
    utm_source: contact.utm_source || '',
    utm_medium: contact.utm_medium || '',
    utm_campaign: contact.utm_campaign || '',
    photo_url: contact.photo_url || '',
    responsible_user_id: contact.responsible_user_id || null,
  });

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch(`${API}/cards?contact_id=${contact.id}`)
      .then(r => r.json()).then(setDeals).catch(() => {});
    fetch(`${API}/users`)
      .then(r => r.json()).then(users => {
        setAllUsers(users);
        if (contact.responsible_user_id) {
          const u = users.find(u => u.id === contact.responsible_user_id);
          if (u) setResponsibleUser(u);
        }
      }).catch(() => {});
  }, [contact.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, responsible_user_id: responsibleUser?.id || null };
      const res = await fetch(`${API}/contacts/${contact.id}`, {
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

  const fullName = [form.salutation, form.first_name, form.middle_name, form.last_name]
    .filter(Boolean).join(' ') || 'Contato sem nome';
  const initials = `${form.first_name[0] || ''}${form.last_name[0] || ''}`.toUpperCase() || '?';
  const color = avatarColor(fullName);

  return (
    <div className="modal-backdrop" onClick={onClose} style={nested ? { zIndex: 200 } : {}}>
      <div className={`modal-slider${nested ? ' modal-sm' : ''}`} style={{ maxWidth: 900 }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-top">
            <div className="modal-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: form.photo_url ? 'transparent' : color,
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 700, flexShrink: 0, overflow: 'hidden',
                border: '2px solid #e2e8f0',
              }}>
                {form.photo_url
                  ? <img src={form.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials}
              </div>
              <div>
                <input
                  className="modal-title-input"
                  style={{ fontSize: 17 }}
                  value={`${form.first_name}${form.last_name ? ' ' + form.last_name : ''}`}
                  onChange={e => {
                    const parts = e.target.value.split(' ');
                    set('first_name')(parts[0] || '');
                    set('last_name')(parts.slice(1).join(' ') || '');
                  }}
                  placeholder="Nome do contato"
                />
                <div className="modal-id">
                  Contato · ID #{contact.id}
                  {form.company_name && <span style={{ color: '#6366f1', marginLeft: 8 }}>· {form.company_name}</span>}
                </div>
              </div>
            </div>
            <div className="modal-header-actions">
              <button className="btn btn-primary" style={{ fontSize: 12 }}
                onClick={handleSave} disabled={saving}>
                {saved ? '✓ Salvo' : saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button className="icon-btn" onClick={onClose}><IconX /></button>
            </div>
          </div>
          <div className="modal-stages-ribbon">
            <div className="ribbon-item active">Perfil</div>
            <div className="ribbon-item">{deals.length} Negócio{deals.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Body */}
        <div className="modal-content-grid" style={{ alignItems: 'flex-start' }}>

          {/* Left — sections */}
          <div className="modal-left" style={{ padding: 0 }}>

            <Section title="Sobre o contato">
              <FieldRow label="Saudação">
                <InlineSelect value={form.salutation} onChange={set('salutation')} options={SALUTATIONS} />
              </FieldRow>
              <FieldRow label="Nome">
                <InlineInput value={form.first_name} onChange={set('first_name')} placeholder="Nome" />
              </FieldRow>
              <FieldRow label="Sobrenome">
                <InlineInput value={form.last_name} onChange={set('last_name')} placeholder="Sobrenome" />
              </FieldRow>
              <FieldRow label="Nome do meio">
                <InlineInput value={form.middle_name} onChange={set('middle_name')} placeholder="Nome do meio" />
              </FieldRow>
              <FieldRow label="Telefone">
                <InlineInput value={form.phone} onChange={set('phone')} placeholder="Telefone" type="tel" />
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
              <FieldRow label="Cargo / Posição">
                <InlineInput value={form.position} onChange={set('position')} placeholder="Cargo" />
              </FieldRow>
              <FieldRow label="Empresa">
                <InlineInput value={form.company_name} onChange={set('company_name')} placeholder="Nome da empresa" />
              </FieldRow>
              <FieldRow label="Endereço">
                <InlineInput value={form.address} onChange={set('address')} placeholder="Endereço" />
              </FieldRow>
              <FieldRow label="CPF">
                <InlineInput value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" />
              </FieldRow>
            </Section>

            <Section title="Mais">
              <FieldRow label="Tipo de contato">
                <InlineSelect value={form.contact_type} onChange={set('contact_type')} options={CONTACT_TYPES} />
              </FieldRow>
              <FieldRow label="Fonte">
                <InlineSelect value={form.source} onChange={set('source')} options={SOURCES} />
              </FieldRow>
              <FieldRow label="Informações da fonte">
                <InlineInput value={form.source_info} onChange={set('source_info')} placeholder="Detalhes da origem" />
              </FieldRow>
              <FieldRow label="Disponível para todos">
                <Toggle value={form.available_to_all} onChange={set('available_to_all')} />
              </FieldRow>
              <FieldRow label="Incluído na exportação">
                <Toggle value={form.included_in_export} onChange={set('included_in_export')} />
              </FieldRow>
              <FieldRow label="Pessoa responsável">
                <div>
                  {responsibleUser ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: avatarColor(responsibleUser.name), color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 700,
                      }}>
                        {responsibleUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 12 }}>{responsibleUser.name}</span>
                      <button onClick={() => setResponsibleUser(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                          color: '#94a3b8', fontSize: 11, padding: 0 }}>
                        Alterar
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input
                        style={{
                          width: '100%', border: 'none', borderBottom: '1px dashed #e2e8f0',
                          outline: 'none', background: 'transparent', fontSize: 12,
                          color: '#6366f1', fontFamily: 'inherit', padding: '2px 0',
                        }}
                        placeholder="+ Atribuir responsável"
                        value={userSearch}
                        onChange={e => { setUserSearch(e.target.value); setShowUserDropdown(true); }}
                        onFocus={() => setShowUserDropdown(true)}
                        onBlur={() => setTimeout(() => setShowUserDropdown(false), 150)}
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
                                <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>{u.role}</span>
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
                  placeholder="Observações sobre este contato..."
                  rows={2}
                  style={{
                    width: '100%', border: 'none', borderBottom: '1px solid #f1f5f9',
                    outline: 'none', background: 'transparent', fontSize: 12,
                    color: '#0f172a', fontFamily: 'inherit', resize: 'vertical', padding: 0,
                  }}
                />
              </FieldRow>
              <FieldRow label="Parâmetros UTM">
                {(form.utm_source || form.utm_medium || form.utm_campaign) ? (
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {form.utm_source && <div>utm_source: <b>{form.utm_source}</b></div>}
                    {form.utm_medium && <div>utm_medium: <b>{form.utm_medium}</b></div>}
                    {form.utm_campaign && <div>utm_campaign: <b>{form.utm_campaign}</b></div>}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: '#cbd5e1' }}>Nenhum</span>
                )}
              </FieldRow>
            </Section>

            <div style={{ padding: '8px 20px' }}>
              <CustomFieldValues entity="contact" entityId={contact.id} />
            </div>

          </div>

          {/* Right — negócios vinculados */}
          <div className="modal-right">
            <div className="timeline-header">
              Negócios vinculados {deals.length > 0 && `(${deals.length})`}
            </div>

            <div className="timeline-events" style={{ padding: 14 }}>
              {deals.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', paddingTop: 24, fontStyle: 'italic' }}>
                  Nenhum negócio vinculado ainda.
                </div>
              ) : deals.map(d => (
                <div
                  key={d.id}
                  onClick={() => { onClose(); window.location.hash = `deal/${d.id}`; }}
                  style={{
                    background: 'white', border: '1px solid var(--border)',
                    borderRadius: 'var(--r)', padding: '10px 12px',
                    cursor: 'pointer', marginBottom: 8, transition: 'box-shadow 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 4 }}>
                    {fmtCurrency(d.price)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

