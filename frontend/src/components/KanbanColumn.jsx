import React, { useState } from 'react';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ stage, cards, onDragStart, onDrop, onAddCard, onUpdateStage, onClickCard, showOnCardFields = [] }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [isEditingStage, setIsEditingStage] = useState(false);
  const [editName, setEditName] = useState(stage.name);
  const [editColor, setEditColor] = useState(stage.color || '#6366f1');

  const total = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(cards.reduce((acc, c) => acc + (c.price || 0), 0));

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
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

  const handleSaveStage = () => {
    onUpdateStage(stage.id, { ...stage, name: editName, color: editColor });
    setIsEditingStage(false);
  };

  return (
    <div
      className={`column-wrapper ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragEnter={e => e.preventDefault()}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="column-header">
        <div className="col-dot" style={{ background: stage.color || '#6366f1' }} />
        <span className="col-title" title={stage.name}>{stage.name}</span>
        <span className="col-count">{cards.length}</span>
        <button className="col-gear" title="Editar etapa" onClick={() => setIsEditingStage(!isEditingStage)}>
          ⚙
        </button>
      </div>

      {isEditingStage && (
        <div className="inline-stage-edit">
          <input
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveStage()}
            placeholder="Nome da etapa"
          />
          <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} />
          <div className="inline-actions">
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleSaveStage}>OK</button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setIsEditingStage(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="col-value">{total}</div>

      <div className="column-body">
        {cards.map(card => (
          <KanbanCard
            key={card.id}
            card={card}
            onDragStart={onDragStart}
            onClick={onClickCard}
            showOnCardFields={showOnCardFields}
          />
        ))}

        {isAdding && (
          <div className="inline-form">
            <input
              autoFocus
              className="inline-input"
              placeholder="Nome do negócio"
              value={newCardTitle}
              onChange={e => setNewCardTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveCard(); if (e.key === 'Escape') setIsAdding(false); }}
            />
            <div className="inline-actions">
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleSaveCard}>Salvar</button>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setIsAdding(false)}>✕</button>
            </div>
          </div>
        )}
      </div>

      <div className="quick-add-area">
        {!isAdding && (
          <button className="quick-add-btn" onClick={() => setIsAdding(true)}>
            + Negócio
          </button>
        )}
      </div>
    </div>
  );
}
