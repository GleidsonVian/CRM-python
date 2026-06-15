import React, { useEffect, useState } from 'react';

const API = 'http://localhost:8001';

const avatarColor = (name) => {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

const fmtCurrency = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const roleLabel = { admin: 'Admin', gerente: 'Gerente', vendedor: 'Vendedor' };
const roleBadgeClass = { admin: 'badge badge-admin', gerente: 'badge badge-gerente', vendedor: 'badge badge-vendedor' };

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default function UserModal({ user, onClose, onUpdate, nested = false }) {
  const [deals, setDeals] = useState([]);
  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'vendedor',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${API}/cards?user_id=${user.id}`)
      .then(r => r.json())
      .then(setDeals)
      .catch(() => {});
  }, [user.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const updated = await res.json();
      if (onUpdate) onUpdate(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    finally { setSaving(false); }
  };

  const initials = form.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const color = avatarColor(form.name || user.name);

  return (
    <div className="modal-backdrop" onClick={onClose} style={nested ? { zIndex: 200 } : {}}>
      <div className={`modal-slider${nested ? ' modal-sm' : ''}`} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-top">
            <div className="modal-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: color, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 700, flexShrink: 0
              }}>
                {initials}
              </div>
              <div>
                <input
                  className="modal-title-input"
                  style={{ fontSize: 17 }}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome completo"
                />
                <div className="modal-id" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={roleBadgeClass[form.role] || 'badge'}>{roleLabel[form.role]}</span>
                  <span>· ID #{user.id}</span>
                </div>
              </div>
            </div>
            <div className="modal-header-actions">
              <button
                className="btn btn-primary"
                style={{ fontSize: 12 }}
                onClick={handleSave}
                disabled={saving}
              >
                {saved ? '✓ Salvo' : saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button className="icon-btn" onClick={onClose}><IconX /></button>
            </div>
          </div>
          <div className="modal-stages-ribbon">
            <div className="ribbon-item active">Perfil</div>
            <div className="ribbon-item">{deals.length} Negócio{deals.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <div className="modal-content-grid">
          {/* Painel esquerdo — edição */}
          <div className="modal-left">
            <div className="form-section-title">Informações do usuário</div>

            <div className="form-group">
              <label className="form-label">Nome completo *</label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: João Silva"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email *</label>
              <input
                className="form-input"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="joao@empresa.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Função</label>
              <select
                className="form-select"
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
              >
                <option value="vendedor">Vendedor</option>
                <option value="gerente">Gerente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div style={{
              marginTop: 24,
              padding: 16,
              background: 'var(--surface)',
              borderRadius: 'var(--r)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Resumo
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <div>📋 {deals.length} negócio{deals.length !== 1 ? 's' : ''} atribuído{deals.length !== 1 ? 's' : ''}</div>
                <div>💰 {fmtCurrency(deals.reduce((acc, d) => acc + (d.price || 0), 0))} em pipeline</div>
              </div>
            </div>
          </div>

          {/* Painel direito — negócios */}
          <div className="modal-right">
            <div className="timeline-header">
              Negócios responsável {deals.length > 0 && `(${deals.length})`}
            </div>

            <div className="timeline-events" style={{ padding: 14 }}>
              {deals.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', paddingTop: 24 }}>
                  Nenhum negócio atribuído.
                </div>
              ) : deals.map(d => (
                <div
                  key={d.id}
                  onClick={() => { onClose(); window.location.hash = `deal/${d.id}`; }}
                  style={{
                    background: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r)',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    marginBottom: 8,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 4 }}>
                    {fmtCurrency(d.price)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

