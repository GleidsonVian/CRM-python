import React, { useState, useEffect, useRef } from 'react';

import { API_URL as API } from '../config.js';

const FIELD_TYPES = [
  { value: 'text',       label: 'Texto',       icon: 'T'  },
  { value: 'number',     label: 'Número',      icon: '#'  },
  { value: 'currency',   label: 'Moeda',       icon: 'R$' },
  { value: 'date',       label: 'Data',        icon: '📅' },
  { value: 'checkbox',   label: 'Sim/Não',     icon: '☑'  },
  { value: 'select',     label: 'Lista',       icon: '▾'  },
  { value: 'textarea',   label: 'Texto longo', icon: '¶'  },
  { value: 'url',        label: 'URL',         icon: '🔗' },
  { value: 'email',      label: 'E-mail',      icon: '@'  },
  { value: 'phone',      label: 'Telefone',    icon: '📞' },
  { value: 'attachment', label: 'Anexo',       icon: '📎' },
];

function slugify(str) {
  return str.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
}

function Toggle({ on, onToggle, color = '#10b981' }) {
  return (
    <div onClick={onToggle} style={{
      width: 34, height: 18, borderRadius: 9, flexShrink: 0, cursor: 'pointer',
      background: on ? color : '#cbd5e1', position: 'relative', transition: 'background 0.18s',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 14, height: 14, borderRadius: '50%',
        background: 'white', transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  );
}

export default function FieldPickerModal({
  entity,
  stages = [],
  pipelineId = null,
  pipelineFieldConfigs: initialConfigs = [],
  onClose,
  onFieldsChanged,
}) {
  const [fields, setFields] = useState([]);
  const [tab, setTab] = useState('manage');
  const [saving, setSaving] = useState({});

  // Per-pipeline configs: field_id -> config object
  const [pfcMap, setPfcMap] = useState(() => {
    const m = {};
    const safe = Array.isArray(initialConfigs) ? initialConfigs : [];
    for (const c of safe) m[c.field_id] = c;
    return m;
  });

  // Sections list (ordered). Initialised from configs.
  const [sectionNames, setSectionNames] = useState(() => {
    const safe = Array.isArray(initialConfigs) ? initialConfigs : [];
    const seen = new Set();
    const out = [];
    for (const c of safe) {
      if (c.section && !seen.has(c.section)) { seen.add(c.section); out.push(c.section); }
    }
    return out;
  });
  const [addingSectionName, setAddingSectionName] = useState('');
  const [addingSection, setAddingSection]         = useState(false);
  const [renamingSection, setRenamingSection]     = useState(null); // section name being renamed
  const [renameDraft, setRenameDraft]             = useState('');

  // Drag state
  const [dragFieldId, setDragFieldId]         = useState(null);
  const [dragOverSection, setDragOverSection] = useState(null); // section name or null

  // Expanded stage-gate panel per field
  const [expandedField, setExpandedField] = useState(null);

  // Create tab
  const [newName, setNewName]       = useState('');
  const [newType, setNewType]       = useState('text');
  const [newSection, setNewSection] = useState('');
  const [creating, setCreating]     = useState(false);

  const searchRef = useRef(null);
  const addSecRef = useRef(null);

  // ── Fetch fields ─────────────────────────────────────────────────────────────
  const fetchFields = () =>
    fetch(`${API}/custom-fields?entity=${entity}`)
      .then(r => r.json())
      .then(data => setFields([...data].sort((a, b) => a.order - b.order)))
      .catch(() => {});

  useEffect(() => { fetchFields(); }, [entity]);
  useEffect(() => { if (tab === 'manage' && searchRef.current) searchRef.current.focus(); }, [tab]);
  useEffect(() => { if (addingSection && addSecRef.current) addSecRef.current.focus(); }, [addingSection]);

  // ── Pipeline-config helpers ───────────────────────────────────────────────────
  const getPfc = (field) => pfcMap[field.id];

  const getShowInModal = (field) => {
    const p = getPfc(field);
    return p !== undefined ? p.show_in_modal : field.show_in_modal !== false;
  };

  const getSection = (field) => {
    const p = getPfc(field);
    return p !== undefined ? (p.section || '') : (field.section || '');
  };

  const getReqStageIds = (field) => {
    const p = getPfc(field);
    const raw = (p?.required_stage_ids) || '[]';
    try { return JSON.parse(raw); } catch { return []; }
  };

  // ── Save helpers ──────────────────────────────────────────────────────────────
  const savePfc = async (field, updates) => {
    const current = pfcMap[field.id] || {
      field_id: field.id, pipeline_id: pipelineId,
      section: field.section || '', show_in_modal: field.show_in_modal !== false,
      required_stage_ids: '[]',
    };
    const next = { ...current, ...updates };
    setSaving(p => ({ ...p, [field.id]: true }));
    try {
      if (pipelineId) {
        const res = await fetch(`${API}/pipelines/${pipelineId}/field-configs/${field.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section: next.section,
            show_in_modal: next.show_in_modal,
            required_stage_ids: next.required_stage_ids,
          }),
        });
        const saved = await res.json();
        const newMap = { ...pfcMap, [field.id]: saved };
        setPfcMap(newMap);
        onFieldsChanged?.(Object.values(newMap));
      }
    } catch {}
    finally { setSaving(p => ({ ...p, [field.id]: false })); }
  };

  const toggleModal     = (field) => savePfc(field, { show_in_modal: !getShowInModal(field) });
  const moveToSection   = (field, sec) => savePfc(field, { section: sec });
  const toggleStageReq  = (field, stageId) => {
    const ids = getReqStageIds(field);
    const next = ids.includes(stageId) ? ids.filter(id => id !== stageId) : [...ids, stageId];
    savePfc(field, { required_stage_ids: JSON.stringify(next) });
  };
  const setAllStages    = (field) => savePfc(field, { required_stage_ids: JSON.stringify(stages.map(s => s.id)) });
  const clearAllStages  = (field) => savePfc(field, { required_stage_ids: '[]' });

  // ── Section management ────────────────────────────────────────────────────────
  const createSection = () => {
    const name = addingSectionName.trim();
    if (!name || sectionNames.includes(name)) { setAddingSection(false); setAddingSectionName(''); return; }
    setSectionNames(prev => [...prev, name]);
    setAddingSection(false);
    setAddingSectionName('');
  };

  const deleteSection = (secName) => {
    // Move all fields in this section to ungrouped
    const fieldsInSec = fields.filter(f => getSection(f) === secName);
    for (const f of fieldsInSec) moveToSection(f, '');
    setSectionNames(prev => prev.filter(s => s !== secName));
  };

  const applyRename = () => {
    const newName2 = renameDraft.trim();
    if (!newName2 || newName2 === renamingSection) { setRenamingSection(null); return; }
    // Update all fields in this section
    const fieldsInSec = fields.filter(f => getSection(f) === renamingSection);
    for (const f of fieldsInSec) moveToSection(f, newName2);
    setSectionNames(prev => prev.map(s => s === renamingSection ? newName2 : s));
    setRenamingSection(null);
    setRenameDraft('');
  };

  // ── Drag handlers ─────────────────────────────────────────────────────────────
  const handleDragStart = (e, fieldId) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragFieldId(fieldId);
  };
  const handleDragOver = (e, secName) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSection(secName);
  };
  const handleDrop = (e, secName) => {
    e.preventDefault();
    if (dragFieldId !== null) {
      const field = fields.find(f => f.id === dragFieldId);
      if (field && getSection(field) !== secName) {
        moveToSection(field, secName);
      }
    }
    setDragFieldId(null);
    setDragOverSection(null);
  };
  const handleDragEnd = () => { setDragFieldId(null); setDragOverSection(null); };

  // ── Create field ──────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/custom-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity, name: newName.trim(), key: slugify(newName),
          field_type: newType, section: '', show_in_modal: true,
          show_on_card: false, required: false, options: '[]',
          order: fields.length,
        }),
      });
      const created = await res.json();
      setFields(prev => [...prev, created]);
      if (pipelineId) {
        try {
          const cfgRes = await fetch(`${API}/pipelines/${pipelineId}/field-configs/${created.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section: newSection.trim(), show_in_modal: true, required_stage_ids: '[]' }),
          });
          const cfg = await cfgRes.json();
          const newMap = { ...pfcMap, [created.id]: cfg };
          setPfcMap(newMap);
          onFieldsChanged?.(Object.values(newMap));
        } catch {}
      } else {
        onFieldsChanged?.();
      }
      // If section is new, add to list
      if (newSection.trim() && !sectionNames.includes(newSection.trim())) {
        setSectionNames(prev => [...prev, newSection.trim()]);
      }
      setNewName(''); setNewType('text'); setNewSection('');
      setTab('manage');
    } catch {}
    finally { setCreating(false); }
  };

  // ── Derived data ──────────────────────────────────────────────────────────────
  // All sections including '' (ungrouped)
  const allSections = ['', ...sectionNames];

  // Fields per section
  const fieldsInSection = (sec) => fields.filter(f => getSection(f) === sec);

  // ── Field row component ───────────────────────────────────────────────────────
  const FieldRow = ({ field }) => {
    const typeMeta = FIELD_TYPES.find(t => t.value === field.field_type);
    const showInModal = getShowInModal(field);
    const reqIds = getReqStageIds(field);
    const reqCount = reqIds.length;
    const isExp = expandedField === field.id;
    const isDragging = dragFieldId === field.id;

    return (
      <div
        draggable
        onDragStart={e => handleDragStart(e, field.id)}
        onDragEnd={handleDragEnd}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 8, marginBottom: 2,
          background: isDragging ? '#e0e7ff' : isExp ? '#f0fdf4' : 'white',
          border: `1px solid ${isDragging ? '#6366f1' : isExp ? '#bbf7d0' : '#f1f5f9'}`,
          cursor: 'grab', transition: 'all 0.1s', userSelect: 'none',
          opacity: isDragging ? 0.5 : 1,
        }}
      >
        {/* Drag handle */}
        <div style={{ color: '#cbd5e1', fontSize: 12, flexShrink: 0, cursor: 'grab' }}>⋮⋮</div>

        {/* Type icon */}
        <div style={{
          width: 24, height: 24, borderRadius: 5, flexShrink: 0,
          background: showInModal ? '#eef2ff' : '#f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 800, color: showInModal ? '#6366f1' : '#94a3b8',
        }}>{typeMeta?.icon}</div>

        {/* Name + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: showInModal ? '#0f172a' : '#94a3b8',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {field.name}
          </div>
          <div style={{ display: 'flex', gap: 3, marginTop: 1, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#94a3b8' }}>{typeMeta?.label}</span>
            {reqCount > 0 && (
              <span style={{ fontSize: 8, fontWeight: 700, color: '#f59e0b', background: '#fef3c7', padding: '0 4px', borderRadius: 3 }}>
                🔒 {reqCount} etapa{reqCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Stage gate expand */}
        {stages.length > 0 && (
          <button
            onClick={e => { e.stopPropagation(); setExpandedField(isExp ? null : field.id); }}
            style={{
              background: isExp ? '#dcfce7' : 'none', border: `1px solid ${isExp ? '#86efac' : '#e2e8f0'}`,
              borderRadius: 5, cursor: 'pointer', padding: '2px 6px',
              fontSize: 9, color: isExp ? '#15803d' : '#94a3b8', fontWeight: 700,
              flexShrink: 0, transition: 'all 0.1s',
            }}
          >🔒</button>
        )}

        {/* Visibility toggle */}
        {saving[field.id]
          ? <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>⏳</span>
          : <Toggle on={showInModal} onToggle={() => toggleModal(field)} />
        }
      </div>
    );
  };

  // ── Expanded gate panel (rendered outside the row to avoid drag issues) ───────
  const GatePanel = ({ field }) => {
    const reqIds = getReqStageIds(field);
    const allSelected = stages.length > 0 && stages.every(s => reqIds.includes(s.id));
    return (
      <div style={{
        margin: '0 0 6px 0', background: '#f0fdf4', borderRadius: 8,
        border: '1px solid #bbf7d0', padding: '10px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🔒 Obrigatório nas etapas
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            <button
              onClick={() => allSelected ? clearAllStages(field) : setAllStages(field)}
              style={{
                fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                border: `1px solid ${allSelected ? '#fca5a5' : '#86efac'}`,
                background: allSelected ? '#fef2f2' : '#dcfce7',
                color: allSelected ? '#b91c1c' : '#15803d', fontFamily: 'inherit',
              }}
            >{allSelected ? '✗ Desmarcar todas' : '✓ Marcar todas'}</button>
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#4b7a5a', marginBottom: 8 }}>
          O card só entra nestas etapas se o campo estiver preenchido.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {stages.map(stage => {
            const isReq = reqIds.includes(stage.id);
            const col = stage.type === 'won' ? '#15803d' : stage.type === 'lost' ? '#b91c1c' : '#6366f1';
            return (
              <button
                key={stage.id}
                onClick={() => toggleStageReq(field, stage.id)}
                style={{
                  padding: '4px 10px', borderRadius: 20,
                  border: `1.5px solid ${isReq ? col : '#e2e8f0'}`,
                  background: isReq ? col + '18' : 'white',
                  color: isReq ? col : '#64748b',
                  fontSize: 11, fontWeight: isReq ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'all 0.12s',
                }}
              >
                {stage.type === 'won' ? '🏆' : stage.type === 'lost' ? '❌' : '▸'}
                {stage.name}
                {isReq && <span style={{ fontSize: 10 }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Section container ─────────────────────────────────────────────────────────
  const SectionContainer = ({ secName }) => {
    const secFields = fieldsInSection(secName);
    const isOver = dragOverSection === secName;
    const isUngroup = secName === '';

    return (
      <div style={{ marginBottom: 10 }}>
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          {isUngroup ? (
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>
              Sem seção ({secFields.length})
            </div>
          ) : (
            <>
              <span style={{ fontSize: 13 }}>📁</span>
              {renamingSection === secName ? (
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={e => setRenameDraft(e.target.value)}
                  onBlur={applyRename}
                  onKeyDown={e => { if (e.key === 'Enter') applyRename(); if (e.key === 'Escape') setRenamingSection(null); }}
                  style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#4f46e5',
                    border: '1.5px solid #6366f1', borderRadius: 5, padding: '2px 6px',
                    outline: 'none', fontFamily: 'inherit', background: '#eef2ff' }}
                />
              ) : (
                <div
                  style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#4f46e5',
                    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  title="Clique duplo para renomear"
                  onDoubleClick={() => { setRenamingSection(secName); setRenameDraft(secName); }}
                >{secName} ({secFields.length})</div>
              )}
              <button
                title="Renomear seção"
                onClick={() => { setRenamingSection(secName); setRenameDraft(secName); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  color: '#94a3b8', fontSize: 11, padding: '1px 4px', borderRadius: 3 }}
              >✏️</button>
              <button
                title="Excluir seção (campos voltam para Sem seção)"
                onClick={() => deleteSection(secName)}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  color: '#94a3b8', fontSize: 12, padding: '1px 4px', borderRadius: 3 }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >✕</button>
            </>
          )}
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => handleDragOver(e, secName)}
          onDragLeave={() => setDragOverSection(null)}
          onDrop={e => handleDrop(e, secName)}
          style={{
            minHeight: secFields.length === 0 ? 52 : 'auto',
            border: `2px dashed ${isOver ? '#6366f1' : secFields.length === 0 ? '#e2e8f0' : 'transparent'}`,
            borderRadius: 10,
            background: isOver ? '#eef2ff' : secFields.length === 0 ? '#fafafa' : 'transparent',
            padding: secFields.length === 0 ? '14px 10px' : '4px',
            transition: 'all 0.12s',
          }}
        >
          {secFields.length === 0 ? (
            <div style={{ textAlign: 'center', color: isOver ? '#6366f1' : '#cbd5e1',
              fontSize: 11, fontWeight: isOver ? 700 : 400 }}>
              {isOver ? '↓ Soltar aqui' : 'Arraste campos aqui'}
            </div>
          ) : (
            secFields.map(field => (
              <div key={field.id}>
                <FieldRow field={field} />
                {expandedField === field.id && stages.length > 0 && (
                  <GatePanel field={field} />
                )}
              </div>
            ))
          )}
          {/* Show drop indicator even when section has fields */}
          {isOver && secFields.length > 0 && (
            <div style={{ height: 4, background: '#6366f1', borderRadius: 2, margin: '4px 0' }} />
          )}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white', borderRadius: 16, width: 480, maxHeight: '88vh',
          boxShadow: '0 24px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ padding: '16px 20px 0', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Campos do card</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                Organize campos em seções e configure obrigatoriedade
              </div>
            </div>
            <button onClick={onClose} style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              color: '#94a3b8', fontSize: 20, lineHeight: 1, padding: 4,
            }}>×</button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2 }}>
            {[
              { id: 'manage', label: '📋 Organizar campos' },
              { id: 'create', label: '＋ Criar campo' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '8px 14px', border: 'none', background: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                color: tab === t.id ? '#10b981' : '#64748b',
                borderBottom: `2px solid ${tab === t.id ? '#10b981' : 'transparent'}`,
                transition: 'all 0.12s',
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* ── MANAGE TAB ── */}
        {tab === 'manage' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 8px' }}>
              {fields.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🗂️</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    Nenhum campo criado ainda
                  </div>
                  <button onClick={() => setTab('create')} style={{
                    marginTop: 8, background: '#10b981', color: 'white', border: 'none',
                    borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>＋ Criar primeiro campo</button>
                </div>
              ) : (
                <>
                  {/* Hint */}
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>⋮⋮</span>
                    <span>Arraste campos entre seções — o toggle controla a visibilidade — 🔒 define obrigatoriedade por etapa</span>
                  </div>

                  {/* Sections */}
                  {allSections.map(sec => (
                    <SectionContainer key={sec === '' ? '__ungrouped__' : sec} secName={sec} />
                  ))}

                  {/* Add section */}
                  {addingSection ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 14 }}>📁</span>
                      <input
                        ref={addSecRef}
                        value={addingSectionName}
                        onChange={e => setAddingSectionName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') createSection(); if (e.key === 'Escape') { setAddingSection(false); setAddingSectionName(''); } }}
                        placeholder="Nome da seção..."
                        style={{
                          flex: 1, padding: '6px 10px', border: '1.5px solid #6366f1',
                          borderRadius: 7, fontSize: 12, fontFamily: 'inherit',
                          outline: 'none', color: '#1e293b', background: '#eef2ff',
                        }}
                      />
                      <button onClick={createSection} style={{
                        background: '#6366f1', color: 'white', border: 'none', borderRadius: 7,
                        padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}>Criar</button>
                      <button onClick={() => { setAddingSection(false); setAddingSectionName(''); }} style={{
                        background: 'none', border: '1px solid #e2e8f0', borderRadius: 7,
                        padding: '6px 10px', fontSize: 12, color: '#64748b', cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}>✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingSection(true)}
                      style={{
                        marginTop: 6, width: '100%', padding: '8px', border: '1.5px dashed #c7d2fe',
                        borderRadius: 8, background: 'none', color: '#6366f1', fontSize: 12,
                        fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#eef2ff'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <span>📁</span> Adicionar seção
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9', fontSize: 10, color: '#94a3b8' }}>
              {fields.length > 0 && `${fields.filter(f => getShowInModal(f)).length} de ${fields.length} campos visíveis`}
            </div>
          </>
        )}

        {/* ── CREATE TAB ── */}
        {tab === 'create' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
                Nome do campo *
              </label>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Ex: CNPJ, Temperatura do lead..."
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#0f172a', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Tipo do campo
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                {FIELD_TYPES.map(t => (
                  <button key={t.value} onClick={() => setNewType(t.value)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 7,
                    cursor: 'pointer', border: `1.5px solid ${newType === t.value ? '#6366f1' : '#e2e8f0'}`,
                    background: newType === t.value ? '#eef2ff' : 'white', fontFamily: 'inherit',
                    fontSize: 11, fontWeight: newType === t.value ? 700 : 500,
                    color: newType === t.value ? '#4338ca' : '#475569', transition: 'all 0.1s',
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                      background: newType === t.value ? '#6366f1' : '#f1f5f9',
                      color: newType === t.value ? 'white' : '#94a3b8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 800,
                    }}>{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
                Seção <span style={{ fontWeight: 400, textTransform: 'none', color: '#94a3b8' }}>(opcional)</span>
              </label>
              {sectionNames.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                  {sectionNames.map(s => (
                    <button key={s} onClick={() => setNewSection(newSection === s ? '' : s)} style={{
                      padding: '4px 10px', borderRadius: 20,
                      border: `1.5px solid ${newSection === s ? '#8b5cf6' : '#e2e8f0'}`,
                      background: newSection === s ? '#f3e8ff' : 'white',
                      color: newSection === s ? '#7c3aed' : '#64748b',
                      fontSize: 11, fontWeight: newSection === s ? 700 : 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>📁 {s}</button>
                  ))}
                </div>
              )}
              <input
                value={newSection}
                onChange={e => setNewSection(e.target.value)}
                placeholder="Ex: Cliente, Contrato, Financeiro…"
                style={{ width: '100%', padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', outline: 'none', color: '#0f172a', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #d1fae5', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#065f46', display: 'flex', gap: 6 }}>
              <span>✓</span>
              <span>O campo será criado e ficará visível neste card</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <button onClick={() => setTab('manage')} style={{
                flex: 1, padding: '9px', border: '1px solid #e2e8f0', borderRadius: 8,
                background: 'white', color: '#64748b', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancelar</button>
              <button onClick={handleCreate} disabled={!newName.trim() || creating} style={{
                flex: 2, padding: '9px', border: 'none', borderRadius: 8,
                background: newName.trim() ? '#10b981' : '#e2e8f0',
                color: newName.trim() ? 'white' : '#94a3b8',
                fontSize: 13, fontWeight: 700, cursor: newName.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit', transition: 'all 0.12s',
              }}>{creating ? 'Criando...' : '＋ Criar campo'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
