import React, { useState, useEffect } from 'react';
import ContactModal from './ContactModal';

const API = 'http://localhost:8000';

const avatarColor = (name) => {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  let h = 0;
  for (let i = 0; i < (name||'').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const formatPhone = (val) => {
  let v = val.replace(/\D/g, '');
  if (v.length > 13) v = v.slice(0, 13);
  if (!v) return '';
  if (v.length <= 2) return `+${v}`;
  if (v.length <= 4) return `+${v.slice(0,2)} ${v.slice(2)}`;
  if (v.length <= 9) return `+${v.slice(0,2)} ${v.slice(2,4)} ${v.slice(4)}`;
  return `+${v.slice(0,2)} ${v.slice(2,4)} ${v.slice(4,9)}-${v.slice(9)}`;
};

const emptyForm = { first_name: '', last_name: '', email: '', cpf: '', phone: '', address: '' };

export default function ContactsView() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetch(`${API}/contacts`)
      .then(r => r.json())
      .then(data => {
        setContacts(data);
        setLoading(false);
        // Se a URL já tem um ID de contato, abre automaticamente
        const hash = window.location.hash.replace(/^#/, '');
        const m = hash.match(/^contacts\/(\d+)$/);
        if (m) {
          const found = data.find(c => c.id === parseInt(m[1]));
          if (found) setSelectedContact(found);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const openContact = (c) => {
    setSelectedContact(c);
    window.history.pushState(null, '', `#contacts/${c.id}`);
  };

  const closeContact = () => {
    setSelectedContact(null);
    window.history.pushState(null, '', '#contacts');
  };

  const handleSave = async () => {
    if (!form.first_name.trim()) return;
    try {
      const res = await fetch(`${API}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const created = await res.json();
      setContacts(prev => [...prev, created]);
      setIsCreating(false);
      setForm(emptyForm);
    } catch {}
  };

  const filtered = contacts.filter(c => {
    const t = searchTerm.toLowerCase();
    return `${c.first_name} ${c.last_name || ''}`.toLowerCase().includes(t)
      || (c.email || '').toLowerCase().includes(t)
      || (c.phone || '').includes(t);
  });

  if (loading) return <div className="loading-state">Carregando contatos...</div>;

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <div className="view-title">Contatos</div>
          <div className="view-subtitle">{contacts.length} contato{contacts.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="view-controls">
          <input
            className="search-input"
            placeholder="Buscar por nome, email ou telefone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => setIsCreating(true)}>+ Novo contato</button>
        </div>
      </div>

      <div className="view-body">
        {filtered.length === 0 ? (
          <div className="empty-state">
            {searchTerm ? 'Nenhum contato encontrado.' : 'Nenhum contato cadastrado ainda.'}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Telefone</th>
                <th>CPF</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const fullName = `${c.first_name} ${c.last_name || ''}`.trim();
                const initials = fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <tr key={c.id} onClick={() => openContact(c)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar-circle" style={{ background: avatarColor(fullName) }}>
                          {initials}
                        </div>
                        <span style={{ fontWeight: 500 }}>{fullName}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.email || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.phone || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.cpf || '—'}</td>
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
              <span className="small-modal-title">Novo contato</span>
              <button className="icon-btn" onClick={() => setIsCreating(false)}><IconX /></button>
            </div>
            <div className="small-modal-body">
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input autoFocus className="form-input" placeholder="Ex: João" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Sobrenome</label>
                <input className="form-input" placeholder="Ex: Silva" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="form-input" placeholder="+55 27 99999-9999" value={form.phone} onChange={e => setForm({ ...form, phone: formatPhone(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="joao@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">CPF</label>
                <input className="form-input" placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Endereço</label>
                <input className="form-input" placeholder="Rua das Flores, 123" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
            <div className="small-modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsCreating(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>Salvar contato</button>
            </div>
          </div>
        </div>
      )}

      {selectedContact && (
        <ContactModal
          contact={selectedContact}
          onClose={closeContact}
          onUpdate={(updated) => {
            setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
            setSelectedContact(updated);
          }}
        />
      )}
    </div>
  );
}
