import React, { useState, useEffect } from 'react';

const API = 'http://localhost:8001';

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#3b82f6','#06b6d4','#64748b'];

// ── Permission schema ─────────────────────────────────────────────────────────
const ENTITY_SECTIONS = [
  {
    key: 'contact', label: 'Contato', icon: '👤',
    actions: [
      { key: 'read',   label: 'Ler',       opts: ['own','all','deny'] },
      { key: 'add',    label: 'Adicionar', opts: ['all','deny'] },
      { key: 'edit',   label: 'Editar',    opts: ['own','all','deny'] },
      { key: 'delete', label: 'Excluir',   opts: ['own','all','deny'] },
      { key: 'export', label: 'Exportar',  opts: ['all','deny'] },
      { key: 'import', label: 'Importar',  opts: ['all','deny'] },
    ],
  },
  {
    key: 'company', label: 'Empresa', icon: '🏢',
    actions: [
      { key: 'read',   label: 'Ler',       opts: ['own','all','deny'] },
      { key: 'add',    label: 'Adicionar', opts: ['all','deny'] },
      { key: 'edit',   label: 'Editar',    opts: ['own','all','deny'] },
      { key: 'delete', label: 'Excluir',   opts: ['own','all','deny'] },
      { key: 'export', label: 'Exportar',  opts: ['all','deny'] },
      { key: 'import', label: 'Importar',  opts: ['all','deny'] },
    ],
  },
  {
    key: 'lead', label: 'Lead', icon: '🎯',
    actions: [
      { key: 'read',       label: 'Ler',                opts: ['own','all','deny'] },
      { key: 'add',        label: 'Adicionar',          opts: ['all','deny'] },
      { key: 'edit',       label: 'Editar',             opts: ['own','all','deny'] },
      { key: 'delete',     label: 'Excluir',            opts: ['own','all','deny'] },
      { key: 'export',     label: 'Exportar',           opts: ['all','deny'] },
      { key: 'import',     label: 'Importar',           opts: ['all','deny'] },
      { key: 'move_stage', label: 'Mover etapa',        opts: ['any','deny'] },
      { key: 'view_price', label: 'Ver valor (R$)',     opts: ['show','hide'] },
      { key: 'automations',label: 'Automações',         opts: ['edit','read','deny'] },
    ],
  },
  {
    key: 'deal', label: 'Negócio', icon: '💼',
    actions: [
      { key: 'read',       label: 'Ler',                opts: ['own','all','deny'] },
      { key: 'add',        label: 'Adicionar',          opts: ['all','deny'] },
      { key: 'edit',       label: 'Editar',             opts: ['own','all','deny'] },
      { key: 'delete',     label: 'Excluir',            opts: ['own','all','deny'] },
      { key: 'export',     label: 'Exportar',           opts: ['all','deny'] },
      { key: 'import',     label: 'Importar',           opts: ['all','deny'] },
      { key: 'move_stage', label: 'Mover etapa',        opts: ['any','deny'] },
      { key: 'view_price', label: 'Ver valor (R$)',     opts: ['show','hide'] },
      { key: 'automations',label: 'Automações',         opts: ['edit','read','deny'] },
    ],
  },
];

const SYSTEM_PERMS = [
  { key: 'manage_pipelines', label: 'Gerenciar funis e etapas', desc: 'Criar, renomear e excluir funis/etapas' },
  { key: 'manage_users',     label: 'Gerenciar equipe',          desc: 'Convidar, editar e remover usuários' },
  { key: 'view_reports',     label: 'Visualizar relatórios',     desc: 'Acesso à aba de Relatórios' },
  { key: 'manage_settings',  label: 'Configurações do sistema',  desc: 'Campos personalizados e configurações' },
];

const OPT_LABELS = {
  own: 'Próprios', all: 'Todos', deny: 'Negar', any: 'Qualquer', show: 'Mostrar', hide: 'Ocultar', edit: 'Editar', read: 'Ler',
};
const OPT_COLORS = {
  own: '#3b82f6', all: '#10b981', deny: '#ef4444', any: '#6366f1', show: '#10b981', hide: '#f59e0b', edit: '#6366f1', read: '#3b82f6',
};

const DEFAULT_ENTITY_PERMS = (hasExtra) => ({
  read: 'all', add: 'all', edit: 'all', delete: 'all', export: 'all', import: 'all',
  ...(hasExtra ? { move_stage: 'any', view_price: 'show', automations: 'edit' } : {}),
});

