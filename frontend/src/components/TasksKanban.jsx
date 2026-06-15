import React, { useState, useEffect, useCallback, useRef } from 'react';
import TaskModal from './TaskModal';

const API = 'http://localhost:8001';

// Deadline-based columns (like Bitrix planner view)
const COLUMNS = [
  { id: 'overdue',    label: 'Vencido',          color: '#ef4444', bg: '#fef2f2',   check: (due, today) => due && due < today },
  { id: 'today',     label: 'Vence hoje',        color: '#f59e0b', bg: '#fffbeb',   check: (due, today) => due && due === today },
  { id: 'week',      label: 'Esta semana',       color: '#6366f1', bg: '#eef2ff',   check: (due, today, w1, w2) => due && due > today && due <= w1 },
  { id: 'next_week', label: 'Próxima semana',    color: '#8b5cf6', bg: '#f5f3ff',   check: (due, today, w1, w2) => due && due > w1 && due <= w2 },
  { id: 'later',     label: 'Em 2 semanas+',     color: '#3b82f6', bg: '#eff6ff',   check: (due, today, w1, w2) => due && due > w2 },
  { id: 'no_date',   label: 'Sem prazo',         color: '#94a3b8', bg: '#f8fafc',   check: (due) => !due },
  { id: 'done',      label: 'Concluídas',        color: '#10b981', bg: '#f0fdf4',   check: () => false },
];

const PRIORITY_META = {
  low:    { label: 'Baixa',   color: '#94a3b8', icon: '↓' },
  normal: { label: 'Normal',  color: '#6366f1', icon: '→' },
  high:   { label: 'Alta',    color: '#ef4444', icon: '↑' },
  urgent: { label: 'Urgente', color: '#dc2626', icon: '‼' },
};

function toISO(d) { return d.toISOString().split('T')[0]; }

function getDateBuckets() {
  const today = new Date(); today.setHours(0,0,0,0);
  const w1 = new Date(today); w1.setDate(today.getDate() + 7);
  const w2 = new Date(today); w2.setDate(today.getDate() + 14);
  return { today: toISO(today), w1: toISO(w1), w2: toISO(w2) };
}

function getColumnId(task) {
  if (task.status === 'done' || task.done) return 'done';
  const { today, w1, w2 } = getDateBuckets();
  const due = task.due_date;
  if (!due) return 'no_date';
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  if (due <= w1) return 'week';
  if (due <= w2) return 'next_week';
  return 'later';
}

