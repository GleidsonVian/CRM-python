import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:8000';

export default function ContactsView() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    cpf: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await fetch(`${API_URL}/contacts`);
      const data = await res.json();
      setContacts(data);
    } catch (error) {
      console.error("Erro ao buscar contatos", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.first_name) return;
    try {
      const res = await fetch(`${API_URL}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const newContact = await res.json();
      setContacts([...contacts, newContact]);
      closeModal();
    } catch (error) {
      console.error("Erro ao criar contato", error);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ first_name: '', last_name: '', email: '', cpf: '', phone: '', address: '' });
  };

  if (loading) return <div style={{padding: '2rem', color: 'white'}}>Carregando Contatos...</div>;

  return (
    <div style={{ padding: '2rem', color: 'white', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Gestão de Contatos</h2>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>+ Criar Contato</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {contacts.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.6)' }}>Nenhum contato cadastrado.</div>
        ) : (
          contacts.map(c => (
            <div key={c.id} style={{ background: 'rgba(255,255,255,0.95)', color: '#333', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'linear-gradient(135deg, #00adef 0%, #0076a3 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  {c.first_name.charAt(0)}{c.last_name ? c.last_name.charAt(0) : ''}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1a1a1a' }}>{c.first_name} {c.last_name}</h3>
                </div>
              </div>
              
              <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', color: '#555' }}>
                {c.phone && <div>📞 {c.phone}</div>}
                {c.email && <div>✉️ {c.email}</div>}
                {c.cpf && <div>🪪 CPF: {c.cpf}</div>}
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal} style={{ zIndex: 1000 }}>
          <div className="modal-slider" onClick={e => e.stopPropagation()} style={{ width: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Novo Contato</h2>
              <button className="btn-icon" onClick={closeModal}>✕</button>
            </div>
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Nome *</label>
                <input className="standard-input" autoFocus placeholder="Ex: João" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Sobrenome</label>
                <input className="standard-input" placeholder="Ex: Silva" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Telefone</label>
                <input className="standard-input" placeholder="(11) 99999-9999" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label>E-mail</label>
                <input className="standard-input" type="email" placeholder="joao@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>CPF</label>
                <input className="standard-input" placeholder="000.000.000-00" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Endereço</label>
                <input className="standard-input" placeholder="Rua das Flores, 123" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn-primary" style={{ width: '100%', padding: '1rem' }} onClick={handleSave}>Salvar Contato</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
