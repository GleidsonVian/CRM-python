// v2 — Slate & Emerald palette
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import LoginPage from './components/LoginPage';
import KanbanColumn from './components/KanbanColumn';
import CardModal from './components/CardModal';
import LeadModal, { LeadConvertModal } from './components/LeadModal';
import ContactsView from './components/ContactsView';
import CompaniesView from './components/CompaniesView';
import UsersView from './components/UsersView';
import RolesView from './components/RolesView';
import WebhooksView from './components/WebhooksView';
import ListView from './components/ListView';
import FilterBar from './components/FilterBar';
import AutomationsView from './components/AutomationsView';
import WorkflowsView from './components/WorkflowsView';
import CustomFieldsManager from './components/CustomFieldsManager';
import ReportsView from './components/ReportsView';
import AuditLogView from './components/AuditLogView';
import ImportLeadsModal from './components/ImportLeadsModal';
import TasksKanban from './components/TasksKanban';
import ProjectsView from './components/ProjectsView';
import NotificationBell from './components/NotificationBell';
import SearchModal, { useSearchShortcut } from './components/SearchModal';
import StageRequiredModal from './components/StageRequiredModal';
import './index.css';

const API = 'http://localhost:8001';

// ── Toast ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts, onRemove }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          pointerEvents: 'auto',
          display: 'flex', alignItems: 'flex-start', gap: 12,
          background: t.type === 'success' ? '#0f172a' : '#7f1d1d',
          color: '#f8fafc', borderRadius: 10, padding: '14px 18px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
          minWidth: 260, maxWidth: 380, fontSize: 13.5,
          animation: 'toastIn 0.22s ease',
        }}>
          <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>
            {t.type === 'success' ? '✓' : '✕'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: t.body ? 4 : 0 }}>{t.title}</div>
            {t.body && <div style={{ color: '#94a3b8', fontSize: 12.5 }}>{t.body}</div>}
          </div>
          <button onClick={() => onRemove(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#64748b', fontSize: 16, lineHeight: 1, padding: 0, marginTop: 1,
          }}>×</button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = (title, body = '', type = 'success', duration = 4000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, body, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));
  return { toasts, toast, removeToast };
}

// ── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ message, detail, confirmLabel = 'Excluir', confirmDanger = true, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" style={{ zIndex: 1200, justifyContent: 'center', alignItems: 'center' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card, white)', borderRadius: 12, padding: '28px 32px',
        width: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: detail ? 10 : 20 }}>
          {message}
        </div>
        {detail && (
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>{detail}</div>
        )}
        {!detail && <div style={{ marginBottom: 8 }} />}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onCancel}>Cancelar</button>
          <button
            className="btn btn-primary"
            style={{ fontSize: 13, ...(confirmDanger ? { background: '#ef4444', borderColor: '#ef4444' } : {}) }}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const ConfirmContext = React.createContext(null);

function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const confirm = (message, detail = '', confirmLabel = 'Excluir', confirmDanger = true) =>
    new Promise(resolve => {
      setDialog({ message, detail, confirmLabel, confirmDanger, resolve });
    });
  const handleResolve = (val) => { dialog?.resolve(val); setDialog(null); };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <ConfirmDialog
          message={dialog.message}
          detail={dialog.detail}
          confirmLabel={dialog.confirmLabel}
          confirmDanger={dialog.confirmDanger}
          onConfirm={() => handleResolve(true)}
          onCancel={() => handleResolve(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

const useConfirm = () => React.useContext(ConfirmContext);

const IconBoard = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="1.5" y="1.5" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="8.5" y="1.5" width="5" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="8.5" y="10.5" width="5" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);

const IconContacts = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M2 13a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IconWebhook = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M2 7.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M7.5 4v3.5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M1 7.5h2M12 7.5h2M7.5 1v2M7.5 12v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IconCompany = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="1.5" y="5" width="12" height="8.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M5 13.5V10h5v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M4 5V3a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="3.5" y="7" width="2" height="2" rx="0.3" fill="currentColor"/>
    <rect x="9.5" y="7" width="2" height="2" rx="0.3" fill="currentColor"/>
  </svg>
);

const IconUsers = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="10" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M1 12.5a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M9 12.5a4 4 0 0 1 5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IconTasks = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="1.5" y="1.5" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 7.5l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="1.5" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M5 1v3M10 1v3M1.5 6.5h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M9 1.5l2.5 2.5-7 7H2v-2.5l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M2 3.5h9M5 3.5V2h3v1.5M4 3.5l.5 7h4l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconKanban = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="3.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    <rect x="5.25" y="1" width="3.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    <rect x="9.5" y="1" width="3.5" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);

const IconList = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3 3.5h8M3 7h8M3 10.5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="1.5" cy="3.5" r="0.7" fill="currentColor"/>
    <circle cx="1.5" cy="7" r="0.7" fill="currentColor"/>
    <circle cx="1.5" cy="10.5" r="0.7" fill="currentColor"/>
  </svg>
);

const IconBolt = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M7.5 1L2 7.5h4.5L5.5 12l6-7H7L7.5 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
);

export { useConfirm };

function UserChip() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = (user.user_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px', margin: '2px 6px',
      borderRadius: 8, background: 'rgba(99,102,241,0.08)',
      border: '1px solid rgba(99,102,241,0.18)',
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: 'linear-gradient(135deg,#6366f1,#818cf8)',
        color: '#fff', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 10, fontWeight: 700,
        flexShrink: 0,
      }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.user_name}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
          {user.role}
        </div>
      </div>
      <button
        title="Sair"
        onClick={logout}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: 2, borderRadius: 4,
          display: 'flex', alignItems: 'center', flexShrink: 0,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <path d="M9 9.5l2.5-3L9 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M11.5 6.5H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