const DEFAULT_PERMISSIONS = {
  entities: {
    contact: DEFAULT_ENTITY_PERMS(false),
    company: DEFAULT_ENTITY_PERMS(false),
    lead:    DEFAULT_ENTITY_PERMS(true),
    deal:    DEFAULT_ENTITY_PERMS(true),
  },
  system: { manage_pipelines: false, manage_users: false, view_reports: true, manage_settings: false },
};

function parsePerms(raw) {
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
    if (p.entities) return p;
    // Migrate legacy v1 flat format
    const vs = p.view_scope === 'own' ? 'own' : 'all';
    return {
      entities: {
        contact: DEFAULT_ENTITY_PERMS(false),
        company: DEFAULT_ENTITY_PERMS(false),
        lead:    { ...DEFAULT_ENTITY_PERMS(true), read: vs, edit: vs, delete: p.can_delete_cards ? 'all' : 'deny' },
        deal:    { ...DEFAULT_ENTITY_PERMS(true), read: vs, edit: vs, delete: p.can_delete_cards ? 'all' : 'deny' },
      },
      system: {
        manage_pipelines: p.can_manage_pipeline || false,
        manage_users: false,
        view_reports: p.can_view_reports !== false,
        manage_settings: false,
      },
    };
  } catch { return DEFAULT_PERMISSIONS; }
}

// ── Permission value pill ─────────────────────────────────────────────────────
function PermSelect({ value, opts, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      style={{
        fontSize: 11, fontWeight: 600, padding: '3px 6px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: (OPT_COLORS[value] || '#64748b') + '18',
        color: OPT_COLORS[value] || '#64748b',
        outline: 'none', appearance: 'none', WebkitAppearance: 'none',
        paddingRight: 18, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center',
      }}
    >
      {opts.map(o => <option key={o} value={o}>{OPT_LABELS[o] || o}</option>)}
    </select>
  );
}

