import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:8000';

export default function ContactModal({ contact, onClose }) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeals();
  }, [contact.id]);

  const fetchDeals = async () => {
    try {
      const res = await fetch(`${API_URL}/cards?contact_id=${contact.id}`);
      const data = await res.json();
      setDeals(data);
    } catch (error) {
      console.error("Erro ao buscar negócios do contato", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 2000 }}>
      <div className="modal-slider" onClick={e => e.stopPropagation()} style={{ width: '600px' }}>
        <div className="modal-header">
          <div className="modal-header-top">
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #00adef 0%, #0076a3 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
                {contact.first_name.charAt(0)}{contact.last_name ? contact.last_name.charAt(0) : ''}
              </div>
              Perfil do Cliente
            </h2>
            <div className="modal-actions">
              <button className="btn-icon" onClick={onClose}>✕</button>
            </div>
          </div>
        </div>

        <div className="modal-content-grid" style={{ gridTemplateColumns: '1fr', gap: '2rem' }}>
          
          <div className="modal-left">
            <h3 className="section-title">DADOS DO CONTATO</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Nome Completo</label>
                <div className="static-value" style={{ background: '#f9f9f9' }}>{contact.first_name} {contact.last_name}</div>
              </div>
              <div className="form-group">
                <label>CPF</label>
                <div className="static-value" style={{ background: '#f9f9f9' }}>{contact.cpf || 'Não informado'}</div>
              </div>
              <div className="form-group">
                <label>E-mail</label>
                <div className="static-value" style={{ background: '#f9f9f9' }}>{contact.email || 'Não informado'}</div>
              </div>
              <div className="form-group">
                <label>Telefone</label>
                <div className="static-value" style={{ background: '#f9f9f9' }}>{contact.phone || 'Não informado'}</div>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Endereço</label>
                <div className="static-value" style={{ background: '#f9f9f9' }}>{contact.address || 'Não informado'}</div>
              </div>
            </div>
          </div>

          <div className="modal-left">
            <h3 className="section-title">NEGÓCIOS VINCULADOS ({deals.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {loading ? (
                <div style={{ color: '#888' }}>Carregando negócios...</div>
              ) : deals.length === 0 ? (
                <div style={{ color: '#888', background: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
                  Este cliente ainda não possui nenhum negócio vinculado.
                </div>
              ) : (
                deals.map(deal => (
                  <div key={deal.id} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#333' }}>{deal.title}</div>
                      <div style={{ fontSize: '0.85rem', color: '#777', marginTop: '0.2rem' }}>ID: #{deal.id}</div>
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#00adef', background: 'rgba(0, 173, 239, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '20px' }}>
                      {formatCurrency(deal.price)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