function fmtDateShort(d) {
  if (!d) return null;
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function fmtSeconds(s) {
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const avatarColors = ['#6366f1','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ec4899'];
function nameColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return avatarColors[Math.abs(h) % avatarColors.length];
}
function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onDragStart, onClick }) {
  const col = COLUMNS.find(c => c.id === getColumnId(task)) || COLUMNS[5];
  const prio = PRIORITY_META[task.priority] || PRIORITY_META.normal;
  const isOverdue = getColumnId(task) === 'overdue';
  const hasTimer = task.time_entries?.some(e => !e.ended_at && e.started_at);

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task)}
      onClick={() => onClick(task)}
      onMouseDown={e => { if (e.button === 1) { e.preventDefault(); window.open(`${location.origin}${location.pathname}#tasks/${task.id}`, '_blank'); } }}
      style={{
        background: 'white',
        border: `1.5px solid ${isOverdue ? '#fecaca' : '#e2e8f0'}`,
        borderLeft: `3px solid ${prio.color}`,
        borderRadius: 10,
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'all 0.12s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        userSelect: 'none',
        position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = ''; }}
    >
      {/* UID + priority */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <code style={{ fontSize: 9, color: '#94a3b8', background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>
          {task.uid || `#${task.id}`}
        </code>
        <span style={{ fontSize: 9, color: prio.color, fontWeight: 700 }}>{prio.icon} {prio.label}</span>
        {hasTimer && (
          <span style={{ marginLeft: 'auto', fontSize: 9, color: '#10b981', fontWeight: 700, background: '#f0fdf4', padding: '1px 5px', borderRadius: 3 }}>
            ▶ Running
          </span>
        )}
        {!hasTimer && isOverdue && (
          <span style={{ marginLeft: 'auto', fontSize: 9, color: '#ef4444', fontWeight: 700 }}>⚠ Vencido</span>
        )}
      </div>

      {/* Title */}
      <div style={{
        fontSize: 13, fontWeight: 600, color: task.status === 'done' ? '#94a3b8' : '#0f172a',
        textDecoration: task.status === 'done' ? 'line-through' : 'none',
        lineHeight: 1.4, marginBottom: 6, wordBreak: 'break-word',
      }}>
        {task.title}
      </div>

      {/* Linked entity */}
      {(task.card_title || task.lead_title || task.project_name) && (
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
          {task.project_name && <span style={{ color: task.project_name ? '#6366f1' : undefined }}>📁 {task.project_name}</span>}
          {task.card_title && <span style={{ color: '#10b981' }}>📋 {task.card_title}</span>}
          {task.lead_title && <span style={{ color: '#f59e0b' }}>👤 {task.lead_title}</span>}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        {task.assigned_to && (
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            background: nameColor(task.assigned_to), color: 'white',
            fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} title={task.assigned_to}>{initials(task.assigned_to)}</div>
        )}
        {task.due_date && (
          <span style={{ fontSize: 10, color: isOverdue ? '#ef4444' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 2 }}>
            📅 {fmtDateShort(task.due_date)}
          </span>
        )}
        {task.total_time_seconds > 0 && (
          <span style={{ fontSize: 10, color: '#64748b', marginLeft: 'auto' }}>
            ⏱ {fmtSeconds(task.total_time_seconds)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────
function TaskColumn({ col, tasks, onDragStart, onDrop, onClickTask, onCreateTask, collapsed, onToggleCollapse }) {
  const [dragOver, setDragOver] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await onCreateTask(col.id, newTitle.trim());
    setNewTitle(''); setAdding(false);
  };

  return (
    <div
      style={{
        width: collapsed ? 48 : 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: dragOver ? col.bg : (col.id === 'done' ? '#f8fafc' : col.bg + '80'),
        borderRadius: 14,
        border: `2px solid ${dragOver ? col.color : (col.id === 'done' ? '#e2e8f0' : col.color + '30')}`,
        transition: 'all 0.15s',
        minHeight: 200,
        overflow: 'hidden',
      }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragEnter={e => e.preventDefault()}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(e, col.id); }}
    >
      {/* Header */}
      <div
        style={{ padding: collapsed ? '14px 8px' : '14px 14px 10px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'pointer', flexDirection: collapsed ? 'column' : 'row' }}
        onClick={() => onToggleCollapse(col.id)}
      >
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
        {!collapsed && (
          <>
            <span style={{ fontWeight: 700, fontSize: 12, color: '#0f172a', flex: 1, whiteSpace: 'nowrap' }}>{col.label}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, minWidth: 22, height: 22, borderRadius: 11,
              background: tasks.length ? col.color : '#e2e8f0', color: tasks.length ? 'white' : '#94a3b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', flexShrink: 0,
            }}>{tasks.length}</span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>‹</span>
          </>
        )}
        {collapsed && (
          <span style={{
            fontSize: 11, fontWeight: 700, minWidth: 22, height: 22, borderRadius: 11,
            background: tasks.length ? col.color : '#e2e8f0', color: tasks.length ? 'white' : '#94a3b8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{tasks.length}</span>
        )}
      </div>

      {!collapsed && (
        <>
          <div style={{ flex: 1, padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
            {tasks.length === 0 && !dragOver && !adding && (
              <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 11, color: '#cbd5e1', fontStyle: 'italic' }}>
                {col.id === 'done' ? 'Nenhuma concluída' : 'Sem tarefas'}
              </div>
            )}
            {tasks.map(t => (
              <TaskCard key={t.id} task={t} onDragStart={onDragStart} onClick={onClickTask} />
            ))}
            {adding && (
              <div style={{ background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  ref={inputRef}
                  style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                  placeholder="Título da tarefa..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setAdding(false); setNewTitle(''); } }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handleCreate} disabled={!newTitle.trim()} style={{ flex: 1, padding: '6px', borderRadius: 7, border: 'none', background: col.color, color: 'white', fontSize: 12, fontWeight: 600, cursor: newTitle.trim() ? 'pointer' : 'default', fontFamily: 'inherit', opacity: newTitle.trim() ? 1 : 0.5 }}>Criar</button>
                  <button onClick={() => { setAdding(false); setNewTitle(''); }} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 12, color: '#64748b', fontFamily: 'inherit' }}>✕</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: '10px', flexShrink: 0 }}>
            {!adding && col.id !== 'done' && (
              <button
                onClick={() => setAdding(true)}
                style={{ width: '100%', padding: '7px', border: `1.5px dashed ${col.color}60`, borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 11, color: col.color, fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.12s' }}
                onMouseEnter={e => { e.currentTarget.style.background = col.bg; e.currentTarget.style.borderStyle = 'solid'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderStyle = 'dashed'; }}
              >
                + Tarefa
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TasksKanban({ projectId = null }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filterAssignee, setFilter] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [collapsed, setCollapsed] = useState({ done: true });
  const [newTaskModal, setNewTaskModal] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const qs = projectId ? `?project_id=${projectId}` : '';
      const data = await fetch(`${API}/tasks${qs}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexus_token')}` }
      }).then(r => r.json());
      const list = Array.isArray(data) ? data : [];
      setTasks(list);
      // Auto-open from URL hash
      const m = window.location.hash.replace(/^#/, '').match(/^tasks\/(\d+)$/);
      if (m) {
        const found = list.find(t => t.id === parseInt(m[1]));
        if (found) setSelectedTask(found);
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('taskId', String(task.id));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e, colId) => {
    const taskId = parseInt(e.dataTransfer.getData('taskId'));
    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Map colId to status + due_date changes
    let newStatus = task.status;
    let newDue = task.due_date;

    if (colId === 'done') { newStatus = 'done'; }
    else if (colId === 'no_date') { newStatus = task.status === 'done' ? 'todo' : task.status; newDue = null; }
    else {
      newStatus = task.status === 'done' ? 'todo' : task.status;
      const { today, w1, w2 } = getDateBuckets();
      if (colId === 'overdue') newDue = null; // can't drag to overdue
      else if (colId === 'today') newDue = today;
      else if (colId === 'week') newDue = w1;
      else if (colId === 'next_week') newDue = w2;
      else if (colId === 'later') { const d = new Date(); d.setDate(d.getDate()+21); newDue = toISO(d); }
    }

    if (colId === 'overdue') return; // can't drag into overdue

    // Optimistic
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, due_date: newDue, done: newStatus === 'done' } : t));
    await fetch(`${API}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('nexus_token')}` },
      body: JSON.stringify({ ...task, status: newStatus, due_date: newDue, done: newStatus === 'done' }),
    });
  };

  const handleCreate = async (colId, title) => {
    const { today, w1, w2 } = getDateBuckets();
    let due = null;
    if (colId === 'today') due = today;
    else if (colId === 'week') due = w1;
    else if (colId === 'next_week') due = w2;
    const payload = { title, status: 'todo', priority: 'normal', due_date: due, project_id: projectId || null };
    const created = await fetch(`${API}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('nexus_token')}` },
      body: JSON.stringify(payload),
    }).then(r => r.json());
    setTasks(prev => [...prev, created]);
  };

  const handleSaveTask = (updated) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    setSelectedTask(updated);
  };

  const handleDeleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setSelectedTask(null);
  };

  const toggleCollapse = (colId) => setCollapsed(prev => ({ ...prev, [colId]: !prev[colId] }));

  // Filters
  const assignees = [...new Set(tasks.map(t => t.assigned_to).filter(Boolean))].sort();
  let filtered = tasks;
  if (filterAssignee) filtered = filtered.filter(t => t.assigned_to === filterAssignee);
  if (filterPriority) filtered = filtered.filter(t => t.priority === filterPriority);

  const byCol = (id) => filtered.filter(t => getColumnId(t) === id);

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done' || t.done).length;
  const overdue = tasks.filter(t => getColumnId(t) === 'overdue').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f1f5f9' }}>

      {/* Header */}
      <div style={{ padding: '12px 20px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
            {projectId ? '📁 Tarefas do Projeto' : '☑ Tarefas'}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
            {total} tarefa{total !== 1 ? 's' : ''}
            {overdue > 0 && <span style={{ color: '#ef4444', fontWeight: 700 }}> · {overdue} vencida{overdue !== 1 ? 's' : ''}</span>}
            {' · '}{done} concluída{done !== 1 ? 's' : ''}
          </div>
        </div>

        {total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 100, height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#10b981', borderRadius: 3, transition: 'width 0.4s' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', minWidth: 28 }}>{pct}%</span>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {assignees.length > 0 && (
            <select value={filterAssignee} onChange={e => setFilter(e.target.value)}
              style={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 7, padding: '4px 8px', background: 'white', color: '#334155', fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}>
              <option value="">Todos responsáveis</option>
              {assignees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            style={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 7, padding: '4px 8px', background: 'white', color: '#334155', fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}>
            <option value="">Todas prioridades</option>
            {Object.entries(PRIORITY_META).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <button onClick={() => setSelectedTask({ id: 0, isNew: true, title: '', status: 'todo', priority: 'normal', project_id: projectId })}
            style={{ padding: '5px 14px', borderRadius: 8, border: 'none', background: '#10b981', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Nova tarefa
          </button>
          <button onClick={fetchTasks}
            style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: '#64748b', fontFamily: 'inherit' }}>
            ↻
          </button>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
          Carregando tarefas...
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', gap: 12, padding: '16px 20px', overflowX: 'auto', overflowY: 'hidden', alignItems: 'stretch' }}>
          {COLUMNS.map(col => (
            <TaskColumn
              key={col.id}
              col={col}
              tasks={byCol(col.id)}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onClickTask={(t) => { setSelectedTask(t); if (!projectId) window.history.replaceState(null, '', `#tasks/${t.id}`); }}
              onCreateTask={handleCreate}
              collapsed={!!collapsed[col.id]}
              onToggleCollapse={toggleCollapse}
            />
          ))}
        </div>
      )}

      {/* Task modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => { setSelectedTask(null); if (!projectId) window.history.replaceState(null, '', '#tasks'); }}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          defaultProjectId={projectId}
        />
      )}
    </div>
  );
}
