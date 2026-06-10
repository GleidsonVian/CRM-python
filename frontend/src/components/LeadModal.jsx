import React, { useState, useEffect } from 'react';
import ContactModal from './ContactModal';
import UserModal from './UserModal';

const API = 'http://localhost:8002';

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso.includes('+') || iso.endsWith('Z') ? iso : iso + 'Z');
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
};

const relTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso.includes('+') || iso.endsWith('Z') ? iso : iso + 'Z');
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffMin < 1440) return `hoje ${hm}`;
  if (diffMin < 2880) return `ontem ${hm}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + hm;
};

const ACTIVITY_META = {
  created:         { icon: '✦', color: '#10b981' },
  moved:           { icon: '→', color: '#6366f1' },
  price_changed:   { icon: '💰', color: '#f59e0b' },
  title_changed:   { icon: '✏️', color: '#3b82f6' },
  field_changed:   { icon: '✏️', color: '#3b82f6' },
  contact_added:   { icon: '👤', color: '#10b981' },
  contact_removed: { icon: '👤', color: '#ef4444' },
  user_assigned:   { icon: '👥', color: '#8b5cf6' },
  user_removed:    { icon: '👥', color: '#ef4444' },
  note:            { icon: '💬', color: '#64748b' },
  auto_note:       { icon: '🤖', color: '#0ea5e9' },
  system:          { icon: '⚙️', color: '#94a3b8' },
};

const avatarColor = (name) => {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

const SOURCES = ['Chamada', 'Email', 'Site', 'Indicação', 'Redes Sociais', 'WhatsApp', 'Evento', 'Outro'];
const SALUTATIONS = ['', 'Sr.', 'Sra.', 'Dr.', 'Dra.', 'Prof.'];

function FieldRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '7px 0',
      borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 12, color: '#94a3b8', minWidth: 140, paddingTop: 2, flexShrink: 0 }}>
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

function InlineSelect({ value, onChange, options }) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={{
        border: 'none', outline: 'none', background: 'transparent',
        fontSize: 12, color: '#0f172a', fontFamily: 'inherit', padding: 0, cursor: 'pointer',
        appearance: 'none', WebkitAppearance: 'none',
      }}
    >
      <option value="">o campo está vazio</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Section({ title, children, collapsible = true }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 0, borderBottom: '2px solid #f1f5f9' }}>
      <div
        onClick={() => collapsible && setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', cursor: collapsible ? 'pointer' : 'default',
          background: '#f8fafc',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase',
          letterSpacing: '0.06em' }}>{title}</span>
        {collapsible && (
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
        )}
      </div>
      {open && (
        <div style={{ padding: '4px 20px 12px' }}>{children}</div>
      )}
    </div>
  );
}

function UserChip({ user, onRemove }) {
  const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const bg = avatarColor(user.name);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
      background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 20,
      padding: '3px 8px 3px 4px', fontSize: 12, marginRight: 4, marginBottom: 4 }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: bg, color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700 }}>
        {initials}
      </div>
      {user.name}
      {onRemove && (
        <button onClick={() => onRemove(user.id)} style={{ background: 'none', border: 'none',
          cursor: 'pointer', color: '#94a3b8', padding: 0, fontSize: 10, lineHeight: 1 }}>×</button>
      )}
    </div>
  );
}

export default function LeadModal({ lead, stages, onClose, onSave, onDelete, onConvert }) {
  const [form, setForm] = useState({
    title: lead.title || '',
    price: lead.price || 0,
    salutation: lead.salutation || '',
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    middle_name: lead.middle_name || '',
    birth_date: lead.birth_date || '',
    position: lead.position || '',
    company_name: lead.company_name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    website: lead.website || '',
    source: lead.source || '',
    source_info: lead.source_info || '',
    available_to_all: lead.available_to_all !== false,
    address: lead.address || '',
    utm_source: lead.utm_source || '',
    utm_medium: lead.utm_medium || '',
    utm_campaign: lead.utm_campaign || '',
    comment: lead.comment || '',
    description: lead.description || '',
    stage_id: lead.stage_id,
  });

  const [selectedUsers, setSelectedUsers] = useState(lead.users || []);
  const [allUsers, setAllUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [profileUser, setProfileUser] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const fetchActivities = async () => {
    try {
      const res = await fetch(`${API}/leads/${lead.id}/activities`);
      setActivities(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetch(`${API}/users`).then(r => r.json()).then(setAllUsers).catch(() => {});
    fetchActivities();
  }, [lead.id]);

  const buildPayload = (overrideStage) => ({
    ...form,
    stage_id: overrideStage ?? form.stage_id,
    price: parseFloat(form.price) || 0,
    contact_ids: [],
    user_ids: selectedUsers.map(u => u.id),
  });

  const handleSave = async () => {
    await onSave(lead.id, buildPayload());
    await fetchActivities();
    onClose();
  };

  const handleStageClick = (sId) => {
    setForm(f => ({ ...f, stage_id: sId }));
    onSave(lead.id, buildPayload(sId));
  };

  const handlePostNote = async (e) => {
    if (e.key !== 'Enter' || !newNote.trim()) return;
    try {
      await fetch(`${API}/leads/${lead.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note', content: newNote.trim(), actor: 'Usuário' })
      });
      setNewNote('');
      await fetchActivities();
    } catch {}
  };

  const addUser = (u) => {
    if (!selectedUsers.find(x => x.id === u.id)) setSelectedUsers(prev => [...prev, u]);
    setUserSearch('');
    setShowUserDropdown(false);
  };
  const removeUser = (id) => setSelectedUsers(prev => prev.filter(u => u.id !== id));

  const currentStage = stages.find(s => s.id === form.stage_id);

  const isConverted = lead.converted;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-slider" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="modal-header" style={{ paddingBottom: 0 }}>
            <div className="modal-header-top">
              <div className="modal-title-wrap">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', background: isConverted ? '#f0fdf4' : '#ede9fe',
                    color: isConverted ? '#10b981' : '#7c3aed',
                    padding: '2px 7px', borderRadius: 4 }}>
                    {isConverted ? '✓ Convertido' : 'Lead'}
                  </span>
                  <input
                    className="modal-title-input"
                    value={form.title}
                    onChange={e => set('title')(e.target.value)}
                    placeholder="Nome do lead"
                  />
                </div>
                <div className="modal-id">ID #{lead.id} · Criado em {fmtDate(lead.created_at)}</div>
              </div>
              <div className="modal-header-actions">
                {!isConverted && onConvert && (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12, background: '#7c3aed', borderColor: '#7c3aed' }}
                    onClick={() => { if (window.confirm('Converter este lead em negócio?')) onConvert(lead.id); }}
                  >
                    ⚡ Lead convertido
                  </button>
                )}
                <button className="btn btn-danger" style={{ fontSize: 12 }}
                  onClick={() => { if (window.confirm('Excluir este lead?')) onDelete(lead.id); }}>
                  Excluir
                </button>
                <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleSave}>
                  Salvar
                </button>
                <button className="icon-btn" onClick={onClose}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Stage ribbon */}
            <div className="modal-stages-ribbon">
              {stages.map(s => (
                <div
                  key={s.id}
                  className={`ribbon-item ${s.id === form.stage_id ? 'active' : ''}`}
                  onClick={() => handleStageClick(s.id)}
                  style={s.id === form.stage_id ? { borderBottomColor: s.color || '#6366f1' } : {}}
                >
                  {s.name}
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="modal-content-grid" style={{ alignItems: 'flex-start' }}>

            {/* Left — sections */}
            <div className="modal-left" style={{ padding: 0 }}>

              <Section title="Informações do Lead">
                <FieldRow label="Saudação">
                  <InlineSelect value={form.salutation} onChange={set('salutation')} options={SALUTATIONS.filter(Boolean)} />
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
                <FieldRow label="Data de nascimento">
                  <InlineInput value={form.birth_date} onChange={set('birth_date')} type="date" />
                </FieldRow>
                <FieldRow label="Cargo">
                  <InlineInput value={form.position} onChange={set('position')} placeholder="Cargo / Posição" />
                </FieldRow>
                <FieldRow label="Empresa">
                  <InlineInput value={form.company_name} onChange={set('company_name')} placeholder="Nome da empresa" />
                </FieldRow>
              </Section>

              <Section title="Mais">
                <FieldRow label="Fonte">
                  <InlineSelect value={form.source} onChange={set('source')} options={SOURCES} />
                </FieldRow>
                <FieldRow label="Informações da fonte">
                  <InlineInput value={form.source_info} onChange={set('source_info')} placeholder="Detalhes da origem" />
                </FieldRow>
                <FieldRow label="Disponível para todos">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      onClick={() => set('available_to_all')(!form.available_to_all)}
                      style={{
                        width: 32, height: 18, borderRadius: 9,
                        background: form.available_to_all ? '#10b981' : '#e2e8f0',
                        position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                      }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%', background: 'white',
                        position: 'absolute', top: 2,
                        left: form.available_to_all ? 16 : 2,
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: form.available_to_all ? '#10b981' : '#94a3b8' }}>
                      {form.available_to_all ? 'Sim' : 'Não'}
                    </span>
                  </div>
                </FieldRow>
                <FieldRow label="Pessoa responsável">
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 4 }}>
                      {selectedUsers.map(u => (
                        <UserChip key={u.id} user={u} onRemove={removeUser} />
                      ))}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        style={{
                          width: '100%', border: 'none', borderBottom: '1px dashed #e2e8f0',
                          outline: 'none', background: 'transparent', fontSize: 12,
                          color: '#6366f1', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 0',
                        }}
                        placeholder="+ Adicionar responsável"
                        value={userSearch}
                        onChange={e => { setUserSearch(e.target.value); setShowUserDropdown(true); }}
                        onFocus={() => setShowUserDropdown(true)}
                        onBlur={() => setTimeout(() => setShowUserDropdown(false), 150)}
                      />
                      {showUserDropdown && (
                        <div className="contact-dropdown">
                          {allUsers
                            .filter(u => !selectedUsers.find(s => s.id === u.id) &&
                              u.name.toLowerCase().includes(userSearch.toLowerCase()))
                            .slice(0, 6)
                            .map(u => (
                              <div key={u.id} className="contact-dropdown-item"
                                onMouseDown={() => addUser(u)}>
                                {u.name}
                                <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>{u.role}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </FieldRow>
                <FieldRow label="Comentário">
                  <textarea
                    value={form.comment || ''}
                    onChange={e => set('comment')(e.target.value)}
                    placeholder="Observações sobre este lead..."
                    rows={2}
                    style={{
                      width: '100%', border: 'none', borderBottom: '1px solid #f1f5f9',
                      outline: 'none', background: 'transparent', fontSize: 12,
                      color: '#0f172a', fontFamily: 'inherit', resize: 'vertical', padding: 0,
                    }}
                  />
                </FieldRow>
                <FieldRow label="Endereço">
                  <InlineInput value={form.address} onChange={set('address')} placeholder="Endereço" />
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

              <Section title="Valor">
                <FieldRow label="Valor (R$)">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>R$</span>
                    <input
                      type="number"
                      value={form.price}
                      onChange={e => set('price')(e.target.value)}
                      style={{
                        border: 'none', outline: 'none', background: 'transparent',
                        fontSize: 12, color: '#0f172a', fontFamily: 'inherit', padding: 0, width: 100,
                      }}
                    />
                  </div>
                </FieldRow>
              </Section>

            </div>

            {/* Right — timeline */}
            <div className="modal-right">
              <div className="timeline-header">Atividades</div>

              <div className="timeline-note-area">
                <input
                  className="timeline-note-input"
                  placeholder="Adicionar nota... (Enter para salvar)"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={handlePostNote}
                />
              </div>

              <div className="timeline-events">
                {activities.length === 0 && (
                  <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center',
                    padding: '20px 0', fontStyle: 'italic' }}>
                    Nenhuma atividade registrada
                  </div>
                )}
                {activities.map(act => {
                  const meta = ACTIVITY_META[act.type] || { icon: '•', color: '#94a3b8' };
                  const isAuto = act.actor === 'Automação' || act.actor === 'Sistema';
                  return (
                    <div className="timeline-event" key={act.id}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: meta.color + '18',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, border: `1.5px solid ${meta.color}30`,
                      }}>{meta.icon}</div>
                      <div className="event-body" style={{ flex: 1, minWidth: 0 }}>
                        <div className="event-content">{act.content}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600,
                            color: isAuto ? '#0ea5e9' : '#64748b',
                            background: isAuto ? '#f0f9ff' : '#f1f5f9',
                            padding: '1px 5px', borderRadius: 4,
                          }}>{isAuto ? '⚙️ ' + (act.actor || 'Sistema') : '👤 ' + (act.actor || 'Usuário')}</span>
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>·</span>
                          <span className="event-time" style={{ fontSize: 10 }}>{relTime(act.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {profileUser && (
        <UserModal
          user={profileUser}
          onClose={() => setProfileUser(null)}
          onUpdate={updated => setSelectedUsers(prev => prev.map(u => u.id === updated.id ? updated : u))}
          nested
        />
      )}
    </>
  );
}

