import React, { useState, useEffect } from 'react';
import UserModal from './UserModal';

const API = 'http://localhost:8002';

const avatarColor = (name) => {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  let h = 0;
  for (let i = 0; i < (name||'').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

const roleLabel = { admin: 'Admin', gerente: 'Gerente', vendedor: 'Vendedor' };
const roleBadgeClass = { admin: 'badge badge-admin', gerente: 'badge badge-gerente', vendedor: 'badge badge-vendedor' };

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const emptyForm = { name: '', email: '', role: 'vendedor' };

export default function UsersView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetch(`${API}/users`)
      .then(r => r.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
        const hash = window.location.hash.replace(/^#/, '');
        const m = hash.match(/^users\/(\d+)$/);
        if (m) {
          const found = data.find(u => u.id === parseInt(m[1]));
          if (found) setSelectedUser(found);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const openUser = (u) => {
    setSelectedUser(u);
    window.history.pushState(null, '', `#users/${u.id}`);
  };

  const closeUser = () => {
    setSelectedUser(null);
    window.history.pushState(null, '', '#users');
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    try {
      const res = await fetch(`${API}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const created = await res.json();
      setUsers(prev => [...prev, created]);
      setIsCreating(false);
      setForm(emptyForm);
    } catch {}
  };

  const filtered = users.filter(u => {
    const t = searchTerm.toLowerCase();
    return u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t);
  });

  if (loading) return <div className="loading-state">Carregando equipe...</div>;

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <div className="view-title">Equipe</div>
          <div className="view-subtitle">{users.length} usuário{users.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="view-controls">
          <input
            className="search-input"
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => setIsCreating(true)}>+ Novo usuário</button>
        </div>
      </div>

      <div className="view-body">
        {filtered.length === 0 ? (
          <div className="empty-state">
            {searchTerm ? 'Nenhum usuário encontrado.' : 'Nenhum usuário cadastrado ainda.'}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Função</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const initials = u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <tr key={u.id} onClick={() => openUser(u)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar-circle" style={{ background: avatarColor(u.name) }}>
                          {initials}
                        </div>
                        <span style={{ fontWeight: 500 }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td>
                      <span className={roleBadgeClass[u.role] || 'badge'}>
                        {roleLabel[u.role] || u.role}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {isCreating && (
        <div className="overlay" onClick={() => setIsCreating(false)}>
          <div className="small-modal" onClick={e => e.stopPropagation()}>
            <div className="small-modal-header">
              <span className="small-modal-title">Novo usuário</span>
              <button className="icon-btn" onClick={() => setIsCreating(false)}><IconX /></button>
            </div>
            <div className="small-modal-body">
              <div className="form-group">
                <label className="form-label">Nome completo *</label>
                <input autoFocus className="form-input" placeholder="Ex: João Silva" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" placeholder="joao@empresa.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Função</label>
                <select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="vendedor">Vendedor</option>
                  <option value="gerente">Gerente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div className="small-modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsCreating(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>Salvar usuário</button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <UserModal
          user={selectedUser}
          onClose={closeUser}
          onUpdate={(updated) => {
            setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
            setSelectedUser(updated);
          }}
        />
      )}
    </div>
  );
}

