import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useConfirm } from '../App';

import { API_URL as API } from '../config.js';

const STATUSES = [
  { id: 'todo',        label: 'A fazer',      color: '#6366f1', bg: '#eef2ff' },
  { id: 'in_progress', label: 'Em andamento', color: '#f59e0b', bg: '#fffbeb' },
  { id: 'done',        label: 'Concluído',    color: '#10b981', bg: '#f0fdf4' },
];

const PRIORITIES = [
  { id: 'low',    label: 'Baixa',   color: '#94a3b8', icon: '↓' },
  { id: 'normal', label: 'Normal',  color: '#6366f1', icon: '→' },
  { id: 'high',   label: 'Alta',    color: '#ef4444', icon: '↑' },
  { id: 'urgent', label: 'Urgente', color: '#dc2626', icon: '‼' },
];

function fmtSeconds(s) {
  if (!s) return '0m';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function relTime(iso) {
  if (!iso) return '';
  const d = new Date(iso.includes('+') || iso.endsWith('Z') ? iso : iso + 'Z');
  const diff = Math.floor((new Date() - d) / 60000);
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diff < 1) return 'agora';
  if (diff < 60) return `há ${diff} min`;
  if (diff < 1440) return `hoje ${hm}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + hm;
}

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('nexus_token')}` });

