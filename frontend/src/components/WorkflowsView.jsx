import React, { useState, useEffect } from 'react';
import { useConfirm } from '../App';
import FlowBuilderModal from './FlowBuilderModal';

import { API_URL as API } from '../config.js';

const ENTITY_LABELS = { deal: 'Negócio', lead: 'Lead', any: 'Qualquer' };
const ENTITY_COLORS = { deal: '#6366f1', lead: '#10b981', any: '#f59e0b' };

function getFlowNodeCount(wf) {
  if (!wf.steps || wf.steps.length === 0) return 0;
  const flowStep = wf.steps.find(s => s.action_type === 'flow');
  if (flowStep) {
    const cfg = flowStep.action_config || {};
    return cfg.steps?.length || 0;
  }
  return wf.steps.length;
}

export default function WorkflowsView() {
  const confirm = useConfirm();
  const [workflows, setWorkflows] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [builder, setBuilder] = useState(null); // null | { workflow: null|obj }
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('nexus_token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const [wRes, pRes, uRes] = await Promise.all([
        fetch(`${API}/workflows`, { headers }),
        fetch(`${API}/pipelines`, { headers }),
        fetch(`${API}/users`, { headers }),
      ]);
      const wf = await wRes.json(); setWorkflows(Array.isArray(wf) ? wf : []);
      const pp = await pRes.json(); setPipelines(Array.isArray(pp) ? pp : []);
      const uu = await uRes.json(); setAllUsers(Array.isArray(uu) ? uu : []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    const isNew = !builder?.workflow?.id;
    const url = isNew ? `${API}/workflows` : `${API}/workflows/${builder.workflow.id}`;
    const res = await fetch(url, { method: isNew ? 'POST' : 'PUT', headers, body: JSON.stringify(data) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    await load();
  };

  const handleDelete = async (wf) => {
    if (!await confirm(`Excluir o fluxo "${wf.name}"?`, 'Esta ação não pode ser desfeita.')) return;
    await fetch(`${API}/workflows/${wf.id}`, { method: 'DELETE', headers });
    load();
  };

  const toggleActive = async (wf) => {
    await fetch(`${API}/workflows/${wf.id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ ...wf, is_active: !wf.is_active, steps: wf.steps }),
    });
    load();
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ padding: '16px 28px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#0f172a' }}>⚡ Fluxos de trabalho</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
            Automações visuais executadas manualmente em um card
          </div>
        </div>
        <button onClick={() => setBuilder({ workflow: null })} className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 13 }}>
          + Novo fluxo
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>Carregando…</div>
        ) : workflows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Nenhum fluxo de trabalho</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Crie fluxos visuais para executar ações em cards com um clique</div>
            <button onClick={() => setBuilder({ workflow: null })} className="btn btn-primary" style={{ marginTop: 16, fontSize: 13 }}>
              + Criar primeiro fluxo
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 780 }}>
            {workflows.map(wf => {
              const nodeCount = getFlowNodeCount(wf);
              return (
                <div key={wf.id} style={{
                  background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
                  padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
                  opacity: wf.is_active ? 1 : 0.55,
                  transition: 'box-shadow 0.15s',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: ENTITY_COLORS[wf.entity_type] + '18',
                    color: ENTITY_COLORS[wf.entity_type],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0,
                  }}>⚡</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{wf.name}</div>
                    {wf.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{wf.description}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        background: ENTITY_COLORS[wf.entity_type] + '18',
                        color: ENTITY_COLORS[wf.entity_type],
                      }}>{ENTITY_LABELS[wf.entity_type] || wf.entity_type}</span>

                      <span style={{ fontSize: 11, color: '#64748b', padding: '2px 6px', background: '#f1f5f9', borderRadius: 8 }}>
                        {nodeCount} {nodeCount === 1 ? 'bloco' : 'blocos'}
                      </span>

                      {wf.pipeline_id && (
                        <span style={{ fontSize: 11, color: '#64748b', padding: '2px 6px', background: '#f1f5f9', borderRadius: 8 }}>
                          {pipelines.find(p => p.id === wf.pipeline_id)?.name || `Pipeline #${wf.pipeline_id}`}
                        </span>
                      )}

                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        background: wf.is_active ? '#dcfce7' : '#f1f5f9',
                        color: wf.is_active ? '#16a34a' : '#94a3b8',
                      }}>{wf.is_active ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <button onClick={() => toggleActive(wf)} title={wf.is_active ? 'Desativar' : 'Ativar'} style={{
                      width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: wf.is_active ? '#10b981' : '#e2e8f0', position: 'relative', padding: 0,
                    }}>
                      <span style={{
                        position: 'absolute', top: 2, left: wf.is_active ? 17 : 2,
                        width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                      }} />
                    </button>

                    <button
                      onClick={() => setBuilder({ workflow: wf })}
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <span style={{ fontSize: 14 }}>✏️</span> Editar no Builder
                    </button>

                    <button onClick={() => handleDelete(wf)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18, padding: '2px 4px',
                    }} title="Excluir">×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Flow Builder Modal */}
      {builder !== null && (
        <FlowBuilderModal
          mode="workflow"
          workflow={builder.workflow}
          users={allUsers}
          onSave={handleSave}
          onClose={() => setBuilder(null)}
        />
      )}
    </div>
  );
}
