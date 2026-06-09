import React from 'react';

export default function KanbanCard({ card, onDragStart, onDoubleClick }) {
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const tagText = card.title.split(' ')[0] || "LEAD";
  const mockNames = ['Mariana Monteiro', 'Antônia Canceira', 'Fabio João', 'Lola Almeida', 'João dos Santos'];
  // Keep random visually stable by hashing ID
  const mockClient = mockNames[card.id % mockNames.length];
  const assignees = ['Ana Laura Lima', 'Julia Lima Costa', 'Zoe Fonseca'];
  const mockAssignee = assignees[card.id % assignees.length];
  const avatarInitials = mockAssignee.substring(0, 2).toUpperCase();
  const isPaid = (card.id % 2) === 0;

  return (
    <div
      className="card"
      draggable="true"
      onDragStart={(e) => onDragStart(e, card)}
      onDoubleClick={() => onDoubleClick(card)}
    >
      <div className="card-header">
        <div className="card-title-id">
          Negócio #{card.id}
          <div style={{fontWeight: 400, marginTop: '2px'}}>{card.title}</div>
        </div>
        {isPaid && <div className="card-badge">PAGO</div>}
      </div>
      
      <div className="card-price">{formatCurrency(card.price)}</div>
      <div className="card-client">{mockClient}</div>
      
      <div className="card-assignee-area">
        <span className="card-assignee-label">Pessoa responsável</span>
        <div className="card-assignee-row">
          <div className="card-avatar">{avatarInitials}</div>
          <span className="card-assignee-name">{mockAssignee}</span>
        </div>
      </div>
      
      <div className="card-footer">
        <span className="card-activity">+ Atividade</span>
        <span>Hoje</span>
      </div>

      <div className="card-icons">
        <span>📞</span>
        <span>✉️</span>
        <span>💬</span>
      </div>
    </div>
  );
}