function MiniCard({ card, stages, onClick, showOnCardFields }) {
  const stage = stages.find(s => s.id === card.stage_id);
  const stageColor = stage?.color || '#94a3b8';
  const price = card.price || 0;
  const contacts = card.contacts || [];
  const tasks = card.tasks || [];
  const pendingTasks = tasks.filter(t => !t.done).length;

  function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

  return (
    <div
      onClick={onClick}
      style={{
        background: 'white', borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
        border: '1px solid #e2e8f0', transition: 'background 0.12s',
        fontSize: 12,
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
      onMouseLeave={e => e.currentTarget.style.background = 'white'}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: stageColor, flexShrink: 0 }} />
        <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.title}
        </div>
      </div>

      {/* Value row */}
      {price > 0 && (
        <div style={{ marginBottom: 5 }}>
          <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(price)}
          </span>
        </div>
      )}

      {/* Stage badge */}
      {stage && (
        <div style={{ marginBottom: 6 }}>
          <span style={{
            background: stageColor + '26', color: stageColor,
            borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600,
          }}>
            {stage.name}
          </span>
        </div>
      )}

      {/* Bottom row: contacts + tasks */}
      {(contacts.length > 0 || pendingTasks > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div style={{ display: 'flex' }}>
            {contacts.slice(0, 2).map((c, i) => (
              <div key={c.id || i} title={c.name} style={{
                width: 22, height: 22, borderRadius: '50%', background: '#6366f1',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, border: '2px solid white',
                marginLeft: i > 0 ? -6 : 0,
              }}>
                {initials(c.name)}
              </div>
            ))}
          </div>
          {pendingTasks > 0 && (
            <span style={{ marginLeft: 'auto', background: '#fef3c7', color: '#d97706', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
              {pendingTasks} tarefa{pendingTasks !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function UserKanban({ cards, stages, users, onOpenCard, showOnCardFields, isLead }) {
  function avatarColor(name) {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

  // Build groups: each user gets a column; unassigned cards go to "Sem responsável"
  const groupMap = new Map();

  cards.forEach(card => {
    const cardUsers = card.users && card.users.length > 0 ? card.users : null;
    if (!cardUsers) {
      if (!groupMap.has('__none__')) {
        groupMap.set('__none__', { userId: '__none__', name: 'Sem responsável', initials: '?', color: '#94a3b8', cards: [], totalValue: 0 });
      }
      const g = groupMap.get('__none__');
      g.cards.push(card);
      g.totalValue += card.price || 0;
    } else {
      cardUsers.forEach(u => {
        const uid = u.id || u;
        const userObj = users.find(x => x.id === uid) || { id: uid, name: u.name || String(uid) };
        if (!groupMap.has(uid)) {
          groupMap.set(uid, {
            userId: uid,
            name: userObj.name,
            initials: initials(userObj.name),
            color: avatarColor(userObj.name),
            cards: [],
            totalValue: 0,
          });
        }
        const g = groupMap.get(uid);
        g.cards.push(card);
        g.totalValue += card.price || 0;
      });
    }
  });

  // Also add columns for users who have no cards (so all users appear)
  users.forEach(u => {
    if (!groupMap.has(u.id)) {
      groupMap.set(u.id, {
        userId: u.id,
        name: u.name,
        initials: initials(u.name),
        color: avatarColor(u.name),
        cards: [],
        totalValue: 0,
      });
    }
  });

  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (a.userId === '__none__') return 1;
    if (b.userId === '__none__') return -1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 12, padding: '16px 18px', overflowX: 'auto', height: '100%', alignItems: 'flex-start' }}>
      {groups.map(group => (
        <div key={group.userId} style={{
          minWidth: 280, maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 8,
          background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0',
          maxHeight: '100%', overflow: 'hidden',
        }}>
          {/* Column header */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: group.color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {group.initials}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{group.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{group.cards.length} negócio{group.cards.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#6366f1', background: '#eef2ff', borderRadius: 20, padding: '2px 8px' }}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(group.totalValue)}
            </div>
          </div>

          {/* Cards list */}
          <div style={{ overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {group.cards.map(card => (
              <MiniCard key={card.id} card={card} stages={stages} onClick={() => onOpenCard(card)} showOnCardFields={showOnCardFields} />
            ))}
            {group.cards.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, padding: '20px 0' }}>Nenhum negócio</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AppInner() {
  const [currentView, setCurrentView] = useState('crm');
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const confirm = useConfirm();
  const [pipelines, setPipelines] = useState([]);
  const [activePipelineId, setActivePipelineId] = useState(null);
  const [stages, setStages] = useState([]);
  const [cards, setCards] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [showOnCardFields, setShowOnCardFields] = useState([]);

  const [boardFilters, setBoardFilters] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [selectedCardIds, setSelectedCardIds] = useState(new Set());
  const [bulkStageId, setBulkStageId] = useState('');
  const [bulkUserId, setBulkUserId] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [pendingMoveData, setPendingMoveData] = useState(null);
  const [allContacts, setAllContacts] = useState([]);
  const [allCustomFields, setAllCustomFields] = useState([]);

  useSearchShortcut(() => setShowSearch(true));

  const [boardView, setBoardView] = useState('kanban'); // 'kanban' | 'list' | 'automations'
  const [isEditingPipeline, setIsEditingPipeline] = useState(false);
  const [editPipelineName, setEditPipelineName] = useState('');
  const [isAddingPipeline, setIsAddingPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [pendingConvertLead, setPendingConvertLead] = useState(null);
  const [pendingRevertLead, setPendingRevertLead] = useState(null); // { lead, newStageId }
  const [showImportLeads, setShowImportLeads] = useState(false);

  const pipelinesRef = useRef([]);
  useEffect(() => { pipelinesRef.current = pipelines; }, [pipelines]);

  // Single entry-point: load pipelines once, then set the default active pipeline
  useEffect(() => {
    fetch(`${API}/pipelines`)
      .then(r => r.json())
      .then(data => {
        setPipelines(data);
        pipelinesRef.current = data;
        const hash = window.location.hash.replace(/^#/, '');
        const nonCrmViews = ['contacts', 'companies', 'webhooks', 'users', 'tasks', 'projects', 'workflows', 'reports', 'audit', 'settings', 'roles'];
        const isNonCrm = nonCrmViews.some(v => hash === v || hash.startsWith(v + '/'));
        if (!isNonCrm && !hash.startsWith('pipeline/') && !hash.startsWith('deal/')) {
          const leadsP = data.find(p => p.name === 'Leads');
          const first = leadsP || data[0];
          if (first) setActivePipelineId(first.id);
        }
      })
      .catch(() => setLoading(false));

    fetch(`${API}/custom-fields?entity=deal`)
      .then(r => r.json())
      .then(all => {
        setShowOnCardFields(all.filter(f => f.show_on_card));
        setAllCustomFields(Array.isArray(all) ? all : []);
      })
      .catch(() => {});

    fetch(`${API}/users`)
      .then(r => r.json())
      .then(data => setAllUsers(Array.isArray(data) ? data : []))
      .catch(() => {});

    fetch(`${API}/contacts`)
      .then(r => r.json())
      .then(data => setAllContacts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash.replace(/^#/, '');

      if (hash === 'contacts' || hash.startsWith('contacts/')) { setCurrentView('contacts'); setSelectedCard(null); return; }
      if (hash === 'companies' || hash.startsWith('companies/')) { setCurrentView('companies'); setSelectedCard(null); return; }
      if (hash === 'webhooks') { setCurrentView('webhooks'); setSelectedCard(null); return; }
      if (hash === 'users' || hash.startsWith('users/')) { setCurrentView('users'); setSelectedCard(null); return; }
      if (hash === 'tasks' || hash.startsWith('tasks/')) { setCurrentView('tasks'); setSelectedCard(null); return; }
      if (hash === 'projects' || hash.startsWith('projects/')) { setCurrentView('projects'); setSelectedCard(null); return; }
      if (hash === 'workflows') { setCurrentView('workflows'); setSelectedCard(null); return; }
      if (hash === 'reports') { setCurrentView('reports'); setSelectedCard(null); return; }
      if (hash === 'audit') { setCurrentView('audit'); setSelectedCard(null); return; }
      if (hash === 'settings') { setCurrentView('settings'); setSelectedCard(null); return; }
      if (hash === 'roles') { setCurrentView('roles'); setSelectedCard(null); return; }

      const dealMatch = hash.match(/^pipeline\/(\d+)\/stage\/(\d+)\/deal\/(\d+)$/);
      if (dealMatch) {
        const pId = parseInt(dealMatch[1]);
        const dId = parseInt(dealMatch[3]);
        setCurrentView('crm');
        setActivePipelineId(pId);
        try {
          // Determine if this pipeline is Leads — check ref first, fallback to API
          let isLeads = false;
          const cachedPipes = pipelinesRef.current;
          if (cachedPipes.length > 0) {
            isLeads = cachedPipes.find(p => p.id === pId)?.name === 'Leads';
          } else {
            // Pipelines not loaded yet — fetch them now
            const pr = await fetch(`${API}/pipelines`);
            if (pr.ok) {
              const pipes = await pr.json();
              setPipelines(pipes);
              pipelinesRef.current = pipes;
              isLeads = pipes.find(p => p.id === pId)?.name === 'Leads';
            }
          }
          const endpoint = isLeads ? 'leads' : 'cards';
          const [itemRes, stagesRes] = await Promise.all([
            fetch(`${API}/${endpoint}/${dId}`),
            fetch(`${API}/stages?pipeline_id=${pId}`)
          ]);
          if (itemRes.ok) {
            const [itemData, stagesData] = await Promise.all([itemRes.json(), stagesRes.json()]);
            setStages(stagesData);
            setSelectedCard(itemData);
          }
        } catch {}
        return;
      }

      const pipeMatch = hash.match(/^pipeline\/(\d+)$/);
      if (pipeMatch) {
        setCurrentView('crm');
        setActivePipelineId(parseInt(pipeMatch[1]));
        setSelectedCard(null);
        return;
      }

      if (hash.startsWith('deal/')) {
        const dId = parseInt(hash.replace('deal/', ''));
        try {
          const allStagesRes = await fetch(`${API}/stages`);
          const allStages = await allStagesRes.json();
          // Try leads first, then cards
          for (const endpoint of ['leads', 'cards']) {
            const res = await fetch(`${API}/${endpoint}/${dId}`);
            if (res.ok) {
              const itemData = await res.json();
              const stage = allStages.find(s => s.id === itemData.stage_id);
              if (stage) {
                window.history.replaceState(null, '', `#pipeline/${stage.pipeline_id}/stage/${stage.id}/deal/${dId}`);
                setCurrentView('crm');
                setActivePipelineId(stage.pipeline_id);
                setStages(allStages.filter(s => s.pipeline_id === stage.pipeline_id));
                setSelectedCard(itemData);
                break;
              }
            }
          }
        } catch {}
        return;
      }

      if (!hash) setSelectedCard(null);
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (currentView === 'crm' && activePipelineId && !selectedCard) {
      const h = window.location.hash.replace(/^#/, '');
      if (!h.startsWith(`pipeline/${activePipelineId}/stage/`)) {
        window.history.replaceState(null, '', `#pipeline/${activePipelineId}`);
      }
    }
  }, [activePipelineId, currentView, selectedCard]);

  // Board loader — always uses current state, called from useEffect
  const doFetchBoard = async (pid, plist) => {
    if (!pid || !plist || plist.length === 0) return;
    setLoading(true);
    const name = plist.find(p => p.id === pid)?.name || '';
    const isLeads = name === 'Leads';
    try {
      const [sr, ir] = await Promise.all([
        fetch(`${API}/stages?pipeline_id=${pid}`),
        fetch(`${API}/${isLeads ? 'leads' : 'cards'}?pipeline_id=${pid}`),
      ]);
      const stagesData = await sr.json();
      const itemsData = await ir.json();
      setStages(Array.isArray(stagesData) ? stagesData : []);
      if (isLeads) setLeads(Array.isArray(itemsData) ? itemsData : []);
      else setCards(Array.isArray(itemsData) ? itemsData : []);
    } catch (e) { console.error('fetchBoard error', e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const pipe = pipelines.find(p => p.id === activePipelineId);
    if (pipe) setEditPipelineName(pipe.name);
    if (currentView === 'crm' && activePipelineId && pipelines.length > 0) {
      setBoardFilters({});
      doFetchBoard(activePipelineId, pipelines);
    }
  }, [activePipelineId, pipelines, currentView]);

  const handleDragStart = (e, card) => {
    e.dataTransfer.setData('text/plain', card.id.toString());
    setDraggedCardId(card.id);
  };

  const handleDrop = async (e, newStageId) => {
    e.preventDefault();
    const itemId = parseInt(e.dataTransfer.getData('text/plain') || draggedCardId);
    if (!itemId) return;
    setDraggedCardId(null);

    if (isLeadsPipeline) {
      const lead = leads.find(l => l.id === itemId);
      if (!lead || lead.stage_id === newStageId) return;

      const targetStage = stages.find(s => s.id === newStageId);
      const isConvertStage = targetStage && /convertido|ganho|concluir/i.test(targetStage.name);

      // Lead convertido voltando para etapa não-conversão → aviso de desvinculação
      if (lead.converted && !isConvertStage) {
        setPendingRevertLead({ lead, newStageId });
        return;
      }

      setLeads(prev => prev.map(l => l.id === itemId ? { ...l, stage_id: newStageId } : l));
      try {
        await fetch(`${API}/leads/${itemId}/move`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_stage_id: newStageId, new_order: 0 })
        });
        // Lead não convertido chegando em etapa de conversão → abrir modal
        if (isConvertStage && !lead.converted) {
          const freshLead = leads.find(l => l.id === itemId);
          setPendingConvertLead({ ...freshLead, stage_id: newStageId });
          return;
        }
        const res = await fetch(`${API}/leads?pipeline_id=${activePipelineId}`);
        setLeads(await res.json());
      } catch {}
    } else {
      const card = cards.find(c => c.id === itemId);
      if (!card || card.stage_id === newStageId) return;
      const prevStageId = card.stage_id;
      setCards(prev => prev.map(c => c.id === itemId ? { ...c, stage_id: newStageId } : c));
      try {
        const res = await fetch(`${API}/cards/${itemId}/move`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_stage_id: newStageId, new_order: 0 })
        });
        if (res.status === 422) {
          const err = await res.json();
          if (err.detail?.code === 'missing_required_fields') {
            // Revert optimistic update
            setCards(prev => prev.map(c => c.id === itemId ? { ...c, stage_id: prevStageId } : c));
            setPendingMoveData({
              cardId: itemId,
              newStageId,
              newOrder: 0,
              stageName: err.detail.stage_name,
              missing: err.detail.missing,
            });
            return;
          }
        }
        const refreshCards = async () => {
          try {
            const r = await fetch(`${API}/cards?pipeline_id=${activePipelineId}`);
            setCards(await r.json());
          } catch {}
        };
        setTimeout(refreshCards, 1200);
        setTimeout(refreshCards, 3000);
      } catch {}
    }
  };

  const handleFillAndMove = async (filledValues) => {
    if (!pendingMoveData) return;
    const { cardId, newStageId, newOrder } = pendingMoveData;

    // Separate builtin fields, contact_id, and custom fields
    const updatePayload = {};
    const customUpdates = [];
    for (const [k, v] of Object.entries(filledValues)) {
      if (k.startsWith('custom_')) {
        customUpdates.push([k, v]);
      } else if (k === 'contact_id') {
        // contact linking not handled here — skip
      } else {
        updatePayload[k] = v;
      }
    }

    try {
      // Update builtin fields on the card
      if (Object.keys(updatePayload).length > 0) {
        const cardRes = await fetch(`${API}/cards/${cardId}`);
        if (cardRes.ok) {
          const cardData = await cardRes.json();
          await fetch(`${API}/cards/${cardId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...cardData, ...updatePayload }),
          });
        }
      }

      // Update custom fields
      for (const [k, v] of customUpdates) {
        const cfId = parseInt(k.replace('custom_', ''));
        await fetch(`${API}/cards/${cardId}/custom-fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field_id: cfId, value: String(v) }),
        }).catch(() => {});
      }

      // Retry the move
      const moveRes = await fetch(`${API}/cards/${cardId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_stage_id: newStageId, new_order: newOrder }),
      });

      setPendingMoveData(null);
      if (moveRes.ok) {
        await doFetchBoard(activePipelineId, pipelines);
      }
    } catch {
      setPendingMoveData(null);
    }
  };

  const handleUpdateRequiredFields = async (stageId, fields) => {
    try {
      await fetch(`${API}/stages/${stageId}/required-fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
    } catch {}
  };

  const handleAddCard = async (stageId, title) => {
    try {
      if (isLeadsPipeline) {
        const res = await fetch(`${API}/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, stage_id: stageId, order: 0, price: 0 })
        });
        const lead = await res.json();
        setLeads(prev => [...prev, lead]);
      } else {
        const res = await fetch(`${API}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, stage_id: stageId, order: 0, price: 0 })
        });
        const card = await res.json();
        setCards(prev => [...prev, card]);
      }
    } catch {}
  };

  const doConvertLead = async (leadId, opts) => {
    try {
      const res = await fetch(`${API}/leads/${leadId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      });
      if (res.ok) {
        const result = await res.json();
        const updatedLeads = await fetch(`${API}/leads?pipeline_id=${activePipelineId}`).then(r => r.json());
        setLeads(updatedLeads);
        setSelectedCard(null);
        window.location.hash = `pipeline/${activePipelineId}`;
        const parts = [];
        if (result.deal_id)    parts.push(`Negócio #${result.deal_id}`);
        if (result.contact_id) parts.push(`Contato #${result.contact_id}`);
        if (result.company_id) parts.push(`Empresa #${result.company_id}`);
        toast('Lead convertido com sucesso!', parts.length ? `Criado(s): ${parts.join(', ')}` : '');
      }
    } catch {}
  };

  const handleUpdateCardDetails = async (cardId, updatedData) => {
    if (isLeadsPipeline) {
      setLeads(prev => prev.map(l => l.id === cardId ? { ...l, ...updatedData } : l));
      if (selectedCard?.id === cardId && updatedData.stage_id) {
        window.history.replaceState(null, '', `#pipeline/${activePipelineId}/stage/${updatedData.stage_id}/deal/${cardId}`);
      }
      try {
        await fetch(`${API}/leads/${cardId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData)
        });
      } catch {}
    } else {
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, ...updatedData } : c));
      if (selectedCard?.id === cardId && updatedData.stage_id) {
        window.history.replaceState(null, '', `#pipeline/${activePipelineId}/stage/${updatedData.stage_id}/deal/${cardId}`);
      }
      try {
        await fetch(`${API}/cards/${cardId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData)
        });
      } catch {}
    }
  };

  const handleDeleteCard = async (cardId) => {
    try {
      if (isLeadsPipeline) {
        await fetch(`${API}/leads/${cardId}`, { method: 'DELETE' });
        setLeads(prev => prev.filter(l => l.id !== cardId));
      } else {
        await fetch(`${API}/cards/${cardId}`, { method: 'DELETE' });
        setCards(prev => prev.filter(c => c.id !== cardId));
      }
      setSelectedCard(null);
      window.location.hash = `pipeline/${activePipelineId}`;
    } catch {}
  };

  // ── Card selection ───────────────────────────────────────────────────────────
  const handleSelectCard = (card) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(card.id)) next.delete(card.id);
      else next.add(card.id);
      return next;
    });
  };

  const handleOpenCard = (card) => {
    window.location.hash = `pipeline/${activePipelineId}/stage/${card.stage_id}/deal/${card.id}`;
  };

  const clearSelection = () => setSelectedCardIds(new Set());

  // ── Bulk actions ─────────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (!await confirm(`Excluir ${selectedCardIds.size} item(s)?`, 'Esta ação não pode ser desfeita.')) return;
    const endpoint = isLeadsPipeline ? 'leads' : 'cards';
    await Promise.all([...selectedCardIds].map(id =>
      fetch(`${API}/${endpoint}/${id}`, { method: 'DELETE' }).catch(() => {})
    ));
    if (isLeadsPipeline) setLeads(prev => prev.filter(l => !selectedCardIds.has(l.id)));
    else setCards(prev => prev.filter(c => !selectedCardIds.has(c.id)));
    clearSelection();
  };

  const handleBulkMoveStage = async () => {
    if (!bulkStageId) return;
    const stId = parseInt(bulkStageId);
    const endpoint = isLeadsPipeline ? 'leads' : 'cards';
    await Promise.all([...selectedCardIds].map(id =>
      fetch(`${API}/${endpoint}/${id}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_stage_id: stId, new_order: 0 })
      }).catch(() => {})
    ));
    if (isLeadsPipeline) setLeads(prev => prev.map(l => selectedCardIds.has(l.id) ? { ...l, stage_id: stId } : l));
    else setCards(prev => prev.map(c => selectedCardIds.has(c.id) ? { ...c, stage_id: stId } : c));
    setBulkStageId('');
    clearSelection();
  };

  const handleBulkAssignUser = async () => {
    if (!bulkUserId) return;
    const uId = parseInt(bulkUserId);
    const endpoint = isLeadsPipeline ? 'leads' : 'cards';
    await Promise.all([...selectedCardIds].map(id =>
      fetch(`${API}/${endpoint}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uId })
      }).catch(() => {})
    ));
    // Refresh board to get updated users
    doFetchBoard(activePipelineId, pipelines);
    setBulkUserId('');
    clearSelection();
  };

  const handleUpdateStage = async (stageId, updatedData) => {
    setStages(prev => prev.map(s => s.id === stageId ? updatedData : s));
    try {
      await fetch(`${API}/stages/${stageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
    } catch {}
  };

  const handleDeleteStage = async (stageId) => {
    setStages(prev => prev.filter(s => s.id !== stageId));
    try { await fetch(`${API}/stages/${stageId}`, { method: 'DELETE' }); } catch {}
  };

  // Insert a new stage after a given stage index
  const handleAddStageAfter = async (afterStageId) => {
    const idx = stages.findIndex(s => s.id === afterStageId);
    const insertOrder = idx + 1;
    const name = 'Nova etapa';
    try {
      const res = await fetch(`${API}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, order: insertOrder, pipeline_id: activePipelineId, color: '#6366f1' })
      });
      const newStage = await res.json();
      // Reorder: insert at position, then patch orders
      setStages(prev => {
        const list = [...prev];
        list.splice(insertOrder, 0, newStage);
        const reordered = list.map((s, i) => ({ ...s, order: i }));
        reordered.forEach(s => {
          if (s.id !== newStage.id) {
            fetch(`${API}/stages/${s.id}`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(s)
            }).catch(() => {});
          }
        });
        return reordered;
      });
    } catch {}
  };

  // Reorder stages via drag
  const handleMoveStage = async (draggedId, targetId) => {
    if (draggedId === targetId) return;
    setStages(prev => {
      const list = [...prev];
      const from = list.findIndex(s => s.id === draggedId);
      const to   = list.findIndex(s => s.id === targetId);
      if (from === -1 || to === -1) return prev;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      const reordered = list.map((s, i) => ({ ...s, order: i }));
      reordered.forEach(s => {
        fetch(`${API}/stages/${s.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(s)
        }).catch(() => {});
      });
      return reordered;
    });
  };

  const handleSaveStage = async () => {
    if (!newStageName.trim() || !activePipelineId) return;
    try {
      const res = await fetch(`${API}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStageName.trim(), order: stages.length, pipeline_id: activePipelineId, color: '#6366f1' })
      });
      const newStage = await res.json();
      setStages(prev => [...prev, newStage]);
      setNewStageName('');
      setIsAddingStage(false);
    } catch {}
  };

  const handlePipelineSelect = (e) => {
    if (e.target.value === 'new') setIsAddingPipeline(true);
    else if (e.target.value !== '') setActivePipelineId(parseInt(e.target.value));
  };

  const handleSaveNewPipeline = async () => {
    if (!newPipelineName.trim()) { setIsAddingPipeline(false); return; }
    try {
      const res = await fetch(`${API}/pipelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPipelineName.trim() })
      });
      const p = await res.json();
      setPipelines(prev => [...prev, p]);
      setActivePipelineId(p.id);
      setIsAddingPipeline(false);
      setNewPipelineName('');
    } catch {}
  };

  const handleSavePipelineName = async () => {
    if (!editPipelineName.trim()) return;
    setPipelines(prev => prev.map(p => p.id === activePipelineId ? { ...p, name: editPipelineName } : p));
    setIsEditingPipeline(false);
    try {
      await fetch(`${API}/pipelines/${activePipelineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editPipelineName })
      });
    } catch {}
  };

  const handleDeletePipeline = async () => {
    if (isDefaultPipeline) return;
    if (!await confirm(`Excluir o funil "${activePipelineName}"?`, 'Todos os negócios nele serão removidos. Esta ação não pode ser desfeita.')) return;
    try {
      await fetch(`${API}/pipelines/${activePipelineId}`, { method: 'DELETE' });
      const remaining = pipelines.filter(p => p.id !== activePipelineId);
      setPipelines(remaining);
      const nextDeal = remaining.find(p => p.name !== 'Leads');
      setActivePipelineId(nextDeal?.id || remaining[0]?.id || null);
    } catch {}
  };

  const activePipelineName = pipelines.find(p => p.id === activePipelineId)?.name || '';
  const isDefaultPipeline = activePipelineName === 'Leads';
  const isLeadsPipeline = activePipelineName === 'Leads';
  const _rawItems = isLeadsPipeline ? leads : cards;

  // Closed stages: those whose names suggest won/lost
  const _closedStageIds = new Set(
    stages.filter(s => /perdido|desqualificado|convertido|ganho|fechado/i.test(s.name)).map(s => s.id)
  );

  const boardItems = _rawItems.filter(item => {
    const f = boardFilters;
    if (!f || Object.keys(f).length === 0) return true;

    if (f.status === 'open'   && _closedStageIds.has(item.stage_id)) return false;
    if (f.status === 'closed' && !_closedStageIds.has(item.stage_id)) return false;

    if (f.stage_id && item.stage_id !== parseInt(f.stage_id)) return false;

    if (f.name && !item.title?.toLowerCase().includes(f.name.toLowerCase())) return false;

    if (f.source && item.source !== f.source) return false;

    if (f.responsible_id) {
      const rid = parseInt(f.responsible_id);
      const users = item.users || [];
      if (!users.some(u => u.id === rid)) return false;
    }

    if (f.amount_op && f.amount_val !== undefined && f.amount_val !== '') {
      const val = parseFloat(f.amount_val);
      const price = parseFloat(item.price) || 0;
      if (f.amount_op === 'eq' && price !== val) return false;
      if (f.amount_op === 'gt' && price <= val) return false;
      if (f.amount_op === 'lt' && price >= val) return false;
      if (f.amount_op === 'between') {
        const val2 = parseFloat(f.amount_val2) || val;
        if (price < val || price > val2) return false;
      }
    }

    if (f.date_preset && f.date_preset !== '') {
      const created = item.created_at ? new Date(item.created_at) : null;
      if (created) {
        const now = new Date();
        const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const today = startOfDay(now);
        if (f.date_preset === 'today' && created < today) return false;
        if (f.date_preset === 'this_week') {
          const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
          if (created < weekStart) return false;
        }
        if (f.date_preset === 'this_month') {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          if (created < monthStart) return false;
        }
        if (f.date_preset === 'last_30') {
          const limit = new Date(now); limit.setDate(now.getDate() - 30);
          if (created < limit) return false;
        }
        if (f.date_preset === 'custom') {
          if (f.date_from && created < new Date(f.date_from)) return false;
          if (f.date_to   && created > new Date(f.date_to + 'T23:59:59')) return false;
        }
      }
    }

    return true;
  });

  const leadsPipelineId = pipelines.find(p => p.name === 'Leads')?.id;
  const dealPipelines = pipelines.filter(p => p.name !== 'Leads');

  const navigate = (view, hash) => {
    setCurrentView(view);
    setSelectedCard(null);
    window.location.hash = hash;
  };

  return (
    <div className="app-wrapper">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">N</div>
          <span className="logo-text">Nexus CRM</span>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">CRM</div>
          <div
            className={`nav-item ${currentView === 'crm' && activePipelineName === 'Leads' ? 'active' : ''}`}
            onClick={() => {
              if (!leadsPipelineId) return;
              setCurrentView('crm');
              setActivePipelineId(leadsPipelineId);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M2 13a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Leads
          </div>
          {dealPipelines.map(p => (
            <div
              key={p.id}
              className={`nav-item ${currentView === 'crm' && activePipelineId === p.id ? 'active' : ''}`}
              onClick={() => { setCurrentView('crm'); setActivePipelineId(p.id); }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1.5" y="5.5" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4.5 5.5V4a3 3 0 0 1 6 0v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              {p.name}
            </div>
          ))}
          <div
            className={`nav-item ${currentView === 'reports' ? 'active' : ''}`}
            onClick={() => navigate('reports', 'reports')}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1" y="8" width="3" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="6" y="5" width="3" height="9" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="11" y="2" width="3" height="12" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            Relatórios
          </div>
          <div
            className={`nav-item ${currentView === 'workflows' ? 'active' : ''}`}
            onClick={() => navigate('workflows', 'workflows')}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M1.5 4.5h4M1.5 7.5h7M1.5 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="11.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="11.5" cy="10.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M11.5 6.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Fluxos de trabalho
          </div>
          {user?.role === 'admin' && (
            <div
              className={`nav-item ${currentView === 'audit' ? 'active' : ''}`}
              onClick={() => navigate('audit', 'audit')}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 3h11M2 6h8M2 9h5M2 12h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Auditoria
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Cadastros</div>
          <div className={`nav-item ${currentView === 'contacts' ? 'active' : ''}`} onClick={() => navigate('contacts', 'contacts')}>
            <IconContacts /> Contatos
          </div>
          <div className={`nav-item ${currentView === 'companies' ? 'active' : ''}`} onClick={() => navigate('companies', 'companies')}>
            <IconCompany /> Empresas
          </div>
          <div className={`nav-item ${currentView === 'users' ? 'active' : ''}`} onClick={() => navigate('users', 'users')}>
            <IconUsers /> Equipe
          </div>
          <div className={`nav-item ${currentView === 'roles' ? 'active' : ''}`} onClick={() => navigate('roles', 'roles')}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1.5" y="3.5" width="12" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="1.5" y="9" width="8" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="12.5" cy="10.25" r="2" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            Funções
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Tarefas</div>
          <div className={`nav-item ${currentView === 'tasks' ? 'active' : ''}`} onClick={() => navigate('tasks', 'tasks')}>
            <IconTasks /> Tarefas
          </div>
          <div className={`nav-item ${currentView === 'projects' ? 'active' : ''}`} onClick={() => navigate('projects', 'projects')}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="8" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="1.5" y="8" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="8" y="8" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            Projetos
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Integrações</div>
          <div className={`nav-item ${currentView === 'webhooks' ? 'active' : ''}`} onClick={() => navigate('webhooks', 'webhooks')}>
            <IconWebhook /> Webhooks
          </div>
        </div>

        <div className="sidebar-section" style={{ marginTop: 'auto' }}>
          <div style={{ padding: '4px 10px 8px' }}>
            <NotificationBell onNavigateToCard={(cardId) => {
              fetch(`http://localhost:8001/cards/${cardId}`).then(r => r.json()).then(card => {
                setSelectedCard(card);
                setCurrentView('crm');
              }).catch(() => {});
            }} />
          </div>

          {/* Logged-in user chip */}
          <UserChip />

          <div
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings', 'settings')}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.9 2.9l1.1 1.1M11 11l1.1 1.1M2.9 12.1L4 11M11 4l1.1-1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Configurações
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        {currentView === 'contacts' && <ContactsView />}
        {currentView === 'companies' && <CompaniesView />}
        {currentView === 'users' && <UsersView />}
        {currentView === 'roles' && <RolesView />}
        {currentView === 'webhooks' && <WebhooksView />}
        {currentView === 'settings' && <CustomFieldsManager />}
        {currentView === 'reports' && <ReportsView />}
        {currentView === 'audit' && <AuditLogView />}
        {currentView === 'workflows' && <WorkflowsView />}
        {currentView === 'tasks' && <TasksKanban />}
        {currentView === 'projects' && <ProjectsView />}

        {currentView === 'crm' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <header className="top-header">
              <div className="header-left">
                {isEditingPipeline ? (
                  <>
                    <input
                      className="header-title-input"
                      autoFocus
                      value={editPipelineName}
                      onChange={e => setEditPipelineName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSavePipelineName(); if (e.key === 'Escape') setIsEditingPipeline(false); }}
                    />
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleSavePipelineName}>Salvar</button>
                    <button className="icon-btn" onClick={() => setIsEditingPipeline(false)}><IconX /></button>
                  </>
                ) : (
                  <>
                    <span className="header-title">{activePipelineName}</span>
                    {!isDefaultPipeline && activePipelineName && (
                      <>
                        <button className="icon-btn" title="Renomear funil" onClick={() => setIsEditingPipeline(true)}><IconEdit /></button>
                        <button className="icon-btn" title="Excluir funil" onClick={handleDeletePipeline}><IconTrash /></button>
                      </>
                    )}
                  </>
                )}

                <div className="header-sep" />

                <div className="header-controls">
                  <button className="btn btn-primary" onClick={() => stages.length > 0 && handleAddCard(stages[0].id, isLeadsPipeline ? 'Novo lead' : 'Novo negócio')}>
                    {isLeadsPipeline ? '+ Novo Lead' : '+ Criar'}
                  </button>

                  {isLeadsPipeline && (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)' }}
                      onClick={() => setShowImportLeads(true)}
                      title="Importar leads via CSV"
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M6.5 1v7M3.5 5l3 3 3-3M1.5 9.5v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Importar CSV
                    </button>
                  )}

                  {/* Automations button */}
                  <button
                    onClick={() => setBoardView(v => v === 'automations' ? 'kanban' : 'automations')}
                    className={boardView === 'automations' ? 'btn btn-primary' : 'btn btn-ghost'}
                    style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)' }}
                  >
                    <IconBolt /> Automações
                  </button>

                  {/* View toggle */}
                  <div style={{ display: 'flex', background: '#f1f5f9', border: '1px solid var(--border)', borderRadius: 8, padding: 2, opacity: boardView === 'automations' ? 0.4 : 1, pointerEvents: boardView === 'automations' ? 'none' : 'auto' }}>
                    <button
                      onClick={() => setBoardView('kanban')}
                      title="Kanban"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                        border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                        background: boardView === 'kanban' ? 'white' : 'transparent',
                        color: boardView === 'kanban' ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: boardView === 'kanban' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        fontWeight: boardView === 'kanban' ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      <IconKanban /> Kanban
                    </button>
                    <button
                      onClick={() => setBoardView('list')}
                      title="Lista"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                        border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                        background: boardView === 'list' ? 'white' : 'transparent',
                        color: boardView === 'list' ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: boardView === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        fontWeight: boardView === 'list' ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      <IconList /> Lista
                    </button>
                    <button
                      onClick={() => setBoardView('kanban-user')}
                      title="Por Responsável"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                        border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                        background: boardView === 'kanban-user' ? 'white' : 'transparent',
                        color: boardView === 'kanban-user' ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: boardView === 'kanban-user' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        fontWeight: boardView === 'kanban-user' ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      <IconUsers /> Por Responsável
                    </button>
                  </div>

                  {isAddingPipeline ? (
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <input
                        autoFocus
                        className="search-input"
                        style={{ width: 160 }}
                        placeholder="Nome do funil"
                        value={newPipelineName}
                        onChange={e => setNewPipelineName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveNewPipeline(); if (e.key === 'Escape') setIsAddingPipeline(false); }}
                      />
                      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleSaveNewPipeline}>OK</button>
                      <button className="icon-btn" onClick={() => setIsAddingPipeline(false)}><IconX /></button>
                    </div>
                  ) : (
                    !isDefaultPipeline ? (
                      <select className="pipeline-select" value={activePipelineId || ''} onChange={handlePipelineSelect}>
                        {dealPipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        <option value="new">+ Novo funil</option>
                      </select>
                    ) : (
                      <button className="btn btn-ghost" style={{ fontSize: 12, border: '1px solid var(--border)' }} onClick={() => setIsAddingPipeline(true)}>
                        + Novo funil
                      </button>
                    )
                  )}
                </div>
              </div>
            </header>

            {/* Filter bar — shown on kanban and list views */}
            {boardView !== 'automations' && (
              <div style={{ padding: '6px 18px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg-page, #f8fafc)' }}>
                <FilterBar
                  isLead={isLeadsPipeline}
                  stages={stages}
                  users={allUsers}
                  activeFilters={boardFilters}
                  onApply={f => setBoardFilters(f)}
                />
              </div>
            )}

            {/* Bulk action toolbar */}
            {selectedCardIds.size > 0 && (
              <div className="bulk-toolbar">
                <span className="bulk-count">{selectedCardIds.size} selecionado{selectedCardIds.size !== 1 ? 's' : ''}</span>
                <div className="bulk-actions">
                  <select
                    className="bulk-select"
                    value={bulkStageId}
                    onChange={e => setBulkStageId(e.target.value)}
                  >
                    <option value="">Mover para etapa…</option>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {bulkStageId && (
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleBulkMoveStage}>
                      Mover
                    </button>
                  )}

                  <select
                    className="bulk-select"
                    value={bulkUserId}
                    onChange={e => setBulkUserId(e.target.value)}
                  >
                    <option value="">Atribuir responsável…</option>
                    {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  {bulkUserId && (
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleBulkAssignUser}>
                      Atribuir
                    </button>
                  )}

                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, color: '#ef4444', border: '1px solid #fca5a5' }}
                    onClick={handleBulkDelete}
                  >
                    🗑 Excluir
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={clearSelection}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {boardView === 'automations' ? (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <AutomationsView
                  stages={stages}
                  pipelineId={activePipelineId}
                  pipelineName={activePipelineName}
                  onClose={() => setBoardView('kanban')}
                />
              </div>
            ) : boardView === 'list' ? (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <ListView
                  cards={boardItems}
                  stages={stages}
                  onClickCard={card => {
                    window.location.hash = `pipeline/${activePipelineId}/stage/${card.stage_id}/deal/${card.id}`;
                  }}
                  onUpdateCard={updatedCard => {
                    setCards(prev => prev.map(c => c.id === updatedCard.id ? { ...c, ...updatedCard } : c));
                  }}
                  selectedCardIds={selectedCardIds}
                  onSelectCard={handleSelectCard}
                  onSelectAll={(cards) => setSelectedCardIds(prev => {
                    const next = new Set(prev);
                    cards.forEach(c => next.add(c.id));
                    return next;
                  })}
                  onDeselectAll={(cards) => setSelectedCardIds(prev => {
                    const next = new Set(prev);
                    cards.forEach(c => next.delete(c.id));
                    return next;
                  })}
                  bulkToolbar={selectedCardIds.size > 0 ? (
                    <div className="bulk-toolbar" style={{ position: 'relative', borderRadius: 0, borderTop: '1px solid #e2e8f0', borderBottom: 'none' }}>
                      <span className="bulk-count">{selectedCardIds.size} selecionado{selectedCardIds.size !== 1 ? 's' : ''}</span>
                      <div className="bulk-actions">
                        <select className="bulk-select" value={bulkStageId} onChange={e => setBulkStageId(e.target.value)}>
                          <option value="">Mover para etapa…</option>
                          {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        {bulkStageId && <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleBulkMoveStage}>Mover</button>}
                        <select className="bulk-select" value={bulkUserId} onChange={e => setBulkUserId(e.target.value)}>
                          <option value="">Atribuir responsável…</option>
                          {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        {bulkUserId && <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleBulkAssignUser}>Atribuir</button>}
                        <button className="btn btn-ghost" style={{ fontSize: 12, color: '#ef4444', border: '1px solid #fca5a5' }} onClick={handleBulkDelete}>🗑 Excluir</button>
                        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={clearSelection}>Cancelar</button>
                      </div>
                    </div>
                  ) : null}
                />
              </div>
            ) : boardView === 'kanban-user' ? (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <UserKanban
                  cards={boardItems}
                  stages={stages}
                  users={allUsers}
                  onOpenCard={handleOpenCard}
                  showOnCardFields={showOnCardFields}
                  isLead={isLeadsPipeline}
                />
              </div>
            ) : (
              <main
                className="board-container"
                onClick={() => selectedCardIds.size > 0 && clearSelection()}
              >
                {stages.map(stage => (
                  <KanbanColumn
                    key={stage.id}
                    stage={stage}
                    cards={boardItems.filter(c => c.stage_id === stage.id).sort((a, b) => a.order - b.order)}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    onAddCard={handleAddCard}
                    onUpdateStage={handleUpdateStage}
                    onDeleteStage={handleDeleteStage}
                    onAddStageAfter={handleAddStageAfter}
                    onMoveStage={handleMoveStage}
                    showOnCardFields={showOnCardFields}
                    isLead={isLeadsPipeline}
                    onOpenCard={handleOpenCard}
                    onSelectCard={handleSelectCard}
                    selectedCardIds={selectedCardIds}
                    customFields={allCustomFields.filter(cf => cf.entity === 'deal')}
                    onUpdateRequiredFields={handleUpdateRequiredFields}
                  />
                ))}

                <div className="add-stage-col">
                  {isAddingStage ? (
                    <div className="inline-form" style={{ background: 'white', border: '1px solid var(--border)', padding: 10 }}>
                      <input
                        autoFocus
                        className="inline-input"
                        placeholder="Nome da etapa"
                        value={newStageName}
                        onChange={e => setNewStageName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveStage(); if (e.key === 'Escape') setIsAddingStage(false); }}
                      />
                      <div className="inline-actions">
                        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleSaveStage}>Salvar</button>
                        <button className="icon-btn" onClick={() => setIsAddingStage(false)}><IconX /></button>
                      </div>
                    </div>
                  ) : (
                    <button className="add-stage-trigger" onClick={() => setIsAddingStage(true)}>
                      + Adicionar etapa
                    </button>
                  )}
                </div>
              </main>
            )}
          </div>
        )}
      </div>

      {selectedCard && isLeadsPipeline && (
        <LeadModal
          lead={selectedCard}
          stages={stages.filter(s => s.pipeline_id === activePipelineId)}
          onClose={() => { setSelectedCard(null); window.location.hash = `pipeline/${activePipelineId}`; }}
          onSave={handleUpdateCardDetails}
          onDelete={handleDeleteCard}
          onConvert={doConvertLead}
        />
      )}
      {selectedCard && !isLeadsPipeline && (
        <CardModal
          card={selectedCard}
          stages={stages.filter(s => s.pipeline_id === activePipelineId)}
          onClose={() => { setSelectedCard(null); window.location.hash = `pipeline/${activePipelineId}`; }}
          onSave={handleUpdateCardDetails}
          onDelete={handleDeleteCard}
          onDuplicate={async () => {
            await doFetchBoard(activePipelineId, pipelines);
            setSelectedCard(null);
          }}
        />
      )}
      {pendingConvertLead && (
        <LeadConvertModal
          lead={pendingConvertLead}
          onClose={() => setPendingConvertLead(null)}
          onConfirm={async (opts) => {
            setPendingConvertLead(null);
            await doConvertLead(pendingConvertLead.id, opts);
          }}
        />
      )}
      {pendingRevertLead && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={() => setPendingRevertLead(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 28, width: 440,
            boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: 'var(--text-primary)' }}>
              Reverter conversão do lead?
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              Este lead já foi convertido. Ao movê-lo de volta, ele será desvinculado das entidades criadas (negócio, contato, empresa), mas essas entidades <strong>permanecerão no CRM</strong>.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setPendingRevertLead(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, background: '#ef4444', borderColor: '#ef4444' }}
                onClick={async () => {
                  const { lead, newStageId } = pendingRevertLead;
                  setPendingRevertLead(null);
                  try {
                    await fetch(`${API}/leads/${lead.id}/move`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ new_stage_id: newStageId, new_order: 0 }),
                    });
                    await fetch(`${API}/leads/${lead.id}/revert-convert`, { method: 'POST' });
                    const res = await fetch(`${API}/leads?pipeline_id=${activePipelineId}`);
                    setLeads(await res.json());
                    toast('Lead desvinculado', 'As entidades criadas foram mantidas no CRM.');
                  } catch {}
                }}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
      {showImportLeads && (
        <ImportLeadsModal
          defaultStageId={stages?.[0]?.id}
          onClose={() => { setShowImportLeads(false); doFetchBoard(activePipelineId, pipelines); }}
        />
      )}
      {pendingMoveData && (
        <StageRequiredModal
          pendingMove={pendingMoveData}
          allUsers={allUsers}
          allContacts={allContacts}
          onFilled={handleFillAndMove}
          onCancel={() => setPendingMoveData(null)}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onSelect={(result) => {
            setShowSearch(false);
            if (result.type === 'card') {
              fetch(`${API}/cards/${result.id}`).then(r => r.json()).then(card => {
                setSelectedCard(card);
                setCurrentView('crm');
              }).catch(() => {});
            } else if (result.type === 'lead') {
              setCurrentView('crm');
            } else if (result.type === 'contact') {
              setCurrentView('contacts');
            } else if (result.type === 'company') {
              setCurrentView('companies');
            }
          }}
        />
      )}
    </div>
  );
}

function AppGated() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8', fontSize: 14 }}>
      Carregando...
    </div>
  );
  if (!user) return <LoginPage />;
  return <AppInner />;
}

export default function App() {
  return (
    <ConfirmProvider>
      <AppGated />
    </ConfirmProvider>
  );
}