// ── Smart entity picker ────────────────────────────────────────────────────────
function EntityPicker({ type, value, onChange, onOpen, pipelines }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [stages, setStages] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState(null); // the currently linked entity object
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const endpoint = type === 'card' ? 'cards' : 'leads';
  const entityLabel = type === 'card' ? 'negócio' : 'lead';

  // Load the currently linked entity name on mount
  useEffect(() => {
    if (!value) { setLinked(null); return; }
    fetch(`${API}/${endpoint}/${value}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => setLinked(d))
      .catch(() => setLinked({ id: value, title: `#${value}` }));
  }, [value, endpoint]);

  // Load stages when pipeline changes
  useEffect(() => {
    if (!pipelineId) { setStages([]); setStageId(''); return; }
    fetch(`${API}/stages?pipeline_id=${pipelineId}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => setStages(Array.isArray(d) ? d : []))
      .catch(() => setStages([]));
  }, [pipelineId]);

  const search = useCallback((q, pid, sid) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: 15 });
    if (q) params.set('q', q);
    if (pid) params.set('pipeline_id', pid);
    if (sid) params.set('stage_id', sid);
    fetch(`${API}/${endpoint}?${params}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => setResults(Array.isArray(d) ? d : []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [endpoint]);

  // Open picker: load initial results
  const handleOpen = () => {
    setOpen(true);
    setQuery('');
    search('', pipelineId, stageId);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleQueryChange = (v) => {
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v, pipelineId, stageId), 250);
  };

  const handlePipelineChange = (pid) => {
    setPipelineId(pid);
    setStageId('');
    search(query, pid, '');
  };

  const handleStageChange = (sid) => {
    setStageId(sid);
    search(query, pipelineId, sid);
  };

  const handleSelect = (item) => {
    onChange(item.id);
    setLinked(item);
    setOpen(false);
  };

  const getItemLabel = (item) => {
    if (type === 'lead') return item.title || `${item.first_name || ''} ${item.last_name || ''}`.trim() || `#${item.id}`;
    return item.title || `#${item.id}`;
  };

  // Linked chip
  if (!open) {
    return (
      <div>
        {linked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', border: '1.5px solid #6366f1', borderRadius: 8, background: '#eef2ff' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', background: '#c7d2fe', borderRadius: 4, padding: '1px 5px' }}>#{linked.id}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getItemLabel(linked)}
            </span>
            {onOpen && (
              <button onClick={() => onOpen(linked.id)} title={`Abrir ${entityLabel}`} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: 14, padding: '0 2px', flexShrink: 0,
              }}>↗</button>
            )}
            <button onClick={() => { onChange(''); setLinked(null); }} title="Desvincular" style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, padding: '0 2px', flexShrink: 0, lineHeight: 1,
            }}>×</button>
            <button onClick={handleOpen} title="Trocar" style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, padding: '0 4px', flexShrink: 0, textDecoration: 'underline',
            }}>trocar</button>
          </div>
        ) : (
          <button onClick={handleOpen} style={{
            width: '100%', textAlign: 'left', padding: '7px 10px', border: '1px dashed #cbd5e1',
            borderRadius: 8, fontSize: 13, color: '#94a3b8', cursor: 'pointer', background: 'white', fontFamily: 'inherit',
          }}>
            + Vincular {entityLabel}...
          </button>
        )}
      </div>
    );
  }

  // Picker dropdown
  return (
    <div style={{ border: '1.5px solid #6366f1', borderRadius: 10, background: 'white', overflow: 'hidden' }}>
      {/* Search bar */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 6 }}>
        <input
          ref={inputRef}
          style={{ flex: 1, padding: '5px 9px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
          placeholder={`Buscar por nome ou #ID...`}
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
        />
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, padding: '0 4px', lineHeight: 1 }}>×</button>
      </div>

      {/* Pipeline / Stage filter */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 6 }}>
        <select style={{ flex: 1, padding: '4px 7px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, fontFamily: 'inherit', color: '#475569', background: 'white' }}
          value={pipelineId} onChange={e => handlePipelineChange(e.target.value)}>
          <option value="">Todos os pipelines</option>
          {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {stages.length > 0 && (
          <select style={{ flex: 1, padding: '4px 7px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, fontFamily: 'inherit', color: '#475569', background: 'white' }}
            value={stageId} onChange={e => handleStageChange(e.target.value)}>
            <option value="">Todas as etapas</option>
            {stages.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Results */}
      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '12px 10px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Buscando...</div>
        ) : results.length === 0 ? (
          <div style={{ padding: '12px 10px', fontSize: 12, color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>Nenhum resultado</div>
        ) : results.map(item => (
          <button key={item.id} onClick={() => handleSelect(item)} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
            padding: '8px 10px', border: 'none', borderBottom: '1px solid #f8fafc',
            background: 'white', cursor: 'pointer', fontFamily: 'inherit',
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>#{item.id}</span>
            <span style={{ flex: 1, fontSize: 12, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getItemLabel(item)}</span>
            {item.stage_id && stages.find(s => s.id === item.stage_id) && (
              <span style={{ fontSize: 10, color: '#64748b', background: '#f1f5f9', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>
                {stages.find(s => s.id === item.stage_id)?.name}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TaskModal({ task: initialTask, onClose, onSave, onDelete, defaultProjectId, onOpenCard, onOpenLead }) {
  const confirm = useConfirm();
  const isNew = !initialTask.id || initialTask.isNew;

  const [title, setTitle]       = useState(initialTask.title || '');
  const [description, setDesc]  = useState(initialTask.description || '');
  const [status, setStatus]     = useState(initialTask.status || 'todo');
  const [priority, setPriority] = useState(initialTask.priority || 'normal');
  const [dueDate, setDueDate]   = useState(initialTask.due_date || '');
  const [assignedTo, setAssigned] = useState(initialTask.assigned_to || '');
  const [cardId, setCardId]     = useState(initialTask.card_id || '');
  const [leadId, setLeadId]     = useState(initialTask.lead_id || '');
  const [projectId, setProjectId] = useState(initialTask.project_id || defaultProjectId || '');
  const [saving, setSaving]     = useState(false);

  const [allUsers, setAllUsers] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [notes, setNotes]       = useState([]);
  const [newNote, setNewNote]   = useState('');
  const [timeEntries, setTimeEntries] = useState(initialTask.time_entries || []);
  const [totalTime, setTotalTime] = useState(initialTask.total_time_seconds || 0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDisplay, setTimerDisplay] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const open = (initialTask.time_entries || []).find(e => !e.ended_at && e.started_at);
    if (open) {
      setTimerRunning(true);
      const elapsed = Math.floor((Date.now() - new Date(open.started_at + (open.started_at.includes('Z') ? '' : 'Z')).getTime()) / 1000);
      setTimerDisplay(elapsed);
    }
  }, []);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerDisplay(prev => prev + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/users`, { headers: authHeader() }).then(r => r.json()).catch(() => []),
      fetch(`${API}/projects`, { headers: authHeader() }).then(r => r.json()).catch(() => []),
      fetch(`${API}/pipelines`, { headers: authHeader() }).then(r => r.json()).catch(() => []),
    ]).then(([users, projects, pips]) => {
      setAllUsers(Array.isArray(users) ? users : []);
      setAllProjects(Array.isArray(projects) ? projects : []);
      setPipelines(Array.isArray(pips) ? pips : []);
    });

    if (!isNew) {
      fetch(`${API}/tasks/${initialTask.id}`, { headers: authHeader() })
        .then(r => r.json())
        .then(t => {
          setTimeEntries(t.time_entries || []);
          setTotalTime(t.total_time_seconds || 0);
        })
        .catch(() => {});
    }
  }, [initialTask.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: title.trim() || 'Sem título',
        description,
        status,
        priority,
        due_date: dueDate || null,
        assigned_to: assignedTo,
        card_id: cardId ? parseInt(cardId) : null,
        lead_id: leadId ? parseInt(leadId) : null,
        project_id: projectId ? parseInt(projectId) : null,
        done: status === 'done',
        participants: '[]',
      };
      let updated;
      if (isNew) {
        updated = await fetch(`${API}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify(payload),
        }).then(r => r.json());
      } else {
        updated = await fetch(`${API}/tasks/${initialTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify(payload),
        }).then(r => r.json());
      }
      onSave(updated);
      onClose();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!await confirm(`Excluir a tarefa "${initialTask.title}"?`, 'Esta ação não pode ser desfeita.')) return;
    await fetch(`${API}/tasks/${initialTask.id}`, { method: 'DELETE', headers: authHeader() });
    onDelete(initialTask.id);
    onClose();
  };

  const handleStartTimer = async () => {
    const userName = allUsers.find(u => u.name === assignedTo)?.name || assignedTo || 'Usuário';
    await fetch(`${API}/tasks/${initialTask.id}/time/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ user_name: userName }),
    });
    setTimerRunning(true);
    setTimerDisplay(0);
  };

  const handleStopTimer = async () => {
    const result = await fetch(`${API}/tasks/${initialTask.id}/time/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
    }).then(r => r.json());
    setTimerRunning(false);
    setTimerDisplay(0);
    setTimeEntries(result.time_entries || []);
    setTotalTime(result.total_time_seconds || 0);
  };

  const postNote = async (e) => {
    if (e.key !== 'Enter' || !newNote.trim()) return;
    const note = { id: Date.now(), type: 'note', content: newNote.trim(), actor: 'Usuário', created_at: new Date().toISOString() };
    setNotes(prev => [note, ...prev]);
    setNewNote('');
  };

  const isOverdue = dueDate && status !== 'done' && new Date(dueDate) < new Date();

  const Lbl = ({ children }) => (
    <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
      {children}
    </label>
  );

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ width: 'min(1100px, 96vw)', maxHeight: '94vh', background: 'white', borderRadius: 16, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {!isNew && (
              <code style={{ fontSize: 12, background: '#1e293b', color: '#f59e0b', padding: '3px 10px', borderRadius: 5, fontWeight: 700 }}>
                {initialTask.uid || `#${initialTask.id}`}
              </code>
            )}
            <div style={{ display: 'flex', gap: 5 }}>
              {PRIORITIES.map(p => (
                <button key={p.id} onClick={() => setPriority(p.id)} title={p.label}
                  style={{ padding: '4px 10px', borderRadius: 6, border: `1.5px solid ${priority === p.id ? p.color : '#e2e8f0'}`, background: priority === p.id ? p.color + '15' : 'white', color: priority === p.id ? p.color : '#94a3b8', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}>
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {isOverdue && <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '3px 10px', borderRadius: 6, border: '1px solid #fecaca' }}>⚠ Atrasado</span>}
              {!isNew && <button onClick={handleDelete} className="btn btn-danger" style={{ fontSize: 13 }}>Excluir</button>}
              <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ fontSize: 13 }}>
                {saving ? 'Salvando...' : isNew ? 'Criar tarefa' : 'Salvar'}
              </button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 22, lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>
          </div>

          <input
            style={{ width: '100%', fontSize: 22, fontWeight: 700, color: '#0f172a', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', boxSizing: 'border-box' }}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título da tarefa..."
            autoFocus={isNew}
          />

          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {STATUSES.map(s => (
              <button key={s.id} onClick={() => setStatus(s.id)}
                style={{ padding: '5px 16px', borderRadius: 20, border: `1.5px solid ${status === s.id ? s.color : '#e2e8f0'}`, background: status === s.id ? s.color : 'white', color: status === s.id ? 'white' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Left: form */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div>
              <Lbl>Descrição</Lbl>
              <textarea
                style={{ width: '100%', minHeight: 90, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#334155', fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
                value={description}
                onChange={e => setDesc(e.target.value)}
                placeholder="Detalhes, contexto, critérios de conclusão..."
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Lbl>📅 Prazo</Lbl>
                <input type="date"
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${isOverdue ? '#fecaca' : '#e2e8f0'}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: isOverdue ? '#ef4444' : '#334155', boxSizing: 'border-box' }}
                  value={dueDate} onChange={e => setDueDate(e.target.value)}
                />
                {isOverdue && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>Prazo vencido</div>}
              </div>
              <div>
                <Lbl>👤 Responsável</Lbl>
                {allUsers.length > 0 ? (
                  <select style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#334155', background: 'white', cursor: 'pointer', boxSizing: 'border-box' }}
                    value={assignedTo} onChange={e => setAssigned(e.target.value)}>
                    <option value="">Sem responsável</option>
                    {allUsers.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                  </select>
                ) : (
                  <input style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#334155', boxSizing: 'border-box' }}
                    value={assignedTo} onChange={e => setAssigned(e.target.value)} placeholder="Nome do responsável..." />
                )}
              </div>
            </div>

            {/* Project */}
            <div>
              <Lbl>📁 Projeto</Lbl>
              <select style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#334155', background: 'white', cursor: 'pointer', boxSizing: 'border-box' }}
                value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">Nenhum</option>
                {allProjects.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
              </select>
            </div>

            {/* Deal picker */}
            <div>
              <Lbl>📋 Negócio vinculado</Lbl>
              <EntityPicker
                type="card"
                value={cardId}
                onChange={setCardId}
                onOpen={onOpenCard}
                pipelines={pipelines}
              />
            </div>

            {/* Lead picker */}
            <div>
              <Lbl>👤 Lead vinculado</Lbl>
              <EntityPicker
                type="lead"
                value={leadId}
                onChange={setLeadId}
                onOpen={onOpenLead}
                pipelines={pipelines}
              />
            </div>

            {/* Time tracking */}
            {!isNew && (
              <div style={{ background: '#0f172a', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                  ⏱ Rastreamento de tempo
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 22, color: timerRunning ? '#10b981' : '#f8fafc', fontWeight: 800, minWidth: 80, textAlign: 'center' }}>
                    {timerRunning ? fmtSeconds(timerDisplay) : fmtSeconds(totalTime)}
                  </div>
                  <div style={{ flex: 1 }}>
                    {timerRunning ? (
                      <button onClick={handleStopTimer}
                        style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#ef4444', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                        ■ Pausar
                      </button>
                    ) : (
                      <button onClick={handleStartTimer}
                        style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#10b981', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                        ▶ Iniciar
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>
                    Total acumulado<br />
                    <span style={{ fontSize: 14, color: '#f8fafc', fontWeight: 700 }}>{fmtSeconds(totalTime)}</span>
                  </div>
                </div>

                {timeEntries.length > 0 && (
                  <div style={{ borderTop: '1px solid #1e293b', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
                    {timeEntries.slice().reverse().map((e, i) => (
                      <div key={e.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#64748b' }}>
                        <span style={{ color: e.ended_at ? '#94a3b8' : '#10b981', fontWeight: 700 }}>{e.ended_at ? '■' : '▶'}</span>
                        <span>{e.user_name || 'Usuário'}</span>
                        <span style={{ marginLeft: 'auto', color: '#f59e0b', fontWeight: 700 }}>{fmtSeconds(e.duration_seconds || 0)}</span>
                        <span>{e.started_at ? new Date(e.started_at + (e.started_at.includes('Z') ? '' : 'Z')).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isNew && (
              <div style={{ background: '#1e293b', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Identificadores</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#64748b' }}>UID</span>
                  <code style={{ fontSize: 14, color: '#f59e0b', fontWeight: 800 }}>{initialTask.uid || '—'}</code>
                  <span style={{ fontSize: 9, color: '#64748b' }}>ID</span>
                  <code style={{ fontSize: 11, color: '#a78bfa' }}>#{initialTask.id}</code>
                </div>
              </div>
            )}
          </div>

          {/* Right: notes */}
          <div style={{ width: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fafafa' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
              Notas
            </div>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              <input
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                placeholder="Adicionar nota... (Enter)"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                onKeyDown={postNote}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {notes.length === 0 && (
                <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '16px 0', fontStyle: 'italic' }}>Sem notas</div>
              )}
              {notes.map((n, i) => (
                <div key={n.id ?? i} style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.content}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{relTime(n.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
