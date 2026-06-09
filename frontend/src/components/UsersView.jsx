import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:8000';

export default function UsersView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'vendedor'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`);
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error("Erro ao buscar usuários", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) return;
    try {
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const newUser = await res.json();
      setUsers([...users, newUser]);
      closeModal();
    } catch (error) {
      console.error("Erro ao criar usuário", error);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ name: '', email: '', role: 'vendedor' });
  };

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    const name = u.name.toLowerCase();
    const email = u.email.toLowerCase();
    return name.includes(term) || email.includes(term);
  });

  if (loading) return <div style={{padding: '2rem', color: 'white'}}>Carregando Usuários...</div>;

  return (
    <div style={{ padding: '2rem', color: 'white', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Equipe / Usuários</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Pesquisar por nome ou email..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #ccc', outline: 'none', width: '300px', color: '#333' }}
          />
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>+ Criar Usuário</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', maxWidth: '800px', margin: '0 auto' }}>
        {filteredUsers.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.6)' }}>Nenhum usuário encontrado.</div>
        ) : (
          filteredUsers.map(u => (
            <div 
              key={u.id} 
              style={{ background: 'rgba(255,255,255,0.95)', color: '#333', borderRadius: '12px', padding: '1rem 1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  {u.name.substring(0, 2).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1a1a1a' }}>{u.name}</h3>
                  <div style={{ fontSize: '0.85rem', color: '#777', display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
                    <span>✉️ {u.email}</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#fff', background: '#34495e', padding: '0.4rem 0.8rem', borderRadius: '20px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                {u.role}
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal} style={{ zIndex: 1000 }}>
          <div className="modal-slider" onClick={e => e.stopPropagation()} style={{ width: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Novo Usuário</h2>
              <button className="btn-icon" onClick={closeModal}>✕</button>
            </div>
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Nome Completo *</label>
                <input className="standard-input" autoFocus placeholder="Ex: João Silva" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>E-mail *</label>
                <input className="standard-input" type="email" placeholder="joao@empresa.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Função</label>
                <select className="standard-input" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                  <option value="vendedor">Vendedor</option>
                  <option value="gerente">Gerente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn-primary" style={{ width: '100%', padding: '1rem' }} onClick={handleSave}>Salvar Usuário</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
