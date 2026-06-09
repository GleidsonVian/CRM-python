// v2 — Slate & Emerald palette
import React, { useState, useEffect } from 'react';
import KanbanColumn from './components/KanbanColumn';
import CardModal from './components/CardModal';
import ContactsView from './components/ContactsView';
import UsersView from './components/UsersView';
import ListView from './components/ListView';
import AutomationsView from './components/AutomationsView';
import CustomFieldsManager from './components/CustomFieldsManager';
import './index.css';

const API = 'http://localhost:8000';

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
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [showOnCardFields, setShowOnCardFields] = useState([]);

  const [boardView, setBoardView] = useState('kanban'); // 'kanban' | 'list' | 'automations'
  const [isEditingPipeline, setIsEditingPipeline] = useState(false);
  const [editPipelineName, setEditPipelineName] = useState('');
  const [isAddingPipeline, setIsAddingPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');

  const fetchPipelines = async () => {
    try {
      const res = await fetch(`${API}/pipelines`);
      const data = await res.json();
      setPipelines(data);
      return data;
    } catch {
      setLoading(false);
      return [];
    }
  };

  useEffect(() => {
    fetchPipelines().then(data => {
      if (data.length > 0 && !window.location.hash.startsWith('#deal/')) {
        setActivePipelineId(data[0].id);
      }
    });
    // fetch once; refreshed when settings view is re-entered
    fetch(`${API}/custom-fields?entity=deal`)
      .then(r => r.json())
      .then(all => setShowOnCardFields(all.filter(f => f.show_on_card)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash.replace(/^#/, '');

      if (hash === 'contacts' || hash.startsWith('contacts/')) { setCurrentView('contacts'); setSelectedCard(null); return; }
      if (hash === 'users' || hash.startsWith('users/')) { setCurrentView('users'); setSelectedCard(null); return; }

      const dealMatch = hash.match(/^pipeline\/(\d+)\/stage\/(\d+)\/deal\/(\d+)$/);
      if (dealMatch) {
        const pId = parseInt(dealMatch[1]);
        const dId = parseInt(dealMatch[3]);
        setCurrentView('crm');
        setActivePipelineId(pId);
        try {
          // fetch card and stages in parallel so modal opens with stages ready
          const [cardRes, stagesRes] = await Promise.all([
            fetch(`${API}/cards/${dId}`),
            fetch(`${API}/stages?pipeline_id=${pId}`)
          ]);
          if (cardRes.ok) {
            const [cardData, stagesData] = await Promise.all([cardRes.json(), stagesRes.json()]);
            setStages(stagesData);
            setSelectedCard(cardData);
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
          const [cardRes, allStagesRes] = await Promise.all([
            fetch(`${API}/cards/${dId}`),
            fetch(`${API}/stages`)
          ]);
          if (cardRes.ok) {
            const cardData = await cardRes.json();
            const allStages = await allStagesRes.json();
            const stage = allStages.find(s => s.id === cardData.stage_id);
            if (stage) {
              window.history.replaceState(null, '', `#pipeline/${stage.pipeline_id}/stage/${stage.id}/deal/${dId}`);
              setCurrentView('crm');
              setActivePipelineId(stage.pipeline_id);
              setStages(allStages.filter(s => s.pipeline_id === stage.pipeline_id));
              setSelectedCard(cardData);
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

  const fetchBoard = async () => {
    if (!activePipelineId) return;
    setLoading(true);
    try {
      const [stagesRes, cardsRes] = await Promise.all([
        fetch(`${API}/stages?pipeline_id=${activePipelineId}`),
        fetch(`${API}/cards?pipeline_id=${activePipelineId}`)
      ]);
      setStages(await stagesRes.json());
      setCards(await cardsRes.json());
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (currentView === 'crm') {
      fetchBoard();
      // re-fetch show_on_card fields in case they changed in settings
      fetch(`${API}/custom-fields?entity=deal`)
        .then(r => r.json())
        .then(all => setShowOnCardFields(all.filter(f => f.show_on_card)))
        .catch(() => {});
    }
    const pipe = pipelines.find(p => p.id === activePipelineId);
    if (pipe) setEditPipelineName(pipe.name);
  }, [activePipelineId, pipelines, currentView]);

  const handleDragStart = (e, card) => {
    e.dataTransfer.setData('text/plain', card.id.toString());
    setDraggedCardId(card.id);
  };

  const handleDrop = async (e, newStageId) => {
    e.preventDefault();
    const cardId = parseInt(e.dataTransfer.getData('text/plain') || draggedCardId);
    if (!cardId) return;
    const card = cards.find(c => c.id === cardId);
    if (!card || card.stage_id === newStageId) { setDraggedCardId(null); return; }
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, stage_id: newStageId } : c));
    setDraggedCardId(null);
    try {
      await fetch(`${API}/cards/${cardId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_stage_id: newStageId, new_order: 0 })
      });
      // Automations run as background tasks on the server; re-fetch after a short
      // delay so any triggered moves/field changes are reflected immediately.
      const refreshCards = async () => {
        try {
          const res = await fetch(`${API}/cards?pipeline_id=${activePipelineId}`);
          const updated = await res.json();
          setCards(updated);
        } catch {}
      };
      setTimeout(refreshCards, 1200);
      setTimeout(refreshCards, 3000);
    } catch {}
  };

  const handleAddCard = async (stageId, title) => {
    try {
      const res = await fetch(`${API}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, stage_id: stageId, order: 0, price: 0 })
      });
      const newCard = await res.json();
      setCards(prev => [...prev, newCard]);
    } catch {}
  };

  const handleUpdateCardDetails = async (cardId, updatedData) => {
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
  };

  const handleDeleteCard = async (cardId) => {
    try {
      await fetch(`${API}/cards/${cardId}`, { method: 'DELETE' });
      setCards(prev => prev.filter(c => c.id !== cardId));
      setSelectedCard(null);
      window.location.hash = `pipeline/${activePipelineId}`;
    } catch {}
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
          <div className="sidebar-section-label">Menu</div>
          <div className={`nav-item ${currentView === 'crm' ? 'active' : ''}`} onClick={() => { setCurrentView('crm'); window.location.hash = activePipelineId ? `pipeline/${activePipelineId}` : ''; }}>
            <IconBoard /> Pipeline
          </div>
          <div className={`nav-item ${currentView === 'contacts' ? 'active' : ''}`} onClick={() => navigate('contacts', 'contacts')}>
            <IconContacts /> Contatos
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
        {currentView === 'users' && <UsersView />}
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
                  <button className="btn btn-primary" onClick={() => stages.length > 0 && handleAddCard(stages[0].id, 'Novo negócio')}>
                    + Criar
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
                    <select className="pipeline-select" value={activePipelineId || ''} onChange={handlePipelineSelect}>
                      {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      <option value="new">+ Novo funil</option>
                    </select>
                  )}
                </div>
              </div>
            </header>

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
              <main className="board-container">
                {stages.map(stage => (
                  <KanbanColumn
                    key={stage.id}
                    stage={stage}
                    cards={cards.filter(c => c.stage_id === stage.id).sort((a, b) => a.order - b.order)}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    onAddCard={handleAddCard}
                    onUpdateStage={handleUpdateStage}
                    showOnCardFields={showOnCardFields}
                    onClickCard={card => {
                      window.location.hash = `pipeline/${activePipelineId}/stage/${card.stage_id}/deal/${card.id}`;
                    }}
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

      {selectedCard && (
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
