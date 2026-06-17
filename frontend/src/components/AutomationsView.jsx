import React, { useState, useEffect, useRef, useCallback } from 'react';
import FlowBuilderModal from './FlowBuilderModal';
import { useConfirm } from '../App';
import { useAuth } from '../AuthContext';

import { API_URL as API } from '../config.js';

const ACTION_META = {
  webhook:     { icon: '🔗', label: 'Webhook',       color: '#6366f1' },
  assign_user: { icon: '👤', label: 'Responsável',   color: '#f59e0b' },
  add_note:    { icon: '📝', label: 'Nota',           color: '#10b981' },
  set_price:   { icon: '💰', label: 'Valor',          color: '#ec4899' },
};

export default function AutomationsView({ stages, pipelineId, pipelineName, onClose }) {
  const confirm = useConfirm();
  const { token } = useAuth();
  const authFetch = useCallback((url, opts = {}) => {
    const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers };
    return fetch(url, { ...opts, headers });
  }, [token]);
  const [rules, setRules] = useState([]);
  const [users, setUsers] = useState([]);
  const [editor, setEditor] = useState(null); // { rule: null|obj, stageId, stageName }
  const importRef = useRef(null);
  const [importStatus, setImportStatus] = useState(null); // null | {ok, created, skipped, skipped_stages, error}
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    Promise.all([
      authFetch(`${API}/automations?pipeline_id=${pipelineId}`).then(r => r.json()),
      authFetch(`${API}/users`).then(r => r.json()),
    ]).then(([rs, us]) => { setRules(rs); setUsers(us); }).catch(() => {});
  }, [pipelineId]);

  const rulesFor = (stageId) => rules.filter(r => r.stage_id === stageId).sort((a, b) => a.order - b.order);

  const handleSave = async (data) => {
    const isNew = !editor.rule;
    const url = isNew ? `${API}/automations` : `${API}/automations/${editor.rule.id}`;
    const method = isNew ? 'POST' : 'PUT';
    const res = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const saved = await res.json();
    setRules(prev => isNew ? [...prev, saved] : prev.map(r => r.id === saved.id ? saved : r));
  };

  const handleDelete = async (ruleId) => {
    if (!await confirm('Excluir esta automação?', 'Esta ação não pode ser desfeita.')) return;
    await authFetch(`${API}/automations/${ruleId}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== ruleId));
  };

  const handleExport = async () => {
    try {
      const data = await authFetch(`${API}/automations/export?pipeline_id=${pipelineId}`).then(r => r.json());
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `automacoes-${(pipelineName || 'pipeline').toLowerCase().replace(/\s+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setImportStatus({ error: 'Erro ao exportar automações.' });
      setTimeout(() => setImportStatus(null), 4000);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await authFetch(`${API}/automations/import?pipeline_id=${pipelineId}&mode=append`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || 'Erro ao importar');
      setImportStatus(result);
      // Reload rules
      const updated = await authFetch(`${API}/automations?pipeline_id=${pipelineId}`).then(r => r.json());
      setRules(updated);
      setTimeout(() => setImportStatus(null), 5000);
    } catch (err) {
      setImportStatus({ error: err.message || 'Arquivo inválido ou erro no servidor.' });
      setTimeout(() => setImportStatus(null), 5000);
    } finally {
      setImporting(false);
    }
  };

  const handleToggle = async (rule) => {
    const updated = { ...rule, enabled: !rule.enabled };
    const res = await authFetch(`${API}/automations/${rule.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated)
    });
    const saved = await res.json();
    setRules(prev => prev.map(r => r.id === saved.id ? saved : r));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        padding: '14px 24px', borderBottom: '1px solid #e2e8f0',
        background: 'white', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          ← Voltar ao pipeline
        </button>
        <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>⚡ Automações</span>
          <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{pipelineName}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#94a3b8', marginRight: 4 }}>
            {rules.length} regra{rules.length !== 1 ? 's' : ''} configurada{rules.length !== 1 ? 's' : ''}
          </span>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={rules.length === 0}
            title="Exportar automações deste pipeline como JSON"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 7, border: '1px solid #e2e8f0',
              background: 'white', color: '#374151', fontSize: 12, fontWeight: 600,
              cursor: rules.length === 0 ? 'not-allowed' : 'pointer',
              opacity: rules.length === 0 ? 0.4 : 1, fontFamily: 'inherit',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v7M4 6l2.5 2.5L9 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 9.5v1A1.5 1.5 0 0 0 2.5 12h8A1.5 1.5 0 0 0 12 10.5v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Exportar
          </button>

          {/* Import button + hidden file input */}
          <input
            ref={importRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            title="Importar automações de um arquivo JSON exportado"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 7, border: '1px solid #6366f1',
              background: '#6366f1', color: 'white', fontSize: 12, fontWeight: 600,
              cursor: importing ? 'not-allowed' : 'pointer',
              opacity: importing ? 0.7 : 1, fontFamily: 'inherit',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 9V2M4 4.5 6.5 2 9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 9.5v1A1.5 1.5 0 0 0 2.5 12h8A1.5 1.5 0 0 0 12 10.5v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            {importing ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        background: '#f0fdf4', borderBottom: '1px solid #d1fae5',
        padding: '8px 24px', fontSize: 12, color: '#065f46', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <span>💡</span>
        <span>As regras são executadas automaticamente quando um negócio é <strong>movido para</strong> a etapa correspondente.</span>
      </div>

      {/* Import/Export status banner */}
      {importStatus && (
        <div style={{
          padding: '8px 24px', fontSize: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 8,
          background: importStatus.error ? '#fef2f2' : '#f0fdf4',
          borderBottom: `1px solid ${importStatus.error ? '#fca5a5' : '#bbf7d0'}`,
          color: importStatus.error ? '#dc2626' : '#15803d',
        }}>
          <span>{importStatus.error ? '✕' : '✓'}</span>
          {importStatus.error
            ? importStatus.error
            : `${importStatus.created} automação${importStatus.created !== 1 ? 'ões' : ''} importada${importStatus.created !== 1 ? 's' : ''} com sucesso${importStatus.skipped > 0 ? ` · ${importStatus.skipped} etapa(s) não encontrada(s): ${importStatus.skipped_stages.join(', ')}` : ''}`
          }
          <button onClick={() => setImportStatus(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14 }}>×</button>
        </div>
      )}

      {/* Stage columns */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: 0 }}>
        <div style={{ display: 'flex', gap: 16, padding: 24, alignItems: 'flex-start', minWidth: 'max-content' }}>
          {stages.map(stage => {
            const stageRules = rulesFor(stage.id);
            return (
              <div
                key={stage.id}
                style={{
                  width: 280, background: 'white', borderRadius: 14,
                  border: '1px solid #e2e8f0', overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Stage header */}
                <div style={{
                  padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: stage.color + '0d',
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', flex: 1 }}>{stage.name}</div>
                  <div style={{
                    background: stageRules.length > 0 ? stage.color : '#e2e8f0',
                    color: stageRules.length > 0 ? 'white' : '#94a3b8',
                    borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '2px 7px',
                  }}>
                    {stageRules.length}
                  </div>
                </div>

                {/* Rules list */}
                <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stageRules.length === 0 && (
                    <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                      Nenhuma regra configurada
                    </div>
                  )}

                  {stageRules.map(rule => {
                    const meta = ACTION_META[rule.action_type] || { icon: '⚡', label: rule.action_type, color: '#6366f1' };
                    return (
                      <div
                        key={rule.id}
                        style={{
                          background: rule.enabled ? 'white' : '#f8fafc',
                          border: `1px solid ${rule.enabled ? '#e2e8f0' : '#f1f5f9'}`,
                          borderRadius: 10, padding: '10px 12px',
                          opacity: rule.enabled ? 1 : 0.6,
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{
                            background: meta.color + '15', color: meta.color,
                            borderRadius: 6, padding: '3px 6px', fontSize: 13,
                          }}>{meta.icon}</span>
                          <div style={{ flex: 1, fontWeight: 600, fontSize: 12, color: '#0f172a', lineHeight: 1.2 }}>
                            {rule.name}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600,
                            background: meta.color + '15', color: meta.color,
                            borderRadius: 4, padding: '2px 6px',
                          }}>
                            {meta.label}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* Toggle */}
                            <button
                              onClick={() => handleToggle(rule)}
                              title={rule.enabled ? 'Desativar' : 'Ativar'}
                              style={{
                                width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
                                background: rule.enabled ? '#10b981' : '#cbd5e1',
                                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                              }}
                            >
                              <div style={{
                                position: 'absolute', top: 2,
                                left: rule.enabled ? 14 : 2,
                                width: 14, height: 14, borderRadius: '50%',
                                background: 'white', transition: 'left 0.2s',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                              }} />
                            </button>

                            <button
                              onClick={() => setEditor({ rule, stageId: stage.id, stageName: stage.name })}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, padding: 2 }}
                              title="Editar"
                            >✏️</button>

                            <button
                              onClick={() => handleDelete(rule.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, padding: 2 }}
                              title="Excluir"
                            >🗑️</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add button */}
                <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    onClick={() => setEditor({ rule: null, stageId: stage.id, stageName: stage.name })}
                    style={{
                      width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer',
                      border: '1.5px dashed #e2e8f0', background: 'transparent',
                      fontSize: 12, color: '#64748b', fontFamily: 'inherit',
                      fontWeight: 600, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#10b981'; e.currentTarget.style.background = '#f0fdf4'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Adicionar regra
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editor && (
        <FlowBuilderModal
          rule={editor.rule}
          stageId={editor.stageId}
          stageName={editor.stageName}
          pipelineId={pipelineId}
          users={users}
          onSave={handleSave}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

