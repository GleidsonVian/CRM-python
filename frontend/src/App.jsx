// v2 — Slate & Emerald palette
import React, { useState, useEffect, useRef } from 'react';
import KanbanColumn from './components/KanbanColumn';
import CardModal from './components/CardModal';
import LeadModal from './components/LeadModal';
import ContactsView from './components/ContactsView';
import CompaniesView from './components/CompaniesView';
import UsersView from './components/UsersView';
import WebhooksView from './components/WebhooksView';
import ListView from './components/ListView';
import FilterBar from './components/FilterBar';
import AutomationsView from './components/AutomationsView';
import CustomFieldsManager from './components/CustomFieldsManager';
import './index.css';

const API = 'http://localhost:8002';

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

export default function App() {
  const [currentView, setCurrentView] = useState('crm');
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

  const [boardView, setBoardView] = useState('kanban'); // 'kanban' | 'list' | 'automations'
  const [isEditingPipeline, setIsEditingPipeline] = useState(false);
  const [editPipelineName, setEditPipelineName] = useState('');
  const [isAddingPipeline, setIsAddingPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');

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
        if (!hash || hash === '' || !hash.startsWith('pipeline/')) {
          const leadsP = data.find(p => p.name === 'Leads');
          const first = leadsP || data[0];
          if (first) setActivePipelineId(first.id);
        }
      })
      .catch(() => setLoading(false));

    fetch(`${API}/custom-fields?entity=deal`)
      .then(r => r.json())
      .then(all => setShowOnCardFields(all.filter(f => f.show_on_card)))
      .catch(() => {});

    fetch(`${API}/users`)
      .then(r => r.json())
      .then(data => setAllUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash.replace(/^#/, '');

      if (hash === 'contacts' || hash.startsWith('contacts/')) { setCurrentView('contacts'); setSelectedCard(null); return; }
      if (hash === 'companies' || hash.startsWith('companies/')) { setCurrentView('companies'); setSelectedCard(null); return; }
      if (hash === 'webhooks') { setCurrentView('webhooks'); setSelectedCard(null); return; }
      if (hash === 'users' || hash.startsWith('users/')) { setCurrentView('users'); setSelectedCard(null); return; }

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
      setLeads(prev => prev.map(l => l.id === itemId ? { ...l, stage_id: newStageId } : l));
      try {
        await fetch(`${API}/leads/${itemId}/move`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_stage_id: newStageId, new_order: 0 })
        });
        const targetStage = stages.find(s => s.id === newStageId);
        if (targetStage?.name === 'Lead convertido' || targetStage?.name === 'Concluir lead' || targetStage?.name === 'Convertido (Ganho)') {
          await fetch(`${API}/leads/${itemId}/convert`, { method: 'POST' });
        }
        const res = await fetch(`${API}/leads?pipeline_id=${activePipelineId}`);
        setLeads(await res.json());
      } catch {}
    } else {
      const card = cards.find(c => c.id === itemId);
      if (!card || card.stage_id === newStageId) return;
      setCards(prev => prev.map(c => c.id === itemId ? { ...c, stage_id: newStageId } : c));
      try {
        await fetch(`${API}/cards/${itemId}/move`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_stage_id: newStageId, new_order: 0 })
        });
        const refreshCards = async () => {
          try {
            const res = await fetch(`${API}/cards?pipeline_id=${activePipelineId}`);
            setCards(await res.json());
          } catch {}
        };
        setTimeout(refreshCards, 1200);
        setTimeout(refreshCards, 3000);
      } catch {}
    }
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
    if (!window.confirm(`Excluir ${selectedCardIds.size} item(s)? Esta ação não pode ser desfeita.`)) return;
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
    else setActivePipelineId(parseInt(e.target.value));
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
    if (!window.confirm(`Excluir o funil "${activePipelineName}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await fetch(`${API}/pipelines/${activePipelineId}`, { method: 'DELETE' });
      const remaining = pipelines.filter(p => p.id !== activePipelineId);
      setPipelines(remaining);
      setActivePipelineId(remaining[0]?.id || null);
    } catch {}
  };

  const activePipelineName = pipelines.find(p => p.id === activePipelineId)?.name || '';
  const isDefaultPipeline = activePipelineName === 'Leads' || activePipelineName === 'Negócios';
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
  const negociosPipelineId = pipelines.find(p => p.name === 'Negócios')?.id;
  const customPipelines = pipelines.filter(p => p.name !== 'Leads' && p.name !== 'Negócios');

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
              const p = pipelinesRef.current.find(x => x.name === 'Leads');
              if (!p) return;
              setCurrentView('crm');
              setActivePipelineId(p.id);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M2 13a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Leads
          </div>
          <div
            className={`nav-item ${currentView === 'crm' && activePipelineName === 'Negócios' ? 'active' : ''}`}
            onClick={() => {
              const p = pipelinesRef.current.find(x => x.name === 'Negócios');
              if (!p) return;
              setCurrentView('crm');
              setActivePipelineId(p.id);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1.5" y="5.5" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M4.5 5.5V4a3 3 0 0 1 6 0v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Negócios
          </div>
          {customPipelines.length > 0 && (
            <>
              <div className="sidebar-section-label" style={{ marginTop: 8 }}>Funis</div>
              {customPipelines.map(p => (
                <div
                  key={p.id}
                  className={`nav-item ${currentView === 'crm' && activePipelineId === p.id ? 'active' : ''}`}
                  onClick={() => { setCurrentView('crm'); setActivePipelineId(p.id); }}
                >
                  <IconBoard /> {p.name}
                </div>
              ))}
            </>
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
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Em breve</div>
          <div className="nav-item disabled"><IconTasks /> Tarefas</div>
          <div className="nav-item disabled"><IconCalendar /> Calendário</div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Integrações</div>
          <div className={`nav-item ${currentView === 'webhooks' ? 'active' : ''}`} onClick={() => navigate('webhooks', 'webhooks')}>
            <IconWebhook /> Webhooks
          </div>
        </div>

        <div className="sidebar-section" style={{ marginTop: 'auto' }}>
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
        {currentView === 'webhooks' && <WebhooksView />}
        {currentView === 'settings' && <CustomFieldsManager />}

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
                  </div>

                  {!isDefaultPipeline && (
                    isAddingPipeline ? (
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
                      <select className="pipeline-select" value={activePipelineId || ''} onChange={handlePipelineSelect}>
                        {customPipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        <option value="new">+ Novo funil</option>
                      </select>
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
                  cards={cards}
                  stages={stages}
                  onClickCard={card => {
                    window.location.hash = `pipeline/${activePipelineId}/stage/${card.stage_id}/deal/${card.id}`;
                  }}
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
          onConvert={async (leadId) => {
            try {
              const res = await fetch(`${API}/leads/${leadId}/convert`, { method: 'POST' });
              if (res.ok) {
                const negocio = await res.json();
                const updatedLeads = await fetch(`${API}/leads?pipeline_id=${activePipelineId}`).then(r => r.json());
                setLeads(updatedLeads);
                setSelectedCard(null);
                window.location.hash = `pipeline/${activePipelineId}`;
                alert(`Lead convertido em Negócio #${negocio.id} com sucesso!`);
              }
            } catch {}
          }}
        />
      )}
      {selectedCard && !isLeadsPipeline && (
        <CardModal
          card={selectedCard}
          stages={stages.filter(s => s.pipeline_id === activePipelineId)}
          onClose={() => { setSelectedCard(null); window.location.hash = `pipeline/${activePipelineId}`; }}
          onSave={handleUpdateCardDetails}
          onDelete={handleDeleteCard}
        />
      )}
    </div>
  );
}
