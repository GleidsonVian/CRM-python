import React, { useState, useEffect, useRef } from 'react';
import ContactModal from './ContactModal';
import UserModal from './UserModal';
import CustomFieldValues from './CustomFieldValues';

const API = 'http://localhost:8000';

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
  auto:            { icon: '🤖', color: '#0ea5e9' },
  webhook:         { icon: '🔗', color: '#6366f1' },
  system:          { icon: '⚙️', color: '#94a3b8' },
};

const avatarColor = (name) => {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconXSm = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

function ChipList({ items, getName, onRemove, onViewProfile, color }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {items.map(item => {
        const name = getName(item);
        const bg = color ? color(name) : '#6366f1';
        const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        return (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#f1f5f9', border: '1px solid #e2e8f0',
            borderRadius: 20, padding: '3px 8px 3px 4px',
            fontSize: 12, color: '#0f172a'
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: bg, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, flexShrink: 0
            }}>{initials}</div>
            <span style={{ fontWeight: 500 }}>{name}</span>
            <button
              onClick={() => onViewProfile(item)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: 0, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}
              title="Ver perfil"
            >
              →
            </button>
            <button
              onClick={() => onRemove(item.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex', alignItems: 'center' }}
              title="Remover"
            >
              <IconXSm />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SearchDropdown({ placeholder, items, getName, onSelect, selectedIds }) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const filtered = items.filter(i =>
    !selectedIds.includes(i.id) &&
    getName(i).toLowerCase().includes(term.toLowerCase())
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className="form-input"
        placeholder={placeholder}
        value={term}
        onChange={e => { setTerm(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ fontSize: 12 }}
      />
      {open && (
        <div className="contact-dropdown">
          {filtered.length === 0 ? (
            <div className="contact-dropdown-empty">Nenhum resultado</div>
          ) : filtered.slice(0, 8).map(i => (
            <div
              key={i.id}
              className="contact-dropdown-item"
              onMouseDown={() => { onSelect(i); setTerm(''); setOpen(false); }}
            >
              {getName(i)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Inline badge shown next to native field labels when showIds=true
function FieldRef({ variable, showIds }) {
  if (!showIds) return null;
  return (
    <code style={{
      fontSize: 9, background: '#1e293b', color: '#f59e0b',
      padding: '1px 5px', borderRadius: 3, marginLeft: 5,
      fontFamily: 'monospace', letterSpacing: '0.03em',
      fontWeight: 700, verticalAlign: 'middle',
      userSelect: 'all', cursor: 'text',
    }}>{`{{${variable}}}`}</code>
  );
}

// Native fields reference for F12 panel
const NATIVE_FIELDS = [
  { uid: 'deal.title',       label: 'Título',        type: 'text'   },
  { uid: 'deal.price',       label: 'Valor (R$)',     type: 'number' },
  { uid: 'deal.description', label: 'Descrição',      type: 'text'   },
  { uid: 'deal.stage_id',    label: 'Etapa',          type: 'id'     },
  { uid: 'contact.name',     label: 'Nome do contato',type: 'text'   },
  { uid: 'contact.email',    label: 'E-mail',         type: 'text'   },
  { uid: 'contact.phone',    label: 'Telefone',       type: 'text'   },
  { uid: 'stage.name',       label: 'Nome da etapa',  type: 'text'   },
  { uid: 'pipeline.name',    label: 'Nome do funil',  type: 'text'   },
];

export default function CardModal({ card, stages, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(card.title || '');
  const [price, setPrice] = useState(card.price || 0);
  const [description, setDescription] = useState(card.description || '');
  const [stageId, setStageId] = useState(card.stage_id);
  const [selectedContacts, setSelectedContacts] = useState(card.contacts || []);
  const [selectedUsers, setSelectedUsers] = useState(card.users || []);
  const [showIds, setShowIds] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [rightTab, setRightTab] = useState('activity'); // 'activity' | 'comment' | 'task'

  const [allContacts, setAllContacts] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [newNote, setNewNote] = useState('');

  const [comments, setComments]       = useState([]);
  const [newComment, setNewComment]   = useState('');
  const [commentAuthor, setCommentAuthor] = useState('Usuário');

  const [tasks, setTasks]             = useState([]);
  const [newTask, setNewTask]         = useState({ title: '', due_date: '', assigned_to: '' });
  const [addingTask, setAddingTask]   = useState(false);

  const [profileContact, setProfileContact] = useState(null);
  const [profileUser, setProfileUser] = useState(null);

  const fetchActivities = async () => {
    try {
      const res = await fetch(`${API}/cards/${card.id}/activities`);
      setActivities(await res.json());
    } catch {}
  };

  const fetchComments = async () => {
    try { setComments(await fetch(`${API}/cards/${card.id}/comments`).then(r => r.json())); } catch {}
  };

  const fetchTasks = async () => {
    try { setTasks(await fetch(`${API}/cards/${card.id}/tasks`).then(r => r.json())); } catch {}
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API}/contacts`).then(r => r.json()),
      fetch(`${API}/users`).then(r => r.json())
    ]).then(([ctxs, usrs]) => {
      setAllContacts(ctxs);
      setAllUsers(usrs);
    }).catch(() => {});
    fetchActivities();
    fetchComments();
    fetchTasks();
    fetch(`${API}/custom-fields?entity=deal`)
      .then(r => r.json()).then(setCustomFields).catch(() => {});
  }, [card.id]);

  // F12 toggle
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'F12') { e.preventDefault(); setShowIds(v => !v); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const buildPayload = (overrideStage) => ({
    ...card,
    title,
    price: parseFloat(price) || 0,
    description,
    stage_id: overrideStage ?? stageId,
    contact_ids: selectedContacts.map(c => c.id),
    user_ids: selectedUsers.map(u => u.id),
  });

  const handleSave = async () => {
    await onSave(card.id, buildPayload());
    await fetchActivities();
    onClose();
  };

  const handleStageClick = (sId) => {
    setStageId(sId);
    onSave(card.id, buildPayload(sId));
  };

  const handlePostNote = async (e) => {
    if (e.key !== 'Enter' || !newNote.trim()) return;
    try {
      await fetch(`${API}/cards/${card.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note', content: newNote.trim(), actor: 'Usuário' })
      });
      setNewNote('');
      await fetchActivities();
    } catch {}
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    try {
      await fetch(`${API}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: card.id, author: commentAuthor || 'Usuário', content: newComment.trim() })
      });
      setNewComment('');
      await fetchComments();
    } catch {}
  };

  const handleDeleteComment = async (id) => {
    await fetch(`${API}/comments/${id}`, { method: 'DELETE' });
    await fetchComments();
  };

  const handleToggleTask = async (id) => {
    await fetch(`${API}/tasks/${id}/toggle`, { method: 'PATCH' });
    await fetchTasks();
  };

  const handleDeleteTask = async (id) => {
    await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
    await fetchTasks();
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;
    await fetch(`${API}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.id, ...newTask })
    });
    setNewTask({ title: '', due_date: '', assigned_to: '' });
    setAddingTask(false);
    await fetchTasks();
  };

  const addContact = (c) => setSelectedContacts(prev => prev.find(x => x.id === c.id) ? prev : [...prev, c]);
  const removeContact = (id) => setSelectedContacts(prev => prev.filter(c => c.id !== id));
  const addUser = (u) => setSelectedUsers(prev => prev.find(x => x.id === u.id) ? prev : [...prev, u]);
  const removeUser = (id) => setSelectedUsers(prev => prev.filter(u => u.id !== id));

  const getContactName = (c) => `${c.first_name} ${c.last_name || ''}`.trim();
  const getUserName = (u) => u.name;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-slider" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="modal-header">
            <div className="modal-header-top">
              <div className="modal-title-wrap">
                <input
                  className="modal-title-input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Nome do negócio"
                />
                <div className="modal-id">ID #{card.id} · Criado em {fmtDate(card.created_at)}</div>
              </div>
              <div className="modal-header-actions">
                <button
                  onClick={() => setShowIds(v => !v)}
                  title="Mostrar/ocultar identificadores dos campos (F12)"
                  style={{
                    background: showIds ? '#1e293b' : 'none',
                    border: `1px solid ${showIds ? '#334155' : '#e2e8f0'}`,
                    borderRadius: 6, cursor: 'pointer', color: showIds ? '#f59e0b' : '#94a3b8',
                    fontSize: 10, fontWeight: 700, padding: '4px 8px', fontFamily: 'monospace',
                    transition: 'all 0.12s',
                  }}
                >F12</button>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 12 }}
                  onClick={() => { if (window.confirm('Excluir este negócio?')) onDelete(card.id); }}
                >
                  Excluir
                </button>
                <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleSave}>
                  Salvar
                </button>
                <button className="icon-btn" onClick={onClose}><IconX /></button>
              </div>
            </div>

            {/* Stage ribbon */}
            <div className="modal-stages-ribbon">
              {stages.map(s => (
                <div
                  key={s.id}
                  className={`ribbon-item ${s.id === stageId ? 'active' : ''}`}
                  onClick={() => handleStageClick(s.id)}
                >
                  {s.name}
                </div>
              ))}
            </div>
          </div>

          {/* F12 panel — field reference */}
          {showIds && (
            <div style={{
              background: '#0f172a', borderBottom: '1px solid #1e293b',
              padding: '10px 20px', display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center',
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 2, flexShrink: 0 }}>
                🔍 Nativos
              </span>
              {NATIVE_FIELDS.map(f => (
                <div
                  key={f.uid}
                  title={f.label}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#1e293b', borderRadius: 4, border: '1px solid #334155', padding: '2px 7px', flexShrink: 0 }}
                >
                  <span style={{ fontSize: 9, color: '#64748b' }}>{f.label}</span>
                  <code style={{ fontSize: 10, color: '#38bdf8' }}>{`{{${f.uid}}}`}</code>
                </div>
              ))}
              {customFields.length > 0 && (
                <>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 2px', flexShrink: 0 }}>
                    · Personalizados
                  </span>
                  {customFields.map(f => (
                    <div
                      key={f.id}
                      title={`${f.name} · chave: ${f.key}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#1e293b', borderRadius: 4, border: '1px solid #334155', padding: '2px 7px', flexShrink: 0 }}
                    >
                      <span style={{ fontSize: 9, color: '#64748b' }}>{f.name}</span>
                      <code style={{ fontSize: 10, color: '#f59e0b' }}>{`{{cf.${f.uid}}}`}</code>
                    </div>
                  ))}
                </>
              )}
              <span style={{ fontSize: 9, color: '#334155', marginLeft: 4, flexShrink: 0 }}>· F12 fecha</span>
            </div>
          )}

          <div className="modal-content-grid">
            {/* Left panel */}
            <div className="modal-left">
              <div className="form-section-title">Detalhes do negócio</div>

              {/* Responsáveis */}
              <div className="form-group">
                <label className="form-label">Responsáveis<FieldRef variable="deal.users" showIds={showIds} /></label>
                <ChipList
                  items={selectedUsers}
                  getName={getUserName}
                  onRemove={removeUser}
                  onViewProfile={u => setProfileUser(u)}
                  color={avatarColor}
                />
                <div style={{ marginTop: 6 }}>
                  <SearchDropdown
                    placeholder="Adicionar responsável..."
                    items={allUsers}
                    getName={getUserName}
                    onSelect={addUser}
                    selectedIds={selectedUsers.map(u => u.id)}
                  />
                </div>
              </div>

              {/* Valor */}
              <div className="form-group">
                <label className="form-label">Valor<FieldRef variable="deal.price" showIds={showIds} /></label>
                <div className="price-box">
                  <span className="price-symbol">R$</span>
                  <input
                    type="number"
                    className="price-input"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Contatos vinculados */}
              <div className="form-group">
                <label className="form-label">Contatos vinculados<FieldRef variable="deal.contacts" showIds={showIds} /></label>
                <ChipList
                  items={selectedContacts}
                  getName={getContactName}
                  onRemove={removeContact}
                  onViewProfile={c => setProfileContact(c)}
                  color={avatarColor}
                />
                <div style={{ marginTop: 6 }}>
                  <SearchDropdown
                    placeholder="Adicionar contato..."
                    items={allContacts}
                    getName={getContactName}
                    onSelect={addContact}
                    selectedIds={selectedContacts.map(c => c.id)}
                  />
                </div>
              </div>

              {/* Descrição */}
              <div className="form-group">
                <label className="form-label">Descrição<FieldRef variable="deal.description" showIds={showIds} /></label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detalhes do negócio..."
                />
              </div>

              {/* Campos personalizados */}
              <div className="form-group">
                <CustomFieldValues entity="deal" entityId={card.id} showIds={showIds} />
              </div>
            </div>

            {/* Right panel: timeline */}
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
                  <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
                    Nenhuma atividade registrada
                  </div>
                )}
                {activities.map(act => {
                  const meta = ACTIVITY_META[act.type] || { icon: '•', color: '#94a3b8' };
                  const isAuto = act.actor === 'Automação';
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
                            fontSize: 10, fontWeight: 600, color: isAuto ? '#0ea5e9' : '#64748b',
                            background: isAuto ? '#f0f9ff' : '#f1f5f9',
                            padding: '1px 5px', borderRadius: 4,
                          }}>{isAuto ? '🤖 Automação' : '👤 ' + (act.actor || 'Usuário')}</span>
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

      {profileContact && (
        <ContactModal
          contact={profileContact}
          onClose={() => setProfileContact(null)}
          onUpdate={updated => setSelectedContacts(prev => prev.map(c => c.id === updated.id ? updated : c))}
          nested
        />
      )}

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
