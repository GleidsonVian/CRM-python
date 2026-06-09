import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:8000';

export default function ContactsView() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

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
      setIsAdding(false);
      setFormData({ first_name: '', last_name: '', email: '', cpf: '', phone: '', address: '' });
    } catch (error) {
      console.error("Erro ao criar contato", error);
    }
  };

  if (loading) return <div style={{padding: '2rem', color: 'white'}}>Carregando Contatos...</div>;

  return (
    <div style={{ padding: '2rem', color: 'white', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Gestão de Contatos</h2>
        <button className="btn-primary" onClick={() => setIsAdding(true)}>+ Novo Contato</button>
      </div>

      {isAdding && (
        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
          <input className="standard-input" placeholder="Nome *" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
          <input className="standard-input" placeholder="Sobrenome" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
          <input className="standard-input" placeholder="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          <input className="standard-input" placeholder="CPF" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />
          <input className="standard-input" placeholder="Telefone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          <input className="standard-input" placeholder="Endereço" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          
          <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn-primary" onClick={handleSave}>Salvar</button>
            <button className="btn-cancel" onClick={() => setIsAdding(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#333' }}>
          <thead>
            <tr style={{ background: '#f4f5f7', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '1rem' }}>Nome Completo</th>
              <th style={{ padding: '1rem' }}>Telefone</th>
              <th style={{ padding: '1rem' }}>Email</th>
              <th style={{ padding: '1rem' }}>CPF</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center' }}>Nenhum contato cadastrado.</td></tr>
            ) : (
              contacts.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '1rem' }}><strong>{c.first_name} {c.last_name}</strong></td>
                  <td style={{ padding: '1rem' }}>{c.phone || '-'}</td>
                  <td style={{ padding: '1rem' }}>{c.email || '-'}</td>
                  <td style={{ padding: '1rem' }}>{c.cpf || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
