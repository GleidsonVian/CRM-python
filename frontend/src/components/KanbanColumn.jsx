import React, { useState } from 'react';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ stage, cards, onDragStart, onDrop, onAddCard, onUpdateStage, onDoubleClickCard }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');

  const [isEditingStage, setIsEditingStage] = useState(false);
  const [editStageName, setEditStageName] = useState(stage.name);
  const [editStageColor, setEditStageColor] = useState(stage.color || '#00adef');

  const totalValueNum = cards.reduce((acc, card) => acc + (card.price || 0), 0);
  const totalValueFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValueNum);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    onDrop(e, stage.id);
  };

  const handleSaveCard = () => {
    if (newCardTitle.trim()) {
      onAddCard(stage.id, newCardTitle.trim());
      setNewCardTitle('');
      setIsAdding(false);
    }
  };

  const handleSaveStageConfig = () => {
    onUpdateStage(stage.id, { ...stage, name: editStageName, color: editStageColor });
    setIsEditingStage(false);
  };

  return (
    <div 
      className={`column-wrapper ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="chevron-header" style={{ backgroundColor: stage.color || '#00adef' }}>
        <span className="chevron-title" title={stage.name}>{stage.name}</span>
        <span className="chevron-count">{cards.length}</span>
        <span className="gear-icon" onClick={() => setIsEditingStage(!isEditingStage)}>⚙️</span>
      </div>

      {isEditingStage && (
        <div className="inline-stage-edit">
          <input 
            type="text" 
            value={editStageName} 
            onChange={e => setEditStageName(e.target.value)} 
          />
          <input 
            type="color" 
            value={editStageColor} 
            onChange={e => setEditStageColor(e.target.value)} 
          />
          <div className="inline-actions">
            <button className="btn-primary" onClick={handleSaveStageConfig}>Ok</button>
            <button className="btn-cancel" onClick={() => setIsEditingStage(false)}>×</button>
          </div>
        </div>
      )}
      
      <div className="column-value-area">
        <div className="column-value">{totalValueFormatted}</div>
        <button className="quick-add-btn" onClick={() => setIsAdding(true)}>+ Negócio rápido</button>
      </div>

      <div className="column-body">
        {isAdding && (
          <div className="inline-form">
            <input
              autoFocus
              type="text"
              className="inline-input"
              placeholder="Nome do negócio"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveCard()}
            />
            <div className="inline-actions">
              <button className="btn-primary" onClick={handleSaveCard}>Salvar</button>
              <button className="btn-cancel" onClick={() => setIsAdding(false)}>×</button>
            </div>
          </div>
        )}

        {cards.map(card => (
          <KanbanCard 
            key={card.id} 
            card={card} 
            onDragStart={onDragStart} 
            onDoubleClick={onDoubleClickCard}
          />
        ))}
      </div>
    </div>
  );
}
