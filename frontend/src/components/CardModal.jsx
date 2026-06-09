import React, { useState } from 'react';

export default function CardModal({ card, stages, onClose, onSave }) {
  const [price, setPrice] = useState(card.price || 0);
  const [title, setTitle] = useState(card.title || '');
  const [description, setDescription] = useState(card.description || '');
  const [stageId, setStageId] = useState(card.stage_id);

  const [contacts, setContacts] = useState([]);
  const [contactId, setContactId] = useState(card.contact_id || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  React.useEffect(() => {
    fetch('http://localhost:8000/contacts')
      .then(r => r.json())
      .then(data => {
        setContacts(data);
        if (card.contact_id) {
          const c = data.find(x => x.id === parseInt(card.contact_id));
          if (c) setSearchTerm(`${c.first_name} ${c.last_name || ''}`.trim());
        }
      })
      .catch(err => console.error(err));
  }, [card.contact_id]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleSave = () => {
    onSave(card.id, { 
      ...card, 
      title, 
      price: parseFloat(price) || 0, 
      description, 
      stage_id: stageId,
      contact_id: contactId ? parseInt(contactId) : null
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-slider" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-top">
            <h2 className="modal-title">
              Negócio #{card.id} <span className="modal-title-input"><input value={title} onChange={e => setTitle(e.target.value)} /></span>
            </h2>
            <div className="modal-actions">
              <button className="btn-primary" onClick={handleSave}>Salvar</button>
              <button className="btn-icon" onClick={onClose}>✕</button>
            </div>
          </div>
          <div className="modal-stages-ribbon">
            {stages.map(s => (
              <div 
                key={s.id} 
                className={`ribbon-item ${s.id === stageId ? 'active' : ''}`}
                onClick={() => setStageId(s.id)}
                style={{ cursor: 'pointer' }}
              >
                {s.name}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-content-grid">
          {/* Coluna Esquerda: Dados Gerais */}
          <div className="modal-left">
            <h3 className="section-title">SOBRE O NEGÓCIO</h3>
            
            <div className="form-group">
              <label>Etapa</label>
              <div className="static-value">{stages.find(s => s.id === card.stage_id)?.name}</div>
            </div>

            <div className="form-group highlight-box">
              <label>Valor e moeda</label>
              <div className="price-input-wrapper">
                <span className="currency-symbol">R$</span>
                <input 
                  type="number" 
                  value={price} 
                  onChange={e => setPrice(e.target.value)} 
                  className="price-input" 
                />
              </div>
            </div>

            <div className="form-group" style={{ position: 'relative' }}>
              <label>Cliente Vinculado</label>
              <input 
                type="text" 
                className="standard-input" 
                placeholder="Digite para buscar um contato..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                  if (e.target.value === '') setContactId(null);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              />
              {showDropdown && contacts.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ccc', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                  {contacts.filter(c => `${c.first_name} ${c.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                    <div style={{ padding: '0.5rem', color: '#888' }}>Nenhum contato encontrado.</div>
                  ) : (
                    contacts.filter(c => `${c.first_name} ${c.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase())).map(c => (
                      <div 
                        key={c.id} 
                        style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #eee', color: '#333' }}
                        onMouseDown={() => {
                          setContactId(c.id);
                          setSearchTerm(`${c.first_name} ${c.last_name || ''}`.trim());
                          setShowDropdown(false);
                        }}
                        onMouseEnter={e => e.target.style.background = '#f0f8ff'}
                        onMouseLeave={e => e.target.style.background = 'white'}
                      >
                        {c.first_name} {c.last_name}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label>Descrição</label>
              <textarea 
                className="standard-textarea" 
                rows="4" 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                placeholder="Detalhes do negócio..."
              />
            </div>
          </div>

          {/* Coluna Direita: Timeline / Atividades */}
          <div className="modal-right">
            <div className="timeline-tabs">
              <span className="tab active">Atividade</span>
              <span className="tab">Comentário</span>
              <span className="tab">Tarefa</span>
            </div>
            
            <div className="timeline-input-area">
              <input type="text" placeholder="Adicionar uma nova atividade..." className="timeline-input" />
            </div>

            <div className="timeline-events">
              <div className="timeline-event">
                <div className="event-icon created">✨</div>
                <div className="event-body">
                  <div className="event-title">Negócio criado</div>
                  <div className="event-time">Hoje</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
