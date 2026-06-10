import React, { useState, useRef } from 'react';
import KanbanCard from './KanbanCard';

// Returns white or black text depending on background luminance
function contrastColor(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#1a1a1a' : '#ffffff';
}

export default function KanbanColumn({
  stage, cards,
  onDragStart, onDrop,
  onAddCard, onUpdateStage, onDeleteStage,
  onAddStageAfter, onMoveStage,
  onOpenCard,      // opens the card modal
  onSelectCard,    // toggles selection
  selectedCardIds = new Set(),
  showOnCardFields = [],
  isLead = false,
}) {
  const [isDragOver, setIsDragOver]         = useState(false);
  const [isColDragOver, setIsColDragOver]   = useState(false);
  const [isAdding, setIsAdding]             = useState(false);
  const [newCardTitle, setNewCardTitle]     = useState('');
  const [isEditingStage, setIsEditingStage] = useState(false);
  const [editName, setEditName]             = useState(stage.name);
  const [editColor, setEditColor]           = useState(stage.color || '#6366f1');
  const [confirmDelete, setConfirmDelete]   = useState(false);
  const colRef = useRef(null);

  const stageColor = stage.color || '#6366f1';
  const textColor  = contrastColor(stageColor);

  const total = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(cards.reduce((acc, c) => acc + (c.price || 0), 0));

  // ── Card drop ────────────────────────────────────────────────────────────────
  const handleCardDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.getData('colId')) return;
    onDrop(e, stage.id);
  };

  // ── Column drag ──────────────────────────────────────────────────────────────
  const handleColDragStart = (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('colId', String(stage.id));
    e.dataTransfer.effectAllowed = 'move';
    if (colRef.current) e.dataTransfer.setDragImage(colRef.current, 40, 20);
  };

  const handleColDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsColDragOver(false);
    const draggedId = parseInt(e.dataTransfer.getData('colId'));
    if (draggedId && draggedId !== stage.id) onMoveStage(draggedId, stage.id);
  };

  // ── Stage edit ───────────────────────────────────────────────────────────────
  const handleSaveStage = () => {
    onUpdateStage(stage.id, { ...stage, name: editName, color: editColor });
    setIsEditingStage(false);
  };

  const handleSaveCard = () => {
    if (newCardTitle.trim()) {
      onAddCard(stage.id, newCardTitle.trim());
      setNewCardTitle('');
      setIsAdding(false);
    }
  };

  return (
    <div
      ref={colRef}
      className={`column-wrapper ${isDragOver ? 'drag-over' : ''} ${isColDragOver ? 'col-drag-over' : ''}`}
      style={{ position: 'relative' }}
      onMouseLeave={() => setIsColDragOver(false)}
      onDragOver={e => {
        e.preventDefault();
        const colId = e.dataTransfer.getData('colId');
        if (colId) { setIsColDragOver(true); setIsDragOver(false); }
        else setIsDragOver(true);
      }}
      onDragEnter={e => e.preventDefault()}
      onDragLeave={e => {
        if (!colRef.current?.contains(e.relatedTarget)) {
          setIsDragOver(false);
          setIsColDragOver(false);
        }
      }}
      onDrop={e => {
        const colId = e.dataTransfer.getData('colId');
        if (colId) handleColDrop(e);
        else handleCardDrop(e);
      }}
    >
      {/* ── Column header — full colored background ── */}
      <div
        className="column-header"
        draggable
        onDragStart={handleColDragStart}
        style={{
          background: stageColor,
          color: textColor,
          cursor: 'grab',
          userSelect: 'none',
          borderRadius: '8px 8px 0 0',
          padding: '8px 10px',
        }}
        title="Arraste para reordenar"
      >
        <span className="col-title" style={{ color: textColor }} title={stage.name}>{stage.name}</span>
        <span className="col-count" style={{
          background: `rgba(${textColor === '#ffffff' ? '255,255,255' : '0,0,0'}, 0.2)`,
          color: textColor,
        }}>{cards.length}</span>

        {onAddStageAfter && (
          <button
            title="Adicionar etapa ao lado"
            onClick={e => { e.stopPropagation(); onAddStageAfter(stage.id); }}
            className="col-add-stage-btn"
            style={{ color: textColor, borderColor: `rgba(${textColor === '#ffffff' ? '255,255,255' : '0,0,0'}, 0.4)` }}
          >+</button>
        )}

        <button
          className="col-gear"
          title="Editar etapa"
          style={{ color: textColor, opacity: 0.7 }}
          onClick={e => { e.stopPropagation(); setIsEditingStage(v => !v); setConfirmDelete(false); }}
        >⚙</button>
      </div>

      {/* ── Inline stage editor ── */}
      {isEditingStage && (
        <div className="inline-stage-edit">
          <input
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveStage(); if (e.key === 'Escape') setIsEditingStage(false); }}
            placeholder="Nome da etapa"
          />
          <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} />
          <div className="inline-actions">
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleSaveStage}>OK</button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setIsEditingStage(false)}>Cancelar</button>
            {!confirmDelete ? (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, color: '#ef4444' }}
                onClick={() => setConfirmDelete(true)}
              >Excluir</button>
            ) : (
              <>
                <span style={{ fontSize: 11, color: '#ef4444', alignSelf: 'center' }}>Confirmar?</span>
                <button className="btn btn-ghost" style={{ fontSize: 12, color: '#ef4444' }} onClick={() => onDeleteStage(stage.id)}>Sim</button>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setConfirmDelete(false)}>Não</button>
              </>
            )}
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
            onOpen={onOpenCard}
            onSelect={onSelectCard}
            isSelected={selectedCardIds.has(card.id)}
            showOnCardFields={showOnCardFields}
            isLead={isLead}
          />
        ))}

        {isAdding && (
          <div className="inline-form">
            <input
              autoFocus
              className="inline-input"
              placeholder={isLead ? 'Nome do lead' : 'Nome do negócio'}
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
            {isLead ? '+ Lead' : '+ Negócio'}
          </button>
        )}
      </div>

      {/* Column drag-over indicator */}
      {isColDragOver && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 10,
          border: '2px dashed #6366f1', background: 'rgba(99,102,241,0.06)',
          pointerEvents: 'none', zIndex: 5,
        }} />
      )}
    </div>
  );
}
