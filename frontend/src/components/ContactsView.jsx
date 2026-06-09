import React, { useState, useEffect } from 'react';
import ContactModal from './ContactModal';

const API_URL = 'http://localhost:8000';

export default function ContactsView() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  const formatPhone = (val) => {
    let v = val.replace(/\D/g, '');
    if (v.length > 13) v = v.slice(0, 13);
    if (v.length === 0) return '';
    if (v.length <= 2) return `+${v}`;
    if (v.length <= 4) return `+${v.slice(0,2)} ${v.slice(2)}`;
    if (v.length <= 9) return `+${v.slice(0,2)} ${v.slice(2,4)} ${v.slice(4)}`;
    return `+${v.slice(0,2)} ${v.slice(2,4)} ${v.slice(4,9)}-${v.slice(9)}`;
  };

  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase();
    const fullName = `${c.first_name} ${c.last_name || ''}`.toLowerCase();
    const phone = c.phone || '';
    const email = c.email || '';
    return fullName.includes(term) || phone.includes(term) || email.toLowerCase().includes(term);
  });

  if (loading) return <div style={{padding: '2rem', color: 'white'}}>Carregando Contatos...</div>;

  return (
    <div style={{ padding: '2rem', color: 'white', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Gestão de Contatos</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Pesquisar por nome, email ou telefone..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #ccc', outline: 'none', width: '300px', color: '#333' }}
          />
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>+ Criar Contato</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', maxWidth: '800px', margin: '0 auto' }}>
        {filteredContacts.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.6)' }}>Nenhum contato encontrado.</div>
        ) : (
          filteredContacts.map(c => (
            <div 
              key={c.id} 
              onDoubleClick={() => setSelectedContact(c)}
              style={{ background: 'rgba(255,255,255,0.95)', color: '#333', borderRadius: '12px', padding: '1rem 1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', cursor: 'pointer' }}
              title="Dê duplo clique para ver o perfil"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'linear-gradient(135deg, #00adef 0%, #0076a3 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  {c.first_name.charAt(0)}{c.last_name ? c.last_name.charAt(0) : ''}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1a1a1a' }}>{c.first_name} {c.last_name}</h3>
                  <div style={{ fontSize: '0.85rem', color: '#777', display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
                    {c.phone && <span>📞 {c.phone}</span>}
                    {c.email && <span>✉️ {c.email}</span>}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#555', background: '#f0f2f5', padding: '0.4rem 0.8rem', borderRadius: '20px' }}>
                🪪 CPF: {c.cpf || 'Não informado'}
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
                <input className="standard-input" placeholder="+55 27 99999-9999" value={formData.phone} onChange={e => setFormData({...formData, phone: formatPhone(e.target.value)})} />
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

      {selectedContact && (
        <ContactModal contact={selectedContact} onClose={() => setSelectedContact(null)} />
      )}
    </div>
  );
}
