import React, { useState, useEffect, useRef, useCallback } from 'react';
import ContactModal from './ContactModal';
import UserModal from './UserModal';
import CustomFieldValues from './CustomFieldValues';
import TaskModal from './TaskModal';
import { useConfirm } from '../App';
import { useAuth } from '../AuthContext';

import { API_URL as API } from '../config.js';

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
const SOURCES    = ['Chamada', 'Email', 'Site', 'Indicação', 'Redes Sociais', 'WhatsApp', 'Evento', 'Outro'];
const DEAL_TYPES = ['Vendas', 'Serviço', 'Parceria', 'Renovação', 'Outro'];

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

export default function CardModal({ card, stages, onClose, onSave, onDelete, isLead = false, onConvert, onDuplicate }) {
  const entityBase = isLead ? 'leads' : 'cards';
  const { token, user } = useAuth();
  const authFetch = useCallback((url, opts = {}) => {
    const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers };
    return fetch(url, { ...opts, headers });
  }, [token]);
  const [title, setTitle] = useState(card.title || '');
  const [price, setPrice] = useState(card.price || 0);
  const [description, setDescription] = useState(card.description || '');
  const [stageId, setStageId] = useState(card.stage_id);
  const [selectedContacts, setSelectedContacts] = useState(card.contacts || []);
  const [selectedUsers, setSelectedUsers] = useState(card.users || []);
  const [showIds, setShowIds] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [rightTab, setRightTab] = useState('activity'); // 'activity' | 'comment' | 'task'

  const confirm = useConfirm();
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
  const [openTask, setOpenTask]       = useState(null); // task object to open in TaskModal

  const [historyItems, setHistoryItems] = useState([]);
  const [mentionQuery, setMentionQuery]   = useState('');
  const [mentionOpen, setMentionOpen]     = useState(false);
  const [mentionIndex, setMentionIndex]   = useState(0);
  const noteInputRef = useRef(null);

  // Workflow tab state
  const [workflows, setWorkflows] = useState([]);
  const [workflowMsg, setWorkflowMsg] = useState({});  // { [wfId]: { status, text } }

  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved'
  const saveTimerRef = useRef(null);
  const isDirtyRef = useRef(false);
  const isInitialMountRef = useRef(true);

  const fetchWorkflows = async () => {
    try {
      const entityParam = isLead ? 'lead' : 'deal';
      const pipelineId = stages?.[0]?.pipeline_id;
      let url = `${API}/workflows?entity_type=${entityParam}`;
      if (pipelineId) url += `&pipeline_id=${pipelineId}`;
      const res = await authFetch(url);
      const data = await res.json();
      setWorkflows(Array.isArray(data) ? data : []);
    } catch {}
  };

  const executeWorkflow = async (wfId) => {
    setWorkflowMsg(prev => ({ ...prev, [wfId]: { status: 'loading', text: 'Executando…' } }));
    try {
      const res = await authFetch(`${API}/workflows/${wfId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: card.id }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'completed') {
        setWorkflowMsg(prev => ({ ...prev, [wfId]: { status: 'ok', text: `Concluído (${data.steps?.length || 0} etapa(s))` } }));
        // Reload card data so responsible/fields reflect changes without F5
        authFetch(`${API}/${entityBase}/${card.id}`).then(r => r.json()).then(updated => {
          onSave?.(card.id, updated);
        }).catch(() => {});
        fetchActivities();
        fetchHistory();
      } else {
        const failedStep = data.steps?.find(s => s.status === 'error');
        setWorkflowMsg(prev => ({ ...prev, [wfId]: { status: 'error', text: failedStep?.msg || data.detail || 'Falha na execução' } }));
      }
    } catch (e) {
      setWorkflowMsg(prev => ({ ...prev, [wfId]: { status: 'error', text: e.message || 'Erro desconhecido' } }));
    }
    setTimeout(() => setWorkflowMsg(prev => { const n = { ...prev }; delete n[wfId]; return n; }), 5000);
  };

  const [profileContact, setProfileContact] = useState(null);
  const [profileUser, setProfileUser] = useState(null);

  // Standard deal fields
  const [source,          setSource]          = useState(card.source || '');
  const [sourceInfo,      setSourceInfo]      = useState(card.source_info || '');
  const [dealType,        setDealType]        = useState(card.deal_type || '');
  const [startDate,       setStartDate]       = useState(card.start_date || '');
  const [availableToAll,  setAvailableToAll]  = useState(card.available_to_all !== false);
  const [observers,       setObservers]       = useState(card.observers || '');
  const [comment,         setComment]         = useState(card.comment || '');

  const fetchActivities = async () => {
    try {
      const res = await authFetch(`${API}/${entityBase}/${card.id}/activities`);
      const data = await res.json();
      setActivities(Array.isArray(data) ? [...data].reverse() : []);
    } catch {}
  };

  const fetchComments = async () => {
    if (isLead) return;
    try { setComments(await authFetch(`${API}/cards/${card.id}/comments`).then(r => r.json())); } catch {}
  };

  const fetchTasks = async () => {
    if (isLead) return;
    try { setTasks(await authFetch(`${API}/cards/${card.id}/tasks`).then(r => r.json())); } catch {}
  };

  const fetchHistory = async () => {
    if (isLead) return;
    try {
      const data = await authFetch(`${API}/audit-log?entity_type=card&entity_id=${card.id}&limit=50`).then(r => r.json());
      setHistoryItems(data.items || []);
    } catch {}
  };

  useEffect(() => {
    Promise.all([
      authFetch(`${API}/contacts`).then(r => r.json()),
      authFetch(`${API}/users`).then(r => r.json())
    ]).then(([ctxs, usrs]) => {
      setAllContacts(ctxs);
      setAllUsers(usrs);
    }).catch(() => {});
    fetchActivities();
    fetchComments();
    fetchTasks();
    authFetch(`${API}/custom-fields?entity=deal`)
      .then(r => r.json()).then(setCustomFields).catch(() => {});
  }, [card.id]);

  // F12 toggle
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'F12') { e.preventDefault(); setShowIds(v => !v); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Autosave on any field change (debounced 800ms)
  useEffect(() => {
    if (isInitialMountRef.current) { isInitialMountRef.current = false; return; }
    isDirtyRef.current = true;
    clearTimeout(saveTimerRef.current);
    const payload = {
      ...card,
      title, price: parseFloat(price) || 0, description,
      stage_id: stageId,
      contact_ids: selectedContacts.map(c => c.id),
      user_ids: selectedUsers.map(u => u.id),
      source, source_info: sourceInfo, deal_type: dealType,
      start_date: startDate, available_to_all: availableToAll,
      observers, comment,
    };
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      isDirtyRef.current = false;
      try {
        await onSave(card.id, payload);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(s => s === 'saved' ? null : s), 2000);
      } catch { setSaveStatus(null); }
    }, 800);
    return () => clearTimeout(saveTimerRef.current);
  }, [title, price, description, source, sourceInfo, dealType, startDate, availableToAll, observers, comment, selectedContacts, selectedUsers]); // eslint-disable-line

  const buildPayload = (overrideStage) => ({
    ...card,
    title,
    price: parseFloat(price) || 0,
    description,
    stage_id: overrideStage ?? stageId,
    contact_ids: selectedContacts.map(c => c.id),
    user_ids: selectedUsers.map(u => u.id),
    source,
    source_info: sourceInfo,
    deal_type: dealType,
    start_date: startDate,
    available_to_all: availableToAll,
    observers,
    comment,
  });

  const handleSave = () => {
    clearTimeout(saveTimerRef.current);
    isDirtyRef.current = false;
    setSaveStatus('saving');
    onSave(card.id, buildPayload()).then(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(s => s === 'saved' ? null : s), 2000);
    }).catch(() => setSaveStatus(null));
  };

  const handleClose = () => {
    if (isDirtyRef.current) {
      clearTimeout(saveTimerRef.current);
      onSave(card.id, buildPayload()); // fire and forget
    }
    onClose();
  };

  const handleStageClick = (sId) => {
    setStageId(sId);
    onSave(card.id, buildPayload(sId));
  };

  const mentionUsers = allUsers.filter(u =>
    !mentionQuery || u.name.toLowerCase().startsWith(mentionQuery.toLowerCase())
  ).slice(0, 5);

  const handleNoteChange = (e) => {
    const val = e.target.value;
    setNewNote(val);
    const cursor = e.target.selectionStart;
    const beforeCursor = val.slice(0, cursor);
    const atMatch = beforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionOpen(true);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (user) => {
    const cursor = noteInputRef.current?.selectionStart ?? newNote.length;
    const beforeCursor = newNote.slice(0, cursor);
    const afterCursor = newNote.slice(cursor);
    const replaced = beforeCursor.replace(/@\w*$/, `@${user.name} `);
    setNewNote(replaced + afterCursor);
    setMentionOpen(false);
    noteInputRef.current?.focus();
  };

  const handlePostNote = async (e) => {
    if (mentionOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionUsers.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (mentionUsers[mentionIndex]) insertMention(mentionUsers[mentionIndex]); return; }
      if (e.key === 'Escape')    { setMentionOpen(false); return; }
    }
    if (e.key !== 'Enter' || !newNote.trim()) return;
    try {
      await authFetch(`${API}/${entityBase}/${card.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note', content: newNote.trim(), actor: user?.user_name || 'Usuário' })
      });
      setNewNote('');
      setMentionOpen(false);
      await fetchActivities();
    } catch {}
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    try {
      await authFetch(`${API}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: card.id, author: user?.user_name || commentAuthor || 'Usuário', content: newComment.trim() })
      });
      setNewComment('');
      await fetchComments();
    } catch {}
  };

  const handleDeleteComment = async (id) => {
    await authFetch(`${API}/comments/${id}`, { method: 'DELETE' });
    await fetchComments();
  };

  const handleToggleTask = async (id) => {
    await authFetch(`${API}/tasks/${id}/toggle`, { method: 'PATCH' });
    await fetchTasks();
  };

  const handleDeleteTask = async (id) => {
    await authFetch(`${API}/tasks/${id}`, { method: 'DELETE' });
    await fetchTasks();
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;
    await authFetch(`${API}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: card.id, ...newTask })
    });
    setNewTask({ title: '', due_date: '', assigned_to: '' });
    setAddingTask(false);
    await fetchTasks();
  };

  const [dupError, setDupError] = useState('');
  const [duplicating, setDuplicating] = useState(false);

  const handleDuplicate = async () => {
    setDuplicating(true);
    setDupError('');
    try {
      const res = await authFetch(`${API}/cards/${card.id}/duplicate`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const newCard = await res.json();
      if (onDuplicate) onDuplicate(newCard);
      else onClose();
    } catch (e) {
      setDupError(e.message || 'Erro ao duplicar');
      setTimeout(() => setDupError(''), 4000);
    } finally {
      setDuplicating(false);
    }
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
                  placeholder={isLead ? "Nome do lead" : "Nome do negócio"}
                />
                <span className="modal-id">#{card.id} · {fmtDate(card.created_at)}</span>
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
                {isLead && !card.converted && onConvert && (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12, background: '#7c3aed', borderColor: '#7c3aed' }}
                    onClick={async () => {
                      if (await confirm('Converter este lead em negócio?', '', 'Converter', false)) onConvert(card.id);
                    }}
                  >
                    ⚡ Converter
                  </button>
                )}
                {isLead && card.converted && (
                  <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, padding: '4px 8px',
                    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6 }}>
                    ✓ Convertido
                  </span>
                )}
                {!isLead && (
                  <>
                    {dupError && (
                      <span style={{ fontSize: 11, color: '#ef4444', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {dupError}
                      </span>
                    )}
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, opacity: duplicating ? 0.6 : 1 }}
                      onClick={handleDuplicate}
                      disabled={duplicating}
                      title="Duplicar este negócio"
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <rect x="4" y="4" width="8" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
                        <path d="M3 9H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.3"/>
                      </svg>
                      {duplicating ? '…' : 'Duplicar'}
                    </button>
                  </>
                )}
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 12 }}
                  onClick={async () => { if (await confirm(isLead ? 'Excluir este lead?' : 'Excluir este negócio?', 'Esta ação não pode ser desfeita.')) onDelete(card.id); }}
                >
                  Excluir
                </button>
                {saveStatus === 'saving' && <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>Salvando…</span>}
                {saveStatus === 'saved' && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, whiteSpace: 'nowrap' }}>✓ Salvo</span>}
                <button className="icon-btn" onClick={handleClose}><IconX /></button>
              </div>
            </div>

            {/* Stage selector — horizontal tab bar */}
            <div className="modal-stages-bar">
              {stages.map((s, idx) => {
                const activeIdx = stages.findIndex(x => x.id === stageId);
                const isActive = s.id === stageId;
                const isPast = idx < activeIdx;
                const col = s.color || '#6366f1';
                return (
                  <button
                    key={s.id}
                    className={`stage-tab${isActive ? ' active' : ''}${isPast ? ' past' : ''}`}
                    style={isActive
                      ? { background: col, borderColor: col, color: '#fff' }
                      : isPast
                        ? { borderColor: col, color: col, background: col + '18' }
                        : {}
                    }
                    onClick={() => handleStageClick(s.id)}
                  >
                    {s.name}
                  </button>
                );
              })}
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
              <div className="form-section-title">{isLead ? 'Detalhes do lead' : 'Detalhes do negócio'}</div>

              {/* Todos os campos (nativos + personalizados) — arrastáveis */}
              <div className="form-group">
                <CustomFieldValues
                  entity={isLead ? 'lead' : 'deal'}
                  entityId={card.id}
                  showIds={showIds}
                  pipelineId={stages?.[0]?.pipeline_id ?? null}
                  stages={stages ?? []}
                  nativeFields={[
                    {
                      id: 'deal.users', name: 'Responsáveis',
                      renderContent: () => (
                        <>
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
                        </>
                      ),
                    },
                    {
                      id: 'deal.price', name: 'Valor',
                      renderContent: () => (
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
                      ),
                    },
                    {
                      id: 'deal.contacts', name: 'Contatos vinculados',
                      renderContent: () => (
                        <>
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
                        </>
                      ),
                    },
                    {
                      id: 'deal.description', name: 'Descrição',
                      renderContent: () => (
                        <textarea
                          className="form-textarea"
                          rows={4}
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          placeholder={isLead ? "Detalhes do lead..." : "Detalhes do negócio..."}
                        />
                      ),
                    },
                    {
                      id: 'deal.deal_type', name: 'Tipo de negócio',
                      renderContent: () => (
                        <select className="form-select" value={dealType} onChange={e => setDealType(e.target.value)}>
                          <option value="">Selecionar...</option>
                          {DEAL_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ),
                    },
                    {
                      id: 'deal.source', name: 'Fonte',
                      renderContent: () => (
                        <select className="form-select" value={source} onChange={e => setSource(e.target.value)}>
                          <option value="">Selecionar...</option>
                          {SOURCES.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ),
                    },
                    {
                      id: 'deal.source_info', name: 'Informações da fonte',
                      renderContent: () => (
                        <input className="form-input" value={sourceInfo} onChange={e => setSourceInfo(e.target.value)} placeholder="Detalhes da origem..." />
                      ),
                    },
                    {
                      id: 'deal.start_date', name: 'Data de início',
                      renderContent: () => (
                        <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                      ),
                    },
                    {
                      id: 'deal.available_to_all', name: 'Disponível para todos',
                      renderContent: () => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button type="button" onClick={() => setAvailableToAll(v => !v)} style={{
                            width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', padding: 0, position: 'relative',
                            background: availableToAll ? '#10b981' : '#e2e8f0', transition: 'background 0.2s',
                          }}>
                            <span style={{
                              position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff',
                              transition: 'left 0.2s', left: availableToAll ? 19 : 3,
                            }} />
                          </button>
                          <span style={{ fontSize: 13, color: availableToAll ? '#10b981' : '#94a3b8' }}>
                            {availableToAll ? 'Sim' : 'Não'}
                          </span>
                        </div>
                      ),
                    },
                    {
                      id: 'deal.observers', name: 'Observadores',
                      renderContent: () => (
                        <input className="form-input" value={observers} onChange={e => setObservers(e.target.value)} placeholder="Adicionar observadores..." />
                      ),
                    },
                    {
                      id: 'deal.comment', name: 'Comentário',
                      renderContent: () => (
                        <textarea className="form-textarea" rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Adicionar comentário..." />
                      ),
                    },
                    {
                      id: 'deal.utm', name: 'Parâmetros UTM',
                      renderContent: () => (
                        <div style={{ fontSize: 13, color: '#64748b' }}>
                          {(card.utm_source || card.utm_medium || card.utm_campaign) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {card.utm_source   && <span>utm_source: <b>{card.utm_source}</b></span>}
                              {card.utm_medium   && <span>utm_medium: <b>{card.utm_medium}</b></span>}
                              {card.utm_campaign && <span>utm_campaign: <b>{card.utm_campaign}</b></span>}
                            </div>
                          ) : <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Nenhum</span>}
                        </div>
                      ),
                    },
                    {
                      id: 'deal.id', name: 'ID',
                      renderContent: () => (
                        <span style={{ fontSize: 14, color: '#64748b', fontFamily: 'monospace' }}>#{card.id}</span>
                      ),
                    },
                    {
                      id: 'deal.stage', name: 'Etapa',
                      renderContent: () => {
                        const s = stages?.find(st => st.id === stageId);
                        return <span style={{ fontSize: 14, color: '#334155' }}>{s?.name ?? '—'}</span>;
                      },
                    },
                    {
                      id: 'deal.created_at', name: 'Criado em',
                      renderContent: () => (
                        <span style={{ fontSize: 14, color: '#64748b' }}>{fmtDate(card.created_at)}</span>
                      ),
                    },
                    {
                      id: 'deal.updated_at', name: 'Modificada em',
                      renderContent: () => (
                        <span style={{ fontSize: 14, color: '#64748b' }}>{card.updated_at ? fmtDate(card.updated_at) : '—'}</span>
                      ),
                    },
                    {
                      id: 'deal.stage_changed_by', name: 'Etapa alterada por',
                      renderContent: () => (
                        <span style={{ fontSize: 14, color: '#64748b' }}>{card.stage_changed_by ?? '—'}</span>
                      ),
                    },
                  ]}
                />
              </div>
            </div>

            {/* Right panel: tabbed */}
            <div className="modal-right">
              {/* Tab header */}
              <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', marginBottom: 0, flexShrink: 0 }}>
                {[
                  { key: 'activity', label: 'Atividades' },
                  { key: 'comment',  label: 'Comentários' },
                  { key: 'task',     label: `Tarefas${tasks.length > 0 ? ` (${tasks.length})` : ''}` },
                  { key: 'history',  label: 'Histórico' },
                  { key: 'workflows', label: 'Fluxos' },
                ].map(t => (
                  <button key={t.key} onClick={() => { setRightTab(t.key); if (t.key === 'history') fetchHistory(); if (t.key === 'workflows') fetchWorkflows(); }}
                    style={{
                      flex: 1, background: 'none', border: 'none', borderBottom: `2px solid ${rightTab === t.key ? '#6366f1' : 'transparent'}`,
                      color: rightTab === t.key ? '#6366f1' : '#64748b', fontWeight: rightTab === t.key ? 700 : 500,
                      fontSize: 11, padding: '10px 4px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                    }}
                  >{t.label}</button>
                ))}
              </div>

              {/* Activity tab */}
              {rightTab === 'activity' && (
                <>
                  <div className="timeline-note-area" style={{ position: 'relative' }}>
                    <input
                      ref={noteInputRef}
                      className="timeline-note-input"
                      placeholder="Adicionar nota... @ para mencionar"
                      value={newNote}
                      onChange={handleNoteChange}
                      onKeyDown={handlePostNote}
                    />
                    {mentionOpen && mentionUsers.length > 0 && (
                      <div style={{
                        position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 100,
                        background: 'white', border: '1px solid #e2e8f0', borderRadius: 8,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden', marginBottom: 4,
                      }}>
                        {mentionUsers.map((u, i) => (
                          <div key={u.id} onClick={() => insertMention(u)}
                            style={{
                              padding: '7px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                              background: i === mentionIndex ? '#eef2ff' : 'white',
                              color: i === mentionIndex ? '#4338ca' : '#0f172a',
                            }}
                            onMouseEnter={() => setMentionIndex(i)}
                          >
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: avatarColor(u.name), color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                              {u.name.slice(0,2).toUpperCase()}
                            </div>
                            <span>{u.name}</span>
                            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{u.role}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
                </>
              )}

              {/* Comment tab */}
              {rightTab === 'comment' && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                    <textarea
                      className="timeline-note-input"
                      placeholder="Escrever comentário... (Enter para enviar)"
                      value={newComment}
                      rows={2}
                      style={{ resize: 'none', width: '100%' }}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(); } }}
                    />
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {comments.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
                        Nenhum comentário
                      </div>
                    ) : comments.map(c => (
                      <div key={c.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(c.author), color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {(c.author || 'U').slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{c.author}</span>
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>{relTime(c.created_at)}</span>
                            <button onClick={() => handleDeleteComment(c.id)} style={{
                              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                              color: '#cbd5e1', fontSize: 13, padding: 0,
                            }} onMouseEnter={e => e.target.style.color='#ef4444'} onMouseLeave={e => e.target.style.color='#cbd5e1'}>×</button>
                          </div>
                          <div style={{ fontSize: 13, color: '#334155', marginTop: 2, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.content}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Task tab */}
              {rightTab === 'task' && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                    {!addingTask ? (
                      <button onClick={() => setAddingTask(true)} style={{
                        background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 6, padding: '6px 12px',
                        fontSize: 12, color: '#64748b', cursor: 'pointer', width: '100%', textAlign: 'left',
                      }}>+ Nova tarefa</button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input className="form-input" style={{ fontSize: 12 }} placeholder="Título da tarefa" autoFocus
                          value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') handleCreateTask(); if (e.key === 'Escape') setAddingTask(false); }} />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input className="form-input" type="date" style={{ fontSize: 12, flex: 1 }}
                            value={newTask.due_date} onChange={e => setNewTask(t => ({ ...t, due_date: e.target.value }))} />
                          <input className="form-input" style={{ fontSize: 12, flex: 1 }} placeholder="Responsável"
                            value={newTask.assigned_to} onChange={e => setNewTask(t => ({ ...t, assigned_to: e.target.value }))} />
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary" style={{ fontSize: 11, flex: 1 }} onClick={handleCreateTask}>Salvar</button>
                          <button className="btn btn-ghost" style={{ fontSize: 11, flex: 1 }} onClick={() => setAddingTask(false)}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {tasks.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
                        Nenhuma tarefa
                      </div>
                    ) : tasks.map(t => (
                      <div key={t.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <input type="checkbox" checked={t.done} onChange={() => handleToggleTask(t.id)}
                          style={{ marginTop: 2, accentColor: '#6366f1', cursor: 'pointer', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setOpenTask(t)}>
                          <div style={{ fontSize: 13, color: t.done ? '#94a3b8' : '#0f172a', textDecoration: t.done ? 'line-through' : 'none', fontWeight: 500 }}>{t.title}</div>
                          {(t.due_date || t.assigned_to) && (
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'flex', gap: 8 }}>
                              {t.due_date && <span>📅 {t.due_date}</span>}
                              {t.assigned_to && <span>👤 {t.assigned_to}</span>}
                            </div>
                          )}
                        </div>
                        <button onClick={() => setOpenTask(t)} title="Abrir tarefa" style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: 11, padding: '0 4px', flexShrink: 0, opacity: 0.6,
                        }}>↗</button>
                        <button onClick={() => handleDeleteTask(t.id)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 14, padding: 0, flexShrink: 0,
                        }} onMouseEnter={e => e.target.style.color='#ef4444'} onMouseLeave={e => e.target.style.color='#cbd5e1'}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workflows tab */}
              {rightTab === 'workflows' && (
                <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
                  {workflows.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '24px 0', fontStyle: 'italic' }}>
                      Nenhum fluxo disponível para este tipo de card.
                    </div>
                  ) : workflows.map(wf => {
                    const msg = workflowMsg[wf.id];
                    return (
                      <div key={wf.id} style={{
                        border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', marginBottom: 8,
                        background: '#fafafa',
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 2 }}>{wf.name}</div>
                        {wf.description && <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{wf.description}</div>}
                        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>{wf.steps?.length || 0} etapa(s)</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 11, padding: '4px 12px' }}
                            disabled={msg?.status === 'loading'}
                            onClick={() => executeWorkflow(wf.id)}
                          >
                            ▶ Executar
                          </button>
                          {msg && (
                            <span style={{ fontSize: 11, color: msg.status === 'ok' ? '#10b981' : msg.status === 'error' ? '#ef4444' : '#94a3b8' }}>
                              {msg.text}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* History tab */}
              {rightTab === 'history' && (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {historyItems.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '24px 16px', fontStyle: 'italic' }}>
                      Nenhuma alteração registrada. As ações (criar, editar, mover) aparecem aqui automaticamente.
                    </div>
                  ) : historyItems.map(item => {
                    const actionColors = {
                      created: '#10b981', updated: '#3b82f6', deleted: '#ef4444',
                      moved: '#f59e0b', converted: '#8b5cf6', login: '#94a3b8',
                      workflow_executed: '#6366f1',
                    };
                    const actionLabels = {
                      created: 'Criou', updated: 'Editou', deleted: 'Excluiu',
                      moved: 'Moveu', converted: 'Converteu', login: 'Acessou',
                      workflow_executed: 'Executou fluxo',
                    };
                    const color = actionColors[item.action] || '#94a3b8';
                    const label = actionLabels[item.action] || item.action;
                    let details = null;
                    let workflowName = null;
                    if (item.details) {
                      try {
                        const d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
                        if (item.action === 'workflow_executed') workflowName = d.workflow_name || d.workflow || null;
                        else if (d.new_stage_name) details = d.new_stage_name;
                        else if (d.new_stage_id) details = `etapa #${d.new_stage_id}`;
                        else if (d.duplicated_from) details = `(cópia do #${d.duplicated_from})`;
                      } catch {}
                    }
                    return (
                      <div key={item.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.4 }}>
                            <span style={{ fontWeight: 600 }}>{item.actor}</span>
                            {item.action === 'workflow_executed' ? (
                              <> <span style={{ color }}>executou o fluxo</span>{' '}
                              <span style={{ fontWeight: 600, color: '#6366f1' }}>{workflowName || '—'}</span></>
                            ) : item.action === 'moved' ? (
                              <> <span style={{ color }}>moveu para</span>{' '}
                              <span style={{ fontWeight: 600, color }}>{details || `etapa #${item.entity_id}`}</span></>
                            ) : (
                              <> <span style={{ color }}>{label}</span>
                              {' '}este negócio
                              {details && <span style={{ color: '#64748b' }}> {details}</span>}</>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                            {item.created_at ? relTime(item.created_at) : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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

      {openTask && (
        <TaskModal
          task={openTask}
          onClose={() => setOpenTask(null)}
          onSave={(updated) => {
            setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
            setOpenTask(null);
          }}
          onDelete={(id) => {
            setTasks(prev => prev.filter(t => t.id !== id));
            setOpenTask(null);
          }}
        />
      )}
    </>
  );
}

