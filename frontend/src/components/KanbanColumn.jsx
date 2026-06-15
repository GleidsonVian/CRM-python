import React, { useState, useRef, useEffect } from 'react';
import KanbanCard from './KanbanCard';

const API = 'http://localhost:8001';

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
  customFields = [],
  onUpdateRequiredFields,
}) {
  const [isDragOver, setIsDragOver]               = useState(false);
  const [isColDragOver, setIsColDragOver]         = useState(false);
  const [isAdding, setIsAdding]                   = useState(false);
  const [newCardTitle, setNewCardTitle]           = useState('');
  const [isEditingStage, setIsEditingStage]       = useState(false);
  const [editName, setEditName]                   = useState(stage.name);
  const [editColor, setEditColor]                 = useState(stage.color || '#6366f1');
  const [confirmDelete, setConfirmDelete]         = useState(false);
  const [showRequiredConfig, setShowRequiredConfig] = useState(false);
  const [reqFields, setReqFields]                 = useState([]);
  const colRef = useRef(null);

  // Fetch required fields for this stage on mount
  useEffect(() => {
    fetch(`${API}/stages/${stage.id}/required-fields`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setReqFields(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [stage.id]);

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

        {/* Select-all checkbox */}
        {cards.length > 0 && onSelectCard && (() => {
          const allSelected = cards.every(c => selectedCardIds?.has(c.id));
          const someSelected = !allSelected && cards.some(c => selectedCardIds?.has(c.id));
          return (
            <button
              title={allSelected ? 'Desmarcar todos' : 'Selecionar todos nesta etapa'}
              onClick={e => {
                e.stopPropagation();
                if (allSelected) {
                  // deselect all in this column
                  cards.forEach(c => selectedCardIds?.has(c.id) && onSelectCard(c));
                } else {
                  // select only the unselected ones
                  cards.filter(c => !selectedCardIds?.has(c.id)).forEach(c => onSelectCard(c));
                }
              }}
              style={{
                background: (allSelected || someSelected)
                  ? `rgba(${textColor === '#ffffff' ? '255,255,255' : '0,0,0'}, 0.25)`
                  : `rgba(${textColor === '#ffffff' ? '255,255,255' : '0,0,0'}, 0.12)`,
                border: `1.5px solid rgba(${textColor === '#ffffff' ? '255,255,255' : '0,0,0'}, 0.35)`,
                borderRadius: 5,
                width: 22, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: textColor, fontSize: 11, flexShrink: 0,
                marginLeft: 'auto',
              }}
            >
              {allSelected ? '✓' : someSelected ? '–' : ''}
            </button>
          );
        })()}

        {onAddStageAfter && (
          <button
            title="Adicionar etapa ao lado"
            onClick={e => { e.stopPropagation(); onAddStageAfter(stage.id); }}
            className="col-add-stage-btn"
            style={{ color: textColor, borderColor: `rgba(${textColor === '#ffffff' ? '255,255,255' : '0,0,0'}, 0.4)`, marginLeft: (cards.length === 0 || !onSelectCard) ? 'auto' : 0 }}
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

          {/* Required fields config */}
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11, width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => setShowRequiredConfig(v => !v)}
            >
              <span>🔒</span>
              <span>Campos obrigatórios</span>
              {reqFields.length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#6366f1', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px' }}>
                  {reqFields.length}
                </span>
              )}
              <span style={{ marginLeft: reqFields.length > 0 ? 0 : 'auto', opacity: 0.5 }}>
                {showRequiredConfig ? '▲' : '▼'}
              </span>
            </button>
            {showRequiredConfig && (
              <div style={{ paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { field_type: 'builtin', field_key: 'price',       label: 'Valor > 0' },
                  { field_type: 'builtin', field_key: 'contact',     label: 'Contato vinculado' },
                  { field_type: 'builtin', field_key: 'responsible', label: 'Responsável definido' },
                  { field_type: 'builtin', field_key: 'description', label: 'Descrição preenchida' },
                  { field_type: 'builtin', field_key: 'source',      label: 'Fonte preenchida' },
                  ...customFields.map(cf => ({ field_type: 'custom', custom_field_id: cf.id, label: cf.name })),
                ].map(opt => {
                  const key = opt.field_type === 'builtin' ? opt.field_key : `custom_${opt.custom_field_id}`;
                  const checked = reqFields.some(r =>
                    r.field_type === opt.field_type &&
                    (opt.field_type === 'builtin'
                      ? r.field_key === opt.field_key
                      : r.custom_field_id === opt.custom_field_id)
                  );
                  return (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', padding: '2px 0' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        style={{ accentColor: '#6366f1' }}
                        onChange={e => {
                          if (e.target.checked) {
                            setReqFields(prev => [...prev, opt]);
                          } else {
                            setReqFields(prev => prev.filter(r =>
                              !(r.field_type === opt.field_type &&
                                (opt.field_type === 'builtin'
                                  ? r.field_key === opt.field_key
                                  : r.custom_field_id === opt.custom_field_id))
                            ));
                          }
                        }}
                      />
                      {opt.label}
                    </label>
                  );
                })}
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 11, marginTop: 4 }}
                  onClick={() => {
                    if (onUpdateRequiredFields) onUpdateRequiredFields(stage.id, reqFields);
                    setShowRequiredConfig(false);
                  }}
                >
                  Salvar campos obrigatórios
                </button>
              </div>
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
