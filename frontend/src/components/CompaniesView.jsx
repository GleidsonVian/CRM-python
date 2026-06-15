import React, { useState, useEffect } from 'react';
import CompanyModal from './CompanyModal';

const API = 'http://localhost:8001';

const avatarColor = (name) => {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

const fmtCurrency = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const COMPANY_TYPES = ['Cliente', 'Parceiro', 'Fornecedor', 'Concorrente', 'Integrador', 'Outros'];
const INDUSTRIES = [
  'Tecnologia da Informação', 'Finanças', 'Saúde', 'Educação', 'Varejo', 'Indústria',
  'Imobiliário', 'Serviços', 'Mídia', 'Telecomunicações', 'Governo', 'Outros',
];

const emptyForm = {
  name: '', company_number: '', company_type: '', industry: '',
  phone: '', email: '', website: '',
};

export default function CompaniesView() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetch(`${API}/companies`)
      .then(r => r.json())
      .then(data => {
        setCompanies(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const openCompany = (c) => setSelectedCompany(c);
  const closeCompany = () => setSelectedCompany(null);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      const res = await fetch(`${API}/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, annual_revenue: 0, contact_ids: [] }),
      });
      const created = await res.json();
      setCompanies(prev => [...prev, created]);
      setIsCreating(false);
      setForm(emptyForm);
    } catch {}
  };

  const filtered = companies.filter(c => {
    const t = searchTerm.toLowerCase();
    return (c.name || '').toLowerCase().includes(t)
      || (c.industry || '').toLowerCase().includes(t)
      || (c.company_type || '').toLowerCase().includes(t)
      || (c.email || '').toLowerCase().includes(t);
  });

  if (loading) return <div className="loading-state">Carregando empresas...</div>;

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <div className="view-title">Empresas</div>
          <div className="view-subtitle">{companies.length} empresa{companies.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="view-controls">
          <input
            className="search-input"
            placeholder="Buscar por nome, indústria ou email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => setIsCreating(true)}>+ Nova empresa</button>
        </div>
      </div>

      <div className="view-body">
        {filtered.length === 0 ? (
          <div className="empty-state">
            {searchTerm ? 'Nenhuma empresa encontrada.' : 'Nenhuma empresa cadastrada ainda.'}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Indústria</th>
                <th>Tipo</th>
                <th>Receita anual</th>
                <th>Telefone</th>
                <th>Email</th>
                <th>Contatos</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const initials = (c.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <tr key={c.id} onClick={() => openCompany(c)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 6,
                          background: c.logo_url ? 'transparent' : avatarColor(c.name),
                          color: 'white', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 11, fontWeight: 700,
                          overflow: 'hidden', flexShrink: 0,
                        }}>
                          {c.logo_url
                            ? <img src={c.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            : initials}
                        </div>
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.industry || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {c.company_type ? (
                        <span style={{
                          background: '#f1f5f9', borderRadius: 4, padding: '2px 7px',
                          fontSize: 11, fontWeight: 500,
                        }}>{c.company_type}</span>
                      ) : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontWeight: c.annual_revenue > 0 ? 500 : 400 }}>
                      {c.annual_revenue > 0 ? fmtCurrency(c.annual_revenue) : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.phone || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.email || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {(c.contacts || []).length > 0 ? (
                        <span style={{ fontSize: 12 }}>{c.contacts.length}</span>
                      ) : '—'}
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
              <span className="small-modal-title">Nova empresa</span>
              <button className="icon-btn" onClick={() => setIsCreating(false)}><IconX /></button>
            </div>
            <div className="small-modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div className="form-group" style={{ gridColumn: '1/3' }}>
                <label className="form-label">Nome da empresa *</label>
                <input autoFocus className="form-input" placeholder="Ex: Acme Ltda"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-input" value={form.company_type}
                  onChange={e => setForm({ ...form, company_type: e.target.value })}>
                  <option value="">—</option>
                  {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Indústria</label>
                <select className="form-input" value={form.industry}
                  onChange={e => setForm({ ...form, industry: e.target.value })}>
                  <option value="">—</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="form-input" placeholder="+55" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="contato@empresa.com"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: '1/3' }}>
                <label className="form-label">Website</label>
                <input className="form-input" placeholder="https://"
                  value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
              </div>
            </div>
            <div className="small-modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsCreating(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>Salvar empresa</button>
            </div>
          </div>
        </div>
      )}

      {selectedCompany && (
        <CompanyModal
          company={selectedCompany}
          onClose={closeCompany}
          onUpdate={(updated) => {
            setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c));
            setSelectedCompany(updated);
          }}
          onDelete={(id) => setCompanies(prev => prev.filter(c => c.id !== id))}
        />
      )}
    </div>
  );
}

