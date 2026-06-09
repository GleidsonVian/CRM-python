import React from 'react';

export default function KanbanCard({ card, onDragStart, onClick }) {
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const isPaid = (card.id % 2) === 0;

  return (
    <div
      className="card"
      draggable="true"
      onDragStart={(e) => onDragStart(e, card)}
      onClick={() => onClick(card)}
    >
      <div className="card-header">
        <div className="card-title-id">
          {card.title}
          <div style={{fontWeight: 400, marginTop: '2px', fontSize: '0.8em', color: '#666'}}>ID: #{card.id}</div>
        </div>
        {isPaid && <div className="card-badge">PAGO</div>}
      </div>
      
      <div className="card-price">{formatCurrency(card.price)}</div>
      <div className="card-client">Cliente ID: {card.contact_id || 'Nenhum'}</div>
      
      <div className="card-assignee-area">
        <span className="card-assignee-label">Responsável</span>
        <div className="card-assignee-row">
          {card.user ? (
            <>
              <div className="card-avatar" style={{ background: '#2ecc71' }}>{card.user.name.substring(0, 2).toUpperCase()}</div>
              <span className="card-assignee-name">{card.user.name}</span>
            </>
          ) : (
            <span className="card-assignee-name" style={{ color: '#aaa', fontStyle: 'italic' }}>Sem responsável</span>
          )}
        </div>
      </div>
      
      <div className="card-footer">
        <span className="card-activity" style={{ color: '#888' }}>
          {card.activities && card.activities.length > 0 ? `${card.activities.length} Atividades` : 'Sem atividades'}
        </span>
        <span style={{ fontSize: '0.8em', color: '#666' }}>
          {card.created_at ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(card.created_at.includes('+') || card.created_at.endsWith('Z') ? card.created_at : card.created_at + 'Z')) : ''}
        </span>
      </div>
    </div>
  );
}
