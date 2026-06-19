import React, { useState, useEffect, useRef, useCallback } from 'react';
import ContactModal from './ContactModal';
import UserModal from './UserModal';
import CustomFieldValues from './CustomFieldValues';
import { useConfirm } from '../App';
import { useAuth } from '../AuthContext';

import { API_URL as API } from '../config.js';

const CONVERT_OPTIONS = [
  { id: 'deal_contact_company', label: 'Negócio + Contato + Empresa', deal: true,  contact: true,  company: true  },
  { id: 'deal_contact',         label: 'Negócio + Contato',           deal: true,  contact: true,  company: false },
  { id: 'deal_company',         label: 'Negócio + Empresa',           deal: true,  contact: false, company: true  },
  { id: 'deal',                 label: 'Negócio',                     deal: true,  contact: false, company: false },
  { id: 'contact_company',      label: 'Contato + Empresa',           deal: false, contact: true,  company: true  },
  { id: 'contact',              label: 'Contato',                     deal: false, contact: true,  company: false },
  { id: 'company',              label: 'Empresa',                     deal: false, contact: false, company: true  },
];

export function LeadConvertModal({ lead, onConfirm, onClose }) {
  const [selected, setSelected] = useState('deal_contact_company');
  const [converting, setConverting] = useState(false);
  const opt = CONVERT_OPTIONS.find(o => o.id === selected);
  const handleConfirm = async () => {
    setConverting(true);
    await onConfirm({ create_deal: opt.deal, create_contact: opt.contact, create_company: opt.company });
    setConverting(false);
  };
  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', borderRadius: 12, padding: 28, width: 420,
        boxShadow: '0 8px 40px rgba(0,0,0,0.22)', position: 'relative',
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>×</button>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18, color: 'var(--text-primary)' }}>
          Selecione o resultado de conversão do Lead
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
          {CONVERT_OPTIONS.map(opt => (
            <label key={opt.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
              borderRadius: 8, cursor: 'pointer', fontSize: 14,
              background: selected === opt.id ? 'var(--accent-light, #ede9fe)' : 'transparent',
              color: selected === opt.id ? 'var(--accent, #7c3aed)' : 'var(--text-primary)',
              fontWeight: selected === opt.id ? 600 : 400,
              border: `1.5px solid ${selected === opt.id ? 'var(--accent, #7c3aed)' : 'var(--border)'}`,
              transition: 'all 0.12s',
            }}>
              <input type="radio" name="convert_opt" value={opt.id} checked={selected === opt.id}
                onChange={() => setSelected(opt.id)} style={{ accentColor: 'var(--accent, #7c3aed)' }} />
              {opt.label}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>Cancelar</button>
          <button className="btn btn-primary" style={{ fontSize: 13, background: '#7c3aed', borderColor: '#7c3aed', minWidth: 120 }}
            onClick={handleConfirm} disabled={converting}>
            {converting ? 'Convertendo...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
const SALUTATIONS = ['Sr.', 'Sra.', 'Dr.', 'Dra.', 'Prof.'];

function ChipUser({ user, onRemove }) {
  const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const bg = avatarColor(user.name);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
      background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 20,
      padding: '3px 8px 3px 4px', fontSize: 12, marginRight: 4, marginBottom: 4 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: bg, color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
        {initials}
      </div>
      <span style={{ fontWeight: 500 }}>{user.name}</span>
      {onRemove && (
        <button onClick={() => onRemove(user.id)} style={{ background: 'none', border: 'none',
          cursor: 'pointer', color: '#94a3b8', padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
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

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const [selectedUsers, setSelectedUsers] = useState(lead.users || []);
  const { token } = useAuth();
  const authFetch = useCallback((url, opts = {}) => {
    const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers };
    return fetch(url, { ...opts, headers });
  }, [token]);

  const [allUsers, setAllUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [rightTab, setRightTab] = useState('activity');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showIds, setShowIds] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [workflowMsg, setWorkflowMsg] = useState({});
  const confirm = useConfirm();
  const [saveStatus, setSaveStatus] = useState(null);
  const saveTimerRef = useRef(null);
  const isDirtyRef = useRef(false);
  const isInitialMountRef = useRef(true);

  const fetchWorkflows = async () => {
    try {
      const res = await authFetch(`${API}/workflows?entity_type=lead`);
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
        body: JSON.stringify({ lead_id: lead.id }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'completed') {
        setWorkflowMsg(prev => ({ ...prev, [wfId]: { status: 'ok', text: `Concluído (${data.steps?.length || 0} etapa(s))` } }));
        authFetch(`${API}/leads/${lead.id}`).then(r => r.json()).then(updated => {
          onSave?.(updated);
        }).catch(() => {});
      } else {
        const msg = data.steps?.find(s => s.status === 'error')?.msg || data.detail || 'Erro';
        setWorkflowMsg(prev => ({ ...prev, [wfId]: { status: 'error', text: msg } }));
      }
    } catch (e) {
      setWorkflowMsg(prev => ({ ...prev, [wfId]: { status: 'error', text: e.message } }));
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await fetch(`${API}/leads/${lead.id}/activities`);
      const data = await res.json();
      setActivities(Array.isArray(data) ? [...data].reverse() : []);
    } catch {}
  };

  useEffect(() => {
    fetch(`${API}/users`).then(r => r.json()).then(setAllUsers).catch(() => {});
    fetchActivities();
  }, [lead.id]);

  // Autosave on any field change (debounced 800ms)
  useEffect(() => {
    if (isInitialMountRef.current) { isInitialMountRef.current = false; return; }
    isDirtyRef.current = true;
    clearTimeout(saveTimerRef.current);
    const payload = {
      ...form,
      stage_id: form.stage_id,
      price: parseFloat(form.price) || 0,
      contact_ids: [],
      user_ids: selectedUsers.map(u => u.id),
    };
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      isDirtyRef.current = false;
      try {
        await onSave(lead.id, payload);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(s => s === 'saved' ? null : s), 2000);
      } catch { setSaveStatus(null); }
    }, 800);
    return () => clearTimeout(saveTimerRef.current);
  }, [form, selectedUsers]); // eslint-disable-line

  const buildPayload = (overrideStage) => ({
    ...form,
    stage_id: overrideStage ?? form.stage_id,
    price: parseFloat(form.price) || 0,
    contact_ids: [],
    user_ids: selectedUsers.map(u => u.id),
  });

  const handleSave = () => {
    clearTimeout(saveTimerRef.current);
    isDirtyRef.current = false;
    setSaveStatus('saving');
    onSave(lead.id, buildPayload()).then(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(s => s === 'saved' ? null : s), 2000);
    }).catch(() => setSaveStatus(null));
  };

  const handleClose = () => {
    if (isDirtyRef.current) {
      clearTimeout(saveTimerRef.current);
      onSave(lead.id, buildPayload()); // fire and forget
    }
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note', content: newNote.trim(), actor: 'Usuário' })
      });
      setNewNote('');
      await fetchActivities();
    } catch {}
  };

  const addUser = (u) => {
    if (!selectedUsers.find(x => x.id === u.id)) setSelectedUsers(prev => [...prev, u]);
    setUserSearch(''); setShowUserDropdown(false);
  };
  const removeUser = (id) => setSelectedUsers(prev => prev.filter(u => u.id !== id));

  const isConverted = lead.converted;

  return (
    <>
      {showConvertModal && (
        <LeadConvertModal
          lead={lead}
          onClose={() => setShowConvertModal(false)}
          onConfirm={async (opts) => { await onConvert(lead.id, opts); setShowConvertModal(false); }}
        />
      )}
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-slider" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="modal-header" style={{ paddingBottom: 0 }}>
            <div className="modal-header-top">
              <div className="modal-title-wrap">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    background: isConverted ? '#f0fdf4' : '#ede9fe',
                    color: isConverted ? '#10b981' : '#7c3aed',
                    padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                  }}>
                    {isConverted ? '✓ Convertido' : 'Lead'}
                  </span>
                  <input
                    className="modal-title-input"
                    value={form.title}
                    onChange={e => set('title')(e.target.value)}
                    placeholder="Nome do lead"
                  />
                </div>
                <span className="modal-id">ID #{lead.id} · Criado em {fmtDate(lead.created_at)}</span>
              </div>
              <div className="modal-header-actions">
                {!isConverted && onConvert && (
                  <button className="btn btn-primary"
                    style={{ fontSize: 12, background: '#7c3aed', borderColor: '#7c3aed' }}
                    onClick={() => setShowConvertModal(true)}>
                    ⚡ Lead convertido
                  </button>
                )}
                <button className="btn btn-danger" style={{ fontSize: 12 }}
                  onClick={async () => { if (await confirm('Excluir este lead?', 'Esta ação não pode ser desfeita.')) onDelete(lead.id); }}>
                  Excluir
                </button>
                {saveStatus === 'saving' && <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>Salvando…</span>}
                {saveStatus === 'saved' && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, whiteSpace: 'nowrap' }}>✓ Salvo</span>}
                <button className="icon-btn" onClick={handleClose}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Stage tab bar */}
            <div className="modal-stages-bar">
              {stages.map((s, idx) => {
                const activeIdx = stages.findIndex(x => x.id === form.stage_id);
                const isActive = s.id === form.stage_id;
                const isPast = idx < activeIdx;
                const col = s.color || '#6366f1';
                return (
                  <button key={s.id}
                    className={`stage-tab${isActive ? ' active' : ''}${isPast ? ' past' : ''}`}
                    style={isActive
                      ? { background: col, borderColor: col, color: '#fff' }
                      : isPast ? { borderColor: col, color: col, background: col + '18' } : {}
                    }
                    onClick={() => handleStageClick(s.id)}
                  >{s.name}</button>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div className="modal-content-grid">

            {/* Left — CustomFieldValues with nativeFields */}
            <div className="modal-left">
              <div className="form-group">
                <CustomFieldValues
                  entity="lead"
                  entityId={lead.id}
                  showIds={showIds}
                  pipelineId={stages?.[0]?.pipeline_id ?? null}
                  stages={stages ?? []}
                  nativeFields={[
                    {
                      id: 'lead.salutation', name: 'Saudação',
                      renderContent: () => (
                        <select className="form-select" value={form.salutation} onChange={e => set('salutation')(e.target.value)}>
                          <option value="">o campo está vazio</option>
                          {SALUTATIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ),
                    },
                    {
                      id: 'lead.first_name', name: 'Nome',
                      renderContent: () => (
                        <input className="form-input" value={form.first_name} onChange={e => set('first_name')(e.target.value)} placeholder="Nome" />
                      ),
                    },
                    {
                      id: 'lead.last_name', name: 'Sobrenome',
                      renderContent: () => (
                        <input className="form-input" value={form.last_name} onChange={e => set('last_name')(e.target.value)} placeholder="Sobrenome" />
                      ),
                    },
                    {
                      id: 'lead.middle_name', name: 'Nome do meio',
                      renderContent: () => (
                        <input className="form-input" value={form.middle_name} onChange={e => set('middle_name')(e.target.value)} placeholder="Nome do meio" />
                      ),
                    },
                    {
                      id: 'lead.phone', name: 'Telefone',
                      renderContent: () => (
                        <input className="form-input" type="tel" value={form.phone} onChange={e => set('phone')(e.target.value)} placeholder="Telefone" />
                      ),
                    },
                    {
                      id: 'lead.email', name: 'E-mail',
                      renderContent: () => (
                        <input className="form-input" type="email" value={form.email} onChange={e => set('email')(e.target.value)} placeholder="E-mail" />
                      ),
                    },
                    {
                      id: 'lead.website', name: 'Website',
                      renderContent: () => (
                        <input className="form-input" value={form.website} onChange={e => set('website')(e.target.value)} placeholder="https://" />
                      ),
                    },
                    {
                      id: 'lead.birth_date', name: 'Data de nascimento',
                      renderContent: () => (
                        <input className="form-input" type="date" value={form.birth_date} onChange={e => set('birth_date')(e.target.value)} />
                      ),
                    },
                    {
                      id: 'lead.position', name: 'Cargo',
                      renderContent: () => (
                        <input className="form-input" value={form.position} onChange={e => set('position')(e.target.value)} placeholder="Cargo / Posição" />
                      ),
                    },
                    {
                      id: 'lead.company_name', name: 'Empresa',
                      renderContent: () => (
                        <input className="form-input" value={form.company_name} onChange={e => set('company_name')(e.target.value)} placeholder="Nome da empresa" />
                      ),
                    },
                    {
                      id: 'lead.users', name: 'Responsáveis',
                      renderContent: () => (
                        <>
                          <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 4 }}>
                            {selectedUsers.map(u => <ChipUser key={u.id} user={u} onRemove={removeUser} />)}
                          </div>
                          <div style={{ position: 'relative' }}>
                            <input
                              className="form-input"
                              placeholder="Adicionar responsável..."
                              value={userSearch}
                              onChange={e => { setUserSearch(e.target.value); setShowUserDropdown(true); }}
                              onFocus={() => setShowUserDropdown(true)}
                              onBlur={() => setTimeout(() => setShowUserDropdown(false), 150)}
                            />
                            {showUserDropdown && (
                              <div className="contact-dropdown">
                                {allUsers
                                  .filter(u => !selectedUsers.find(s => s.id === u.id) && u.name.toLowerCase().includes(userSearch.toLowerCase()))
                                  .slice(0, 6)
                                  .map(u => (
                                    <div key={u.id} className="contact-dropdown-item" onMouseDown={() => addUser(u)}>
                                      {u.name}
                                      <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>{u.role}</span>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </>
                      ),
                    },
                    {
                      id: 'lead.price', name: 'Valor',
                      renderContent: () => (
                        <div className="price-box">
                          <span className="price-symbol">R$</span>
                          <input type="number" className="price-input" value={form.price}
                            onChange={e => set('price')(e.target.value)} placeholder="0" />
                        </div>
                      ),
                    },
                    {
                      id: 'lead.source', name: 'Fonte',
                      renderContent: () => (
                        <select className="form-select" value={form.source} onChange={e => set('source')(e.target.value)}>
                          <option value="">Selecionar...</option>
                          {SOURCES.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ),
                    },
                    {
                      id: 'lead.source_info', name: 'Informações da fonte',
                      renderContent: () => (
                        <input className="form-input" value={form.source_info} onChange={e => set('source_info')(e.target.value)} placeholder="Detalhes da origem..." />
                      ),
                    },
                    {
                      id: 'lead.available_to_all', name: 'Disponível para todos',
                      renderContent: () => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button type="button" onClick={() => set('available_to_all')(!form.available_to_all)} style={{
                            width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', padding: 0, position: 'relative',
                            background: form.available_to_all ? '#10b981' : '#e2e8f0', transition: 'background 0.2s',
                          }}>
                            <span style={{
                              position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff',
                              transition: 'left 0.2s', left: form.available_to_all ? 19 : 3,
                            }} />
                          </button>
                          <span style={{ fontSize: 13, color: form.available_to_all ? '#10b981' : '#94a3b8' }}>
                            {form.available_to_all ? 'Sim' : 'Não'}
                          </span>
                        </div>
                      ),
                    },
                    {
                      id: 'lead.comment', name: 'Comentário',
                      renderContent: () => (
                        <textarea className="form-textarea" rows={3} value={form.comment}
                          onChange={e => set('comment')(e.target.value)} placeholder="Observações sobre este lead..." />
                      ),
                    },
                    {
                      id: 'lead.address', name: 'Endereço',
                      renderContent: () => (
                        <input className="form-input" value={form.address} onChange={e => set('address')(e.target.value)} placeholder="Endereço" />
                      ),
                    },
                    {
                      id: 'lead.description', name: 'Descrição',
                      renderContent: () => (
                        <textarea className="form-textarea" rows={4} value={form.description}
                          onChange={e => set('description')(e.target.value)} placeholder="Detalhes do lead..." />
                      ),
                    },
                    {
                      id: 'lead.utm', name: 'Parâmetros UTM',
                      renderContent: () => (
                        <div style={{ fontSize: 13, color: '#64748b' }}>
                          {(lead.utm_source || lead.utm_medium || lead.utm_campaign) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {lead.utm_source   && <span>utm_source: <b>{lead.utm_source}</b></span>}
                              {lead.utm_medium   && <span>utm_medium: <b>{lead.utm_medium}</b></span>}
                              {lead.utm_campaign && <span>utm_campaign: <b>{lead.utm_campaign}</b></span>}
                            </div>
                          ) : <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Nenhum</span>}
                        </div>
                      ),
                    },
                    {
                      id: 'lead.id', name: 'ID',
                      renderContent: () => <span style={{ fontSize: 14, color: '#64748b', fontFamily: 'monospace' }}>#{lead.id}</span>,
                    },
                    {
                      id: 'lead.stage', name: 'Etapa',
                      renderContent: () => {
                        const s = stages?.find(st => st.id === form.stage_id);
                        return <span style={{ fontSize: 14, color: '#334155' }}>{s?.name ?? '—'}</span>;
                      },
                    },
                    {
                      id: 'lead.created_at', name: 'Criado em',
                      renderContent: () => <span style={{ fontSize: 14, color: '#64748b' }}>{fmtDate(lead.created_at)}</span>,
                    },
                  ]}
                />
              </div>
            </div>

            {/* Right panel: tabbed */}
            <div className="modal-right">
              {/* Tab header */}
              <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                {[
                  { key: 'activity',  label: 'Atividades' },
                  { key: 'workflows', label: 'Fluxos' },
                  { key: 'history',   label: 'Histórico' },
                ].map(t => (
                  <button key={t.key} onClick={() => { setRightTab(t.key); if (t.key === 'workflows') fetchWorkflows(); }} style={{
                    flex: 1, background: 'none', border: 'none',
                    borderBottom: `2px solid ${rightTab === t.key ? '#6366f1' : 'transparent'}`,
                    color: rightTab === t.key ? '#6366f1' : '#64748b',
                    fontWeight: rightTab === t.key ? 700 : 500,
                    fontSize: 11, padding: '10px 4px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                  }}>{t.label}</button>
                ))}
              </div>

              {/* Activity tab */}
              {rightTab === 'activity' && (
                <>
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
                              }}>{isAuto ? '🤖 ' + (act.actor || 'Sistema') : '👤 ' + (act.actor || 'Usuário')}</span>
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

              {/* Workflows tab */}
              {rightTab === 'workflows' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {workflows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: 13 }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
                      Nenhum fluxo disponível para leads
                    </div>
                  ) : workflows.map(wf => {
                    const msg = workflowMsg[wf.id];
                    return (
                      <div key={wf.id} style={{
                        background: '#f8fafc', border: '1px solid #e2e8f0',
                        borderRadius: 8, padding: '10px 12px',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{wf.name}</div>
                          {msg && (
                            <div style={{ fontSize: 11.5, marginTop: 3, color: msg.status === 'ok' ? '#16a34a' : msg.status === 'error' ? '#dc2626' : '#64748b' }}>
                              {msg.status === 'ok' ? '✓ ' : msg.status === 'error' ? '✕ ' : '⏳ '}{msg.text}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => executeWorkflow(wf.id)}
                          disabled={msg?.status === 'loading'}
                          className="btn btn-primary"
                          style={{ fontSize: 12, padding: '5px 12px', whiteSpace: 'nowrap' }}
                        >
                          {msg?.status === 'loading' ? '…' : '▶ Executar'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* History tab */}
              {rightTab === 'history' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
                    Histórico não disponível para leads
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
