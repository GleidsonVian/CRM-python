import React, { useState, useEffect } from 'react';
import TasksKanban from './TasksKanban';

import { API_URL as API } from '../config.js';

const PRIVACY_META = {
  public:  { label: 'Público',  icon: '🌐', desc: 'Qualquer colaborador pode visualizar' },
  private: { label: 'Privado',  icon: '🔒', desc: 'Acesso apenas por convite' },
  hidden:  { label: 'Oculto',   icon: '🫥', desc: 'Não aparece na listagem geral' },
};

const ICONS = ['📁','📦','🚀','💡','🎯','🛠️','📊','🌟','⚙️','🔧','📱','💻','🏗️','🎨','📝'];
const COLORS = ['#6366f1','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ec4899','#ef4444','#0ea5e9','#14b8a6','#f97316'];

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('nexus_token')}` });

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso.includes('Z') ? iso : iso + 'Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
}

// ── Project form modal ────────────────────────────────────────────────────────
function ProjectModal({ project, users, onClose, onSave }) {
  const isNew = !project?.id;
  const [step, setStep] = useState(0); // 0=info, 1=privacy, 2=members
  const [name, setName]     = useState(project?.name || '');
  const [desc, setDesc]     = useState(project?.description || '');
  const [icon, setIcon]     = useState(project?.icon || '📁');
  const [color, setColor]   = useState(project?.theme_color || '#6366f1');
  const [privacy, setPrivacy] = useState(project?.privacy || 'public');
  const [ownerId, setOwnerId] = useState(project?.owner_id || '');
  const [memberIds, setMemberIds] = useState(
    (project?.members || []).filter(m => m.role === 'member').map(m => m.user_id)
  );
  const [moderatorIds, setModeratorIds] = useState(
    (project?.members || []).filter(m => m.role === 'moderator').map(m => m.user_id)
  );
  const [saving, setSaving] = useState(false);

  const toggleMember = (uid) => setMemberIds(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);
  const toggleModerator = (uid) => setModeratorIds(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: desc, icon, theme_color: color, privacy, owner_id: ownerId ? parseInt(ownerId) : null, member_ids: memberIds, moderator_ids: moderatorIds };
      const url = isNew ? `${API}/projects` : `${API}/projects/${project.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const result = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(payload) }).then(r => r.json());
      onSave(result);
      onClose();
    } finally { setSaving(false); }
  };

  const steps = [
    { label: 'Info', icon: '📝' },
    { label: 'Privacidade', icon: '🔒' },
    { label: 'Membros', icon: '👥' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: 560, background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        {/* Step bar */}
        <div style={{ background: color, padding: '20px 24px 0', display: 'flex', gap: 0 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
          <div style={{ marginLeft: 12, flex: 1 }}>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{name || (isNew ? 'Novo projeto' : 'Editar projeto')}</div>
            <div style={{ display: 'flex', gap: 0, marginTop: 10 }}>
              {steps.map((s, i) => (
                <button key={i} onClick={() => setStep(i)}
                  style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit', background: step === i ? 'white' : 'transparent', color: step === i ? color : 'rgba(255,255,255,0.7)', borderRadius: '6px 6px 0 0', transition: 'all 0.15s' }}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step 0: Info */}
        {step === 0 && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Nome do projeto *</label>
              <input autoFocus style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                value={name} onChange={e => setName(e.target.value)} placeholder="Nome do projeto..." />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Descrição</label>
              <textarea style={{ width: '100%', minHeight: 60, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                value={desc} onChange={e => setDesc(e.target.value)} placeholder="Objetivo do projeto..." />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Ícone</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => setIcon(ic)} style={{ width: 36, height: 36, borderRadius: 8, border: `2px solid ${icon === ic ? color : '#e2e8f0'}`, background: icon === ic ? color + '15' : 'white', cursor: 'pointer', fontSize: 18 }}>{ic}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Cor do tema</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: color === c ? `3px solid #0f172a` : '3px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Privacy */}
        {step === 1 && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Defina quem pode ver e participar deste projeto.</div>
            {Object.entries(PRIVACY_META).map(([key, meta]) => (
              <button key={key} onClick={() => setPrivacy(key)}
                style={{ padding: '14px 16px', borderRadius: 10, border: `2px solid ${privacy === key ? color : '#e2e8f0'}`, background: privacy === key ? color + '08' : 'white', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.12s', fontFamily: 'inherit' }}>
                <span style={{ fontSize: 22 }}>{meta.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: privacy === key ? color : '#0f172a' }}>{meta.label}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{meta.desc}</div>
                </div>
                {privacy === key && <span style={{ marginLeft: 'auto', color, fontWeight: 700 }}>✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Members */}
        {step === 2 && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Gerente do projeto</label>
              <select style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                value={ownerId} onChange={e => setOwnerId(e.target.value)}>
                <option value="">Sem gerente</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Moderadores</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px' }}>
                {users.filter(u => u.id !== parseInt(ownerId)).map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, background: moderatorIds.includes(u.id) ? color + '12' : 'transparent' }}>
                    <input type="checkbox" checked={moderatorIds.includes(u.id)} onChange={() => toggleModerator(u.id)} />
                    <span style={{ fontSize: 13 }}>{u.name}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{u.email}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Membros da equipe</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px' }}>
                {users.filter(u => u.id !== parseInt(ownerId) && !moderatorIds.includes(u.id)).map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, background: memberIds.includes(u.id) ? color + '12' : 'transparent' }}>
                    <input type="checkbox" checked={memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} />
                    <span style={{ fontSize: 13 }}>{u.name}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{u.email}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', background: '#f8fafc' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && <button onClick={() => setStep(step - 1)} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Voltar</button>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancelar</button>
            {step < 2 ? (
              <button onClick={() => setStep(step + 1)} disabled={!name.trim()}
                style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: color, color: 'white', cursor: name.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: name.trim() ? 1 : 0.5 }}>
                Próximo →
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving || !name.trim()}
                style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: color, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                {saving ? 'Salvando...' : isNew ? 'Criar projeto' : 'Salvar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function ProjectsView() {
  const [projects, setProjects] = useState([]);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null); // null | {} (new) | project
  const [openProject, setOpenProject] = useState(null); // show tasks of this project

  const fetchAll = async () => {
    setLoading(true);
    const [projs, us] = await Promise.all([
      fetch(`${API}/projects`, { headers: authHeader() }).then(r => r.json()).catch(() => []),
      fetch(`${API}/users`, { headers: authHeader() }).then(r => r.json()).catch(() => []),
    ]);
    setProjects(Array.isArray(projs) ? projs : []);
    setUsers(Array.isArray(us) ? us : []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSaveProject = (proj) => {
    setProjects(prev => {
      const idx = prev.findIndex(p => p.id === proj.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = proj; return n; }
      return [proj, ...prev];
    });
  };

  const handleDeleteProject = async (proj) => {
    if (!window.confirm(`Excluir o projeto "${proj.name}"? As tarefas não serão excluídas.`)) return;
    await fetch(`${API}/projects/${proj.id}`, { method: 'DELETE', headers: authHeader() });
    setProjects(prev => prev.filter(p => p.id !== proj.id));
    if (openProject?.id === proj.id) setOpenProject(null);
  };

  if (openProject) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Sub-header */}
        <div style={{ padding: '10px 20px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={() => setOpenProject(null)}
            style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: '#64748b', fontFamily: 'inherit' }}>
            ← Projetos
          </button>
          <span style={{ fontSize: 20 }}>{openProject.icon}</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: openProject.theme_color }}>{openProject.name}</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{PRIVACY_META[openProject.privacy]?.icon} {PRIVACY_META[openProject.privacy]?.label}</span>
          <button onClick={() => setEditing(openProject)} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: '#64748b', fontFamily: 'inherit' }}>
            ✏ Editar
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <TasksKanban projectId={openProject.id} />
        </div>
        {editing && <ProjectModal project={editing} users={users} onClose={() => setEditing(null)} onSave={p => { handleSaveProject(p); setOpenProject(p); }} />}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>📁 Projetos</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{projects.length} projeto{projects.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={fetchAll} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: '#64748b', fontFamily: 'inherit' }}>↻</button>
          <button onClick={() => setEditing({})}
            style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Criar projeto
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: '40px 0' }}>Carregando...</div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nenhum projeto ainda</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Crie seu primeiro projeto para organizar tarefas em equipe.</div>
            <button onClick={() => setEditing({})} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Criar projeto
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {projects.map(proj => {
              const memberCount = (proj.members || []).length;
              const ownerUser = users.find(u => u.id === proj.owner_id);
              return (
                <div key={proj.id}
                  style={{ background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                  onClick={() => setOpenProject(proj)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = proj.theme_color; e.currentTarget.style.boxShadow = `0 4px 20px ${proj.theme_color}25`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = ''; }}>
                  {/* Color header */}
                  <div style={{ height: 6, background: proj.theme_color }} />
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: proj.theme_color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                        {proj.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proj.name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                          {PRIVACY_META[proj.privacy]?.icon} {PRIVACY_META[proj.privacy]?.label}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEditing(proj)} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: '#64748b', fontFamily: 'inherit' }}>✏</button>
                        <button onClick={() => handleDeleteProject(proj)} style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: '#ef4444', fontFamily: 'inherit' }}>✕</button>
                      </div>
                    </div>

                    {proj.description && (
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {proj.description}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#94a3b8' }}>
                      <span>📋 {proj.task_count || 0} tarefa{proj.task_count !== 1 ? 's' : ''}</span>
                      <span>👥 {memberCount} membro{memberCount !== 1 ? 's' : ''}</span>
                      {ownerUser && <span style={{ marginLeft: 'auto' }}>por {ownerUser.name.split(' ')[0]}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <ProjectModal project={editing} users={users} onClose={() => setEditing(null)} onSave={handleSaveProject} />
      )}
    </div>
  );
}
