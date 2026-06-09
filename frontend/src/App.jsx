import React, { useState, useEffect } from 'react';
import KanbanColumn from './components/KanbanColumn';
import CardModal from './components/CardModal';
import ContactsView from './components/ContactsView';
import './index.css';

const API_URL = 'http://localhost:8000';

function App() {
  const [currentView, setCurrentView] = useState('crm'); // 'crm' | 'contacts'
  const [pipelines, setPipelines] = useState([]);
  const [activePipelineId, setActivePipelineId] = useState(null);

  const [stages, setStages] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');

  const [selectedCard, setSelectedCard] = useState(null);

  // Edit pipeline name
  const [isEditingPipeline, setIsEditingPipeline] = useState(false);
  const [editPipelineName, setEditPipelineName] = useState('');
  
  // Add new pipeline inline
  const [isAddingPipeline, setIsAddingPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');

  const fetchPipelines = async () => {
    try {
      const res = await fetch(`${API_URL}/pipelines`);
      const data = await res.json();
      setPipelines(data);
      return data;
    } catch (error) {
      console.error("Erro ao buscar pipelines", error);
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
  }, []);

  // Hash Routing Avançado
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash.replace(/^#/, '');

      if (hash === 'contacts') {
        setCurrentView('contacts');
        setSelectedCard(null);
        return;
      }

      // Rota completa: pipeline/X/stage/S/deal/Y
      const dealMatch = hash.match(/^pipeline\/(\d+)\/stage\/(\d+)\/deal\/(\d+)$/);
      if (dealMatch) {
        const pId = parseInt(dealMatch[1]);
        const sId = parseInt(dealMatch[2]);
        const dId = parseInt(dealMatch[3]);
        setCurrentView('crm');
        setActivePipelineId(pId);
        try {
          const cardRes = await fetch(`${API_URL}/cards/${dId}`);
          if (cardRes.ok) {
            const cardData = await cardRes.json();
            setSelectedCard(cardData);
          } else {
            setSelectedCard(null);
          }
        } catch(e) {}
        return;
      }

      // Rota do pipeline: pipeline/X
      const pipeMatch = hash.match(/^pipeline\/(\d+)$/);
      if (pipeMatch) {
        const pId = parseInt(pipeMatch[1]);
        setCurrentView('crm');
        setActivePipelineId(pId);
        setSelectedCard(null);
        return;
      }

      // Atalho: deal/Y (Usado no modal de contatos, auto-descobre o pipeline/stage e reescreve a URL)
      if (hash.startsWith('deal/')) {
        const dId = parseInt(hash.replace('deal/', ''));
        try {
          const cardRes = await fetch(`${API_URL}/cards/${dId}`);
          if (cardRes.ok) {
            const cardData = await cardRes.json();
            const stagesRes = await fetch(`${API_URL}/stages`);
            const allStages = await stagesRes.json();
            const stage = allStages.find(s => s.id === cardData.stage_id);
            if (stage) {
              window.history.replaceState(null, '', `#pipeline/${stage.pipeline_id}/stage/${stage.id}/deal/${dId}`);
              setCurrentView('crm');
              setActivePipelineId(stage.pipeline_id);
              setSelectedCard(cardData);
            }
          }
        } catch(e) {}
        return;
      }

      // Fallback
      if (!hash) {
        setSelectedCard(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Sincronizar mudança de pipeline na URL (quando muda pelo dropdown e não tem card aberto)
  useEffect(() => {
    if (currentView === 'crm' && activePipelineId && !selectedCard) {
      const currentHash = window.location.hash.replace(/^#/, '');
      if (!currentHash.startsWith(`pipeline/${activePipelineId}/stage/`)) {
        window.history.replaceState(null, '', `#pipeline/${activePipelineId}`);
      }
    }
  }, [activePipelineId, currentView, selectedCard]);

  const fetchBoard = async () => {
    if (!activePipelineId) return;
    setLoading(true);
    try {
      const stagesRes = await fetch(`${API_URL}/stages?pipeline_id=${activePipelineId}`);
      const stagesData = await stagesRes.json();
      
      const cardsRes = await fetch(`${API_URL}/cards?pipeline_id=${activePipelineId}`);
      const cardsData = await cardsRes.json();
      
      setStages(stagesData);
      setCards(cardsData);
    } catch (error) {
      console.error("Erro ao buscar dados", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'crm') {
      fetchBoard();
    }
    const pipe = pipelines.find(p => p.id === activePipelineId);
    if (pipe) setEditPipelineName(pipe.name);
  }, [activePipelineId, pipelines, currentView]);

  const [draggedCardId, setDraggedCardId] = useState(null);

  const handleDragStart = (e, card) => {
    e.dataTransfer.setData('text/plain', card.id.toString());
    setDraggedCardId(card.id);
  };

  const handleDrop = async (e, newStageId) => {
    e.preventDefault();
    const cardIdStr = e.dataTransfer.getData('text/plain');
    const cardId = cardIdStr ? parseInt(cardIdStr) : draggedCardId;
    
    if (!cardId) return;
    
    const card = cards.find(c => c.id === cardId);
    if (!card || card.stage_id === newStageId) {
      setDraggedCardId(null);
      return;
    }

    // Otimista: move o card visualmente
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, stage_id: newStageId } : c));
    setDraggedCardId(null);

    try {
      await fetch(`${API_URL}/cards/${cardId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_stage_id: newStageId, new_order: 0 })
      });
    } catch (error) {
      console.error("Erro ao mover o card", error);
    }
  };

  const handleAddCard = async (stageId, title) => {
    try {
      const res = await fetch(`${API_URL}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, stage_id: stageId, order: 0, price: 0 })
      });
      const newCard = await res.json();
      setCards(prev => [...prev, newCard]);
    } catch (error) {
      console.error("Erro ao criar card", error);
    }
  };

  const handleBigCreateBtn = () => {
    if (stages.length === 0) return;
    handleAddCard(stages[0].id, `Novo Negócio #${Math.floor(Math.random() * 1000)}`);
  };

  const handleSaveStage = async () => {
    if (!newStageName.trim() || !activePipelineId) return;
    try {
      const res = await fetch(`${API_URL}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStageName.trim(), order: stages.length, pipeline_id: activePipelineId, color: "#00adef" })
      });
      const newStage = await res.json();
      setStages(prev => [...prev, newStage]);
      setNewStageName('');
      setIsAddingStage(false);
    } catch (error) {
      console.error("Erro ao criar etapa", error);
    }
  };

  const handleUpdateStage = async (stageId, updatedData) => {
    setStages(prev => prev.map(s => s.id === stageId ? updatedData : s));
    try {
      await fetch(`${API_URL}/stages/${stageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
    } catch (error) {
      console.error("Erro ao atualizar stage", error);
    }
  };

  const handleUpdateCardDetails = async (cardId, updatedData) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, ...updatedData } : c));
    if (selectedCard && selectedCard.id === cardId && updatedData.stage_id) {
       window.history.replaceState(null, '', `#pipeline/${activePipelineId}/stage/${updatedData.stage_id}/deal/${cardId}`);
    }

    try {
      await fetch(`${API_URL}/cards/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
    } catch (error) {
      console.error("Erro ao atualizar card", error);
    }
  };

  const handlePipelineSelect = async (e) => {
    const val = e.target.value;
    if (val === 'new') {
      setIsAddingPipeline(true);
    } else {
      setActivePipelineId(parseInt(val));
    }
  };

  const handleSaveNewPipeline = async () => {
    if (!newPipelineName.trim()) {
      setIsAddingPipeline(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/pipelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPipelineName.trim() })
      });
      const newPipe = await res.json();
      setPipelines(prev => [...prev, newPipe]);
      setActivePipelineId(newPipe.id);
      setIsAddingPipeline(false);
      setNewPipelineName('');
    } catch (error) {
      console.error("Erro ao criar pipeline", error);
    }
  };

  const handleDeletePipeline = async () => {
    if (activePipelineName === 'Leads' || activePipelineName === 'Negócios') {
      alert("Os funis padrão não podem ser excluídos.");
      return;
    }
    
    if (window.confirm(`Tem certeza que deseja excluir o funil "${activePipelineName}" e todas as suas etapas e negócios? Essa ação não pode ser desfeita.`)) {
      try {
        await fetch(`${API_URL}/pipelines/${activePipelineId}`, { method: 'DELETE' });
        setPipelines(prev => prev.filter(p => p.id !== activePipelineId));
        setActivePipelineId(pipelines[0].id);
      } catch (error) {
        console.error("Erro ao excluir pipeline", error);
      }
    }
  };

  const handleSavePipelineName = async () => {
    if (!editPipelineName.trim() || !activePipelineId) return;
    setPipelines(prev => prev.map(p => p.id === activePipelineId ? { ...p, name: editPipelineName } : p));
    setIsEditingPipeline(false);
    try {
      await fetch(`${API_URL}/pipelines/${activePipelineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editPipelineName })
      });
    } catch (error) {
      console.error("Erro ao renomear pipeline", error);
    }
  };

  if (loading && stages.length === 0 && currentView === 'crm') return <div style={{padding: '2rem', color: 'white'}}>Carregando Nexus CRM...</div>;

  const activePipelineName = pipelines.find(p => p.id === activePipelineId)?.name || 'Carregando...';
  const isDefaultPipeline = activePipelineName === 'Leads' || activePipelineName === 'Negócios';

  return (
    <div className="app-wrapper">
      <aside className="sidebar">
        <div className="sidebar-logo">NEXUS</div>
        <div className={`nav-icon ${currentView === 'crm' ? 'active' : ''}`} title="CRM" onClick={() => setCurrentView('crm')}>💬</div>
        <div className={`nav-icon ${currentView === 'contacts' ? 'active' : ''}`} title="Contatos" onClick={() => setCurrentView('contacts')}>👥</div>
        <div className="nav-icon" title="Tarefas">✅</div>
        <div className="nav-icon" title="Calendário">📅</div>
        <div className="nav-icon" title="Drive">📁</div>
      </aside>

      <div className="main-content">
        {currentView === 'crm' ? (
          <>
            <header className="top-header">
              <div className="header-left">
                {isEditingPipeline ? (
                  <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                    <input 
                      type="text" 
                      value={editPipelineName} 
                      onChange={e => setEditPipelineName(e.target.value)}
                      style={{fontSize: '1.4rem', background: 'transparent', color: 'white', border: '1px solid #00adef', outline: 'none', padding: '0.2rem'}}
                    />
                    <button className="btn-primary" onClick={handleSavePipelineName}>Salvar</button>
                    <button className="btn-cancel" onClick={() => setIsEditingPipeline(false)}>✕</button>
                  </div>
                ) : (
                  <h1 className="header-title" style={{display: 'flex', alignItems: 'center', gap: '0.8rem'}}>
                    {activePipelineName} 
                    {!isDefaultPipeline && (
                      <div style={{display: 'flex', gap: '0.5rem'}}>
                        <span style={{fontSize: '1rem', cursor: 'pointer', opacity: 0.5}} onClick={() => setIsEditingPipeline(true)}>✎</span>
                        <span style={{fontSize: '1rem', cursor: 'pointer', opacity: 0.5}} onClick={handleDeletePipeline}>🗑️</span>
                      </div>
                    )}
                  </h1>
                )}
                
                <div className="header-controls">
                  <button className="header-btn primary" onClick={handleBigCreateBtn}>+ Criar</button>
                  
                  {isAddingPipeline ? (
                    <div style={{display: 'flex', gap: '0.3rem', alignItems: 'center', background: 'rgba(255,255,255,0.9)', padding: '2px', borderRadius: '4px'}}>
                      <input 
                        autoFocus
                        type="text" 
                        placeholder="Nome do Novo Funil" 
                        style={{padding: '0.3rem', border: 'none', outline: 'none', fontSize: '0.85rem', width: '150px'}}
                        value={newPipelineName}
                        onChange={e => setNewPipelineName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveNewPipeline()}
                      />
                      <button className="btn-primary" style={{padding: '0.2rem 0.5rem'}} onClick={handleSaveNewPipeline}>OK</button>
                      <button className="btn-cancel" style={{fontSize: '1rem', padding: '0 0.3rem'}} onClick={() => setIsAddingPipeline(false)}>×</button>
                    </div>
                  ) : (
                    <select 
                      className="header-btn" 
                      style={{background: 'rgba(255,255,255,0.1)', color: 'white'}}
                      value={activePipelineId || ''}
                      onChange={handlePipelineSelect}
                    >
                      {pipelines.map(p => (
                        <option key={p.id} value={p.id} style={{color: 'black'}}>{p.name}</option>
                      ))}
                      <option value="new" style={{color: 'black', fontWeight: 'bold'}}>+ Criar Novo Funil</option>
                    </select>
                  )}
                </div>
              </div>
              <div className="header-right">
                <span>Nexus CRM</span>
              </div>
            </header>

            <main className="board-container">
              {stages.map((stage, index) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  cards={cards.filter(c => c.stage_id === stage.id).sort((a,b) => a.order - b.order)}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onAddCard={handleAddCard}
                  onUpdateStage={handleUpdateStage}
                  onClickCard={card => window.location.hash = `pipeline/${activePipelineId}/stage/${card.stage_id}/deal/${card.id}`}
                />
              ))}
              
              <div className="add-stage-col">
                {isAddingStage ? (
                  <div className="inline-form" style={{background: 'rgba(255,255,255,0.9)'}}>
                    <input
                      autoFocus
                      type="text"
                      className="inline-input"
                      placeholder="Nome da etapa"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveStage()}
                    />
                    <div className="inline-actions">
                      <button className="btn-primary" onClick={handleSaveStage}>Salvar</button>
                      <button className="btn-cancel" onClick={() => setIsAddingStage(false)}>×</button>
                    </div>
                  </div>
                ) : (
                  <button className="quick-add-btn" style={{background: 'rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '4px'}} onClick={() => setIsAddingStage(true)}>
                    + Adicionar fase
                  </button>
                )}
              </div>
            </main>
          </>
        ) : (
          <ContactsView />
        )}
      </div>

      {selectedCard && (
        <CardModal 
          card={selectedCard} 
          stages={stages}
          onClose={() => window.location.hash = ''} 
          onSave={handleUpdateCardDetails}
        />
      )}
    </div>
  );
}

export default App;