// ── Role Editor Modal ─────────────────────────────────────────────────────────
function RoleEditor({ role, users, allUsers, onSave, onClose, onDelete }) {
  const isNew = !role?.id;
  const [name, setName]               = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [color, setColor]             = useState(role?.color || '#6366f1');
  const [perms, setPerms]             = useState(() => parsePerms(role?.permissions));
  const [members, setMembers]         = useState(users || []);
  const [saving, setSaving]           = useState(false);
  const [tab, setTab]                 = useState('permissions');
  const [expanded, setExpanded]       = useState({ contact: true, company: true, lead: true, deal: true });
  const token = localStorage.getItem('nexus_token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const setEntityPerm = (entity, action, val) =>
    setPerms(p => ({ ...p, entities: { ...p.entities, [entity]: { ...p.entities[entity], [action]: val } } }));

  const setSysPerm = (key, val) =>
    setPerms(p => ({ ...p, system: { ...p.system, [key]: val } }));

  const toggleSection = (k) => setExpanded(e => ({ ...e, [k]: !e[k] }));

  const addMember = async (userId) => {
    if (members.find(m => m.id === userId)) return;
    await fetch(`${API}/users/${userId}/role`, { method: 'PUT', headers, body: JSON.stringify({ role_id: role?.id }) });
    const u = allUsers.find(u => u.id === userId);
    if (u) setMembers(prev => [...prev, u]);
  };

  const removeMember = async (userId) => {
    await fetch(`${API}/users/${userId}/role`, { method: 'PUT', headers, body: JSON.stringify({ role_id: null }) });
    setMembers(prev => prev.filter(m => m.id !== userId));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), description, color, permissions: JSON.stringify(perms) });
    setSaving(false);
  };

  const nonMembers = allUsers.filter(u => !members.find(m => m.id === u.id));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 16, width: 640, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 17, flexShrink: 0 }}>
            {name ? name[0].toUpperCase() : '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do cargo" style={{ width: '100%', border: 'none', outline: 'none', fontSize: 16, fontWeight: 700, color: '#0f172a', background: 'transparent', padding: 0 }} />
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição (opcional)" style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, color: '#64748b', background: 'transparent', padding: 0, marginTop: 1 }} />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 22, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Color + tabs */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', gap: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>Cor:</span>
            {COLORS.map(c => (
              <div key={c} onClick={() => setColor(c)} style={{ width: 18, height: 18, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '2px solid #0f172a' : '2px solid transparent', boxSizing: 'border-box' }} />
            ))}
          </div>
          <div style={{ display: 'flex', marginLeft: 'auto', gap: 0 }}>
            {['permissions','members'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '5px 14px', border: 'none', cursor: 'pointer', background: tab === t ? 'white' : 'transparent', fontWeight: tab === t ? 600 : 400, color: tab === t ? '#6366f1' : '#64748b', borderRadius: 8, fontSize: 12, borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent' }}>
                {t === 'permissions' ? 'Permissões' : `Membros (${members.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {tab === 'permissions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Entity sections */}
              {ENTITY_SECTIONS.map(sec => (
                <div key={sec.key} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                  <div onClick={() => toggleSection(sec.key)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f8fafc', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ fontSize: 16 }}>{sec.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{sec.label}</span>
                    <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 12 }}>{expanded[sec.key] ? '▲' : '▼'}</span>
                  </div>
                  {expanded[sec.key] && (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {sec.actions.map(act => (
                          <tr key={act.key} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '7px 14px', fontSize: 12, color: '#475569', width: '50%' }}>{act.label}</td>
                            <td style={{ padding: '6px 14px' }}>
                              <PermSelect
                                value={perms.entities?.[sec.key]?.[act.key] ?? act.opts[0]}
                                opts={act.opts}
                                onChange={val => setEntityPerm(sec.key, act.key, val)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}

              {/* System permissions */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginTop: 4 }}>
                <div style={{ padding: '10px 14px', background: '#f8fafc', fontWeight: 700, fontSize: 13, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>⚙️</span> Sistema
                </div>
                {SYSTEM_PERMS.map(sp => (
                  <div key={sp.key} onClick={() => setSysPerm(sp.key, !perms.system?.[sp.key])} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderTop: '1px solid #f1f5f9', cursor: 'pointer', background: perms.system?.[sp.key] ? '#f0fdf4' : 'white', transition: 'background 0.1s' }}>
                    <div style={{ width: 36, height: 20, borderRadius: 10, background: perms.system?.[sp.key] ? '#10b981' : '#e2e8f0', position: 'relative', flexShrink: 0, transition: 'all 0.15s' }}>
                      <span style={{ position: 'absolute', top: 2, left: perms.system?.[sp.key] ? 17 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{sp.label}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{sp.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'members' && (
            <div>
              {members.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Nenhum membro nesta função</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {members.map(u => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{(u.name||'?')[0].toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{u.email}</div>
                      </div>
                      {!isNew && <button onClick={() => removeMember(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18, lineHeight: 1 }}>×</button>}
                    </div>
                  ))}
                </div>
              )}
              {!isNew && nonMembers.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Adicionar membro</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {nonMembers.map(u => (
                      <div key={u.id} onClick={() => addMember(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 700, fontSize: 12 }}>{(u.name||'?')[0].toUpperCase()}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: '#0f172a' }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{u.email}</div>
                        </div>
                        <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>+ Adicionar</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {isNew && <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>Salve o cargo primeiro para adicionar membros</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            {!isNew && <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>Excluir cargo</button>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: 13 }}>Cancelar</button>
            <button onClick={handleSave} className="btn btn-primary" style={{ fontSize: 13 }} disabled={saving || !name.trim()}>
              {saving ? 'Salvando…' : isNew ? 'Criar cargo' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function RolesView() {
  const [roles, setRoles]     = useState([]);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor]   = useState(null);
  const token = localStorage.getItem('nexus_token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    const [rRes, uRes] = await Promise.all([
      fetch(`${API}/roles`, { headers }),
      fetch(`${API}/users`, { headers }),
    ]);
    setRoles(Array.isArray(await rRes.json()) ? await rRes.clone().json() : []);
    setUsers(Array.isArray(await uRes.json()) ? await uRes.clone().json() : []);
    setLoading(false);
  };

  // fetch once properly
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [rRes, uRes] = await Promise.all([
          fetch(`${API}/roles`, { headers }),
          fetch(`${API}/users`, { headers }),
        ]);
        const rData = await rRes.json(); setRoles(Array.isArray(rData) ? rData : []);
        const uData = await uRes.json(); setUsers(Array.isArray(uData) ? uData : []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const reload = async () => {
    try {
      const [rRes, uRes] = await Promise.all([
        fetch(`${API}/roles`, { headers }),
        fetch(`${API}/users`, { headers }),
      ]);
      const rData = await rRes.json(); setRoles(Array.isArray(rData) ? rData : []);
      const uData = await uRes.json(); setUsers(Array.isArray(uData) ? uData : []);
    } catch {}
  };

  const openRole = (role) => {
    const members = users.filter(u => u.role_id === role.id);
    setEditor({ role, members });
  };

  const handleSave = async (data) => {
    const isNew = !editor?.role?.id;
    const url = isNew ? `${API}/roles` : `${API}/roles/${editor.role.id}`;
    const res = await fetch(url, { method: isNew ? 'POST' : 'PUT', headers, body: JSON.stringify(data) });
    if (!res.ok) return;
    const saved = await res.json();
    await reload();
    if (isNew) {
      setEditor({ role: saved, members: [] });
    } else {
      setEditor(null);
    }
  };

  const handleDelete = async () => {
    if (!editor?.role?.id) return;
    if (!window.confirm(`Excluir o cargo "${editor.role.name}"?`)) return;
    await fetch(`${API}/roles/${editor.role.id}`, { method: 'DELETE', headers });
    setEditor(null);
    reload();
  };

  const getMemberCount = (roleId) => users.filter(u => u.role_id === roleId).length;

  const permsOf = (role) => {
    try { return parsePerms(role.permissions); } catch { return DEFAULT_PERMISSIONS; }
  };

  const summarize = (p) => {
    const e = p.entities || {};
    const dealRead = e.deal?.read || 'all';
    const leadRead = e.lead?.read || 'all';
    return { dealRead, leadRead, sys: p.system || {} };
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <div style={{ padding: '16px 28px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#0f172a' }}>🏷 Cargos e Permissões</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>Defina permissões granulares por cargo e atribua membros da equipe</div>
        </div>
        <button onClick={() => setEditor({ role: null, members: [] })} className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 13 }}>
          + Novo cargo
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>Carregando…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14, maxWidth: 1000 }}>
            {roles.map(role => {
              const mc = getMemberCount(role.id);
              const p = permsOf(role);
              const s = summarize(p);
              return (
                <div key={role.id} onClick={() => openRole(role)} style={{
                  background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px',
                  cursor: 'pointer', transition: 'box-shadow 0.15s',
                  borderTop: `4px solid ${role.color || '#6366f1'}`,
                }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: role.color || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16 }}>
                      {(role.name||'?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{role.name}</div>
                      {role.description && <div style={{ fontSize: 11, color: '#64748b' }}>{role.description}</div>}
                    </div>
                  </div>

                  {/* Quick summary */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                    {[
                      { label: `Negócios: ${OPT_LABELS[s.dealRead] || s.dealRead}`, color: OPT_COLORS[s.dealRead] },
                      { label: `Leads: ${OPT_LABELS[s.leadRead] || s.leadRead}`, color: OPT_COLORS[s.leadRead] },
                      s.sys.manage_pipelines && { label: 'Gerencia funis', color: '#6366f1' },
                      s.sys.view_reports     && { label: 'Relatórios', color: '#10b981' },
                      s.sys.manage_users     && { label: 'Gerencia equipe', color: '#f59e0b' },
                    ].filter(Boolean).map((badge, i) => (
                      <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 600, background: (badge.color || '#64748b') + '18', color: badge.color || '#64748b' }}>
                        {badge.label}
                      </span>
                    ))}
                  </div>

                  {/* Members */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ display: 'flex' }}>
                      {users.filter(u => u.role_id === role.id).slice(0, 5).map((m, i) => (
                        <div key={m.id} title={m.name} style={{ width: 24, height: 24, borderRadius: '50%', background: role.color || '#6366f1', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 10, marginLeft: i > 0 ? -8 : 0 }}>
                          {(m.name||'?')[0].toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      {mc === 0 ? 'Sem membros' : `${mc} membro${mc !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                </div>
              );
            })}

            {roles.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: '#94a3b8' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🏷</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Nenhum cargo criado</div>
                <button onClick={() => setEditor({ role: null, members: [] })} className="btn btn-primary" style={{ marginTop: 12, fontSize: 13 }}>+ Criar primeiro cargo</button>
              </div>
            )}
          </div>
        )}
      </div>

      {editor !== null && (
        <RoleEditor
          role={editor.role}
          users={editor.members}
          allUsers={users}
          onSave={handleSave}
          onClose={() => setEditor(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
