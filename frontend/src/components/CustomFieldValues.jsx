import React, { useState, useEffect, useCallback, useRef } from 'react';

import { API_URL as API } from '../config.js';

const TYPE_META = {
  text:       { label: 'Texto',       icon: 'T'  },
  textarea:   { label: 'Texto longo', icon: '¶'  },
  number:     { label: 'Número',      icon: '#'  },
  currency:   { label: 'Moeda',       icon: 'R$' },
  date:       { label: 'Data',        icon: '📅' },
  checkbox:   { label: 'Sim/Não',     icon: '☑'  },
  select:     { label: 'Lista',       icon: '▾'  },
  url:        { label: 'URL',         icon: '🔗' },
  phone:      { label: 'Telefone',    icon: '📞' },
  email:      { label: 'E-mail',      icon: '@'  },
  attachment: { label: 'Anexo',       icon: '📎' },
};

const FILE_ICONS = {
  'application/pdf': '📄',
  'audio/':          '🎵',
  'video/':          '🎬',
  'image/':          '🖼️',
};
function fileIcon(type = '') {
  for (const [k, v] of Object.entries(FILE_ICONS)) { if (type.startsWith(k)) return v; }
  return '📎';
}
function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function slugify(str) {
  return str.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
}

// ── UID badge ────────────────────────────────────────────────────────────────
function UidBadge({ field, showIds }) {
  const [tip, setTip] = useState(false);
  if (!field.uid) return null;
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {showIds ? (
        <code style={{ fontSize: 9, background: '#1e293b', color: '#f59e0b', padding: '1px 5px', borderRadius: 3, cursor: 'default', marginLeft: 4 }}>
          {field.uid}
        </code>
      ) : (
        <button onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, padding: '0 2px', lineHeight: 1 }}>ⓘ</button>
      )}
      {tip && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999, background: '#1e293b', color: '#e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 11, width: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', lineHeight: 1.9, pointerEvents: 'none' }}>
          <div style={{ fontWeight: 700, color: '#10b981', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Campo Personalizado</div>
          <div><span style={{ color: '#94a3b8' }}>UID:</span>{'  '}<code style={{ color: '#f59e0b', fontWeight: 700 }}>{field.uid}</code></div>
          <div><span style={{ color: '#94a3b8' }}>Chave:</span>{'  '}<code style={{ color: '#38bdf8' }}>{field.key}</code></div>
        </div>
      )}
    </div>
  );
}

// ── Attachment field ─────────────────────────────────────────────────────────
function AttachmentField({ fieldId, value, entityId, entity, disabled }) {
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { try { setAttachments(JSON.parse(value || '[]')); } catch { setAttachments([]); } }, [value]);

  const saveAttachments = useCallback(async (list) => {
    if (!entityId) return;
    await fetch(`${API}/custom-field-values?entity=${entity}&entity_id=${entityId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ field_id: fieldId, value: JSON.stringify(list) }]),
    });
  }, [fieldId, entity, entityId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const form = new FormData(); form.append('file', file);
      const res = await fetch(`${API}/upload`, { method: 'POST', body: form });
      const data = await res.json();
      const next = [...attachments, data]; setAttachments(next); await saveAttachments(next);
    } catch {} finally { setUploading(false); e.target.value = ''; }
  };

  const remove = async (idx) => {
    const next = attachments.filter((_, i) => i !== idx); setAttachments(next); await saveAttachments(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {attachments.map((a, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 10px' }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{fileIcon(a.type)}</span>
          <a href={`${API}${a.url}`} target="_blank" rel="noreferrer"
            style={{ flex: 1, fontSize: 12, color: '#0369a1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</a>
          <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>{formatBytes(a.size)}</span>
          {!disabled && (
            <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, padding: 0, lineHeight: 1 }}
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>×</button>
          )}
        </div>
      ))}
      {!disabled && (
        <>
          <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            style={{ padding: '6px 10px', borderRadius: 7, cursor: uploading ? 'default' : 'pointer', border: '1.5px dashed #e2e8f0', background: 'transparent', fontSize: 12, color: uploading ? '#94a3b8' : '#64748b', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseEnter={e => !uploading && (e.currentTarget.style.borderColor = '#10b981', e.currentTarget.style.color = '#10b981')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e8f0', e.currentTarget.style.color = '#64748b')}>
            {uploading ? '⏳ Enviando...' : '📎 Adicionar arquivo'}
          </button>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FieldPicker — inline checkbox picker (rendered per-section)
// ════════════════════════════════════════════════════════════════════════════
function FieldPicker({ fields, nativeFields = [], secName, getSection, getNativeSec, getNativeVisible, getVisible, onToggle, onClose }) {
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Build combined list: native + ALL custom (including hidden ones so they can be re-enabled)
  const allRows = [
    ...nativeFields.map(nf => ({
      ...nf, _isNative: true,
      _sec: getNativeSec(nf),
      _hidden: !getNativeVisible(nf),   // visible by default, can be hidden
    })),
    ...fields.map(f => ({
      ...f, _isNative: false,
      _sec: getSection(f),
      _hidden: !getVisible(f),   // uses pfcMap-aware getVisible
    })),
  ].filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  // Sort: in this section first, then others, hidden last
  const inHere  = allRows.filter(r => r._sec === secName && !r._hidden);
  const visible = allRows.filter(r => r._sec !== secName && !r._hidden);
  const hidden  = allRows.filter(r => r._hidden);
  const rows    = [...inHere, ...visible, ...hidden];

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.10)', padding: '10px 0',
      marginTop: 6, zIndex: 50,
    }}>
      {/* Search */}
      <div style={{ padding: '0 10px 8px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, padding: '5px 10px' }}>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>🔍</span>
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Encontrar campo..."
            style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: 13.5, fontFamily: 'inherit', color: '#1e293b' }}
          />
        </div>
      </div>

      {/* Field list */}
      <div style={{ maxHeight: 260, overflowY: 'auto', padding: '6px 0' }}>
        {rows.length === 0 && (
          <div style={{ padding: '12px 14px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
            Nenhum campo encontrado
          </div>
        )}
        {rows.map(r => {
          const isHere    = r._sec === secName && !r._hidden;
          const elsewhere = !r._hidden && r._sec !== '' && !isHere ? r._sec : null;
          const typeLabel = r._isNative ? 'Nativo' : (TYPE_META[r.field_type]?.label ?? '');
          return (
            <label key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', cursor: 'pointer', transition: 'background 0.1s',
              opacity: r._hidden ? 0.45 : 1,
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <input
                type="checkbox"
                checked={isHere}
                onChange={() => onToggle(r, isHere)}
                style={{ accentColor: '#6366f1', width: 14, height: 14, flexShrink: 0, cursor: 'pointer' }}
              />
              {r._isNative && <span style={{ fontSize: 9, color: '#0ea5e9', flexShrink: 0 }}>◆</span>}
              <span style={{ fontSize: 13.5, color: r._hidden ? '#94a3b8' : '#1e293b', flex: 1 }}>
                {r.name}
                {r._hidden && <span style={{ fontSize: 9, color: '#cbd5e1', marginLeft: 5 }}>(oculto)</span>}
              </span>
              <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>{typeLabel}</span>
              {elsewhere && (
                <span style={{ fontSize: 9, color: '#a78bfa', background: '#f5f3ff', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>
                  {elsewhere}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {/* Close */}
      <div style={{ padding: '6px 10px 0', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{
          fontSize: 11, color: '#64748b', background: 'none', border: '1px solid #e2e8f0',
          borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit',
        }}>Fechar</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════════════
export default function CustomFieldValues({
  entity, entityId, readOnly = false, showIds = false,
  pipelineFieldConfigs = [],
  pipelineId = null,
  stages = [],
  onConfigsChanged,
  nativeFields = [],   // { id: string, name: string, renderContent: () => ReactNode }
}) {
  // Derive pipelineId from stages as a safety fallback (in case parent passes null)
  const resolvedPipelineId = pipelineId ?? (stages && stages.length > 0 ? stages[0].pipeline_id : null);

  const [fields, setFields]   = useState([]);
  const [values, setValues]   = useState({});
  const [saving, setSaving]   = useState({});
  const [saved,  setSaved]    = useState({});

  // ── Pipeline config state ──────────────────────────────────────────────────
  const [pfcMap, setPfcMap] = useState(() => {
    const m = {};
    const safe = Array.isArray(pipelineFieldConfigs) ? pipelineFieldConfigs : [];
    for (const c of safe) m[c.field_id] = c;
    return m;
  });

  // ── Section names (ordered, persisted to localStorage per pipeline) ─────────
  const SECTIONS_KEY = resolvedPipelineId ? `nexus_sections_${resolvedPipelineId}` : null;

  const buildSectionsFromSources = (pfcList, fieldList, stored) => {
    // Collect sections from all sources: pfc, field-level, localStorage
    const seen = new Set(); const out = [];
    const add = (s) => { if (s && !seen.has(s)) { seen.add(s); out.push(s); } };
    for (const c of (pfcList  || [])) add(c.section);
    for (const f of (fieldList || [])) add(f.section);
    for (const s of (stored   || [])) add(s);
    return out;
  };

  const [sectionNames, setSectionNames] = useState(() => {
    const safe  = Array.isArray(pipelineFieldConfigs) ? pipelineFieldConfigs : [];
    let stored  = [];
    if (SECTIONS_KEY) { try { stored = JSON.parse(localStorage.getItem(SECTIONS_KEY) || '[]'); } catch {} }
    return buildSectionsFromSources(safe, [], stored);
  });

  // Persist sectionNames to localStorage whenever it changes
  useEffect(() => {
    if (!SECTIONS_KEY) return;
    try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(sectionNames)); } catch {}
  }, [sectionNames, SECTIONS_KEY]);

  // Keep pfcMap in sync when prop changes (e.g., after parent re-fetches)
  useEffect(() => {
    const safe = Array.isArray(pipelineFieldConfigs) ? pipelineFieldConfigs : [];
    const m = {};
    for (const c of safe) m[c.field_id] = c;
    setPfcMap(m);
    // Merge sections: server pfc + existing fields + current state + localStorage
    let stored = [];
    if (SECTIONS_KEY) { try { stored = JSON.parse(localStorage.getItem(SECTIONS_KEY) || '[]'); } catch {} }
    setSectionNames(prev => buildSectionsFromSources(safe, [], [...prev, ...stored]));
  }, [pipelineFieldConfigs]);

  // ── Native field section assignments (per-pipeline, localStorage) ──────────
  const [nativeSections, setNativeSections] = useState(() => {
    if (!resolvedPipelineId) return {};
    try { return JSON.parse(localStorage.getItem(`nexus_nativeSec_${resolvedPipelineId}`) || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    if (!resolvedPipelineId) return;
    try { localStorage.setItem(`nexus_nativeSec_${resolvedPipelineId}`, JSON.stringify(nativeSections)); } catch {}
  }, [nativeSections, resolvedPipelineId]);

  const getNativeSec = (nf) => nativeSections[nf.id] ?? '';
  const moveNativeToSection = (nf, sec) => setNativeSections(prev => ({ ...prev, [nf.id]: sec }));

  // ── Native field order (per-pipeline, localStorage) ──────────────────────
  const [nativeOrder, setNativeOrder] = useState(() => {
    if (!resolvedPipelineId) return [];
    try { return JSON.parse(localStorage.getItem(`nexus_nativeOrd_${resolvedPipelineId}`) || '[]'); } catch { return []; }
  });
  useEffect(() => {
    if (!resolvedPipelineId) return;
    try { localStorage.setItem(`nexus_nativeOrd_${resolvedPipelineId}`, JSON.stringify(nativeOrder)); } catch {}
  }, [nativeOrder, resolvedPipelineId]);

  // Returns nativeFields sorted by nativeOrder for a given section
  const getSortedNativesInSec = (sec) => {
    const inSec = nativeFields.filter(nf => getNativeSec(nf) === sec && getNativeVisible(nf));
    if (nativeOrder.length === 0) return inSec;
    return [
      ...nativeOrder.map(id => inSec.find(nf => String(nf.id) === String(id))).filter(Boolean),
      ...inSec.filter(nf => !nativeOrder.some(id => String(id) === String(nf.id))),
    ];
  };

  // ── Native field visibility (per-pipeline, localStorage) ─────────────────
  // All native fields are VISIBLE by default; user can hide them via the picker
  const [nativeHidden, setNativeHidden] = useState(() => {
    if (!resolvedPipelineId) return {};
    try { return JSON.parse(localStorage.getItem(`nexus_nativeHid_${resolvedPipelineId}`) || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    if (!resolvedPipelineId) return;
    try { localStorage.setItem(`nexus_nativeHid_${resolvedPipelineId}`, JSON.stringify(nativeHidden)); } catch {}
  }, [nativeHidden, resolvedPipelineId]);

  const getNativeVisible = (nf) => nativeHidden[nf.id] !== true;
  const toggleNativeVisible = (nf) => setNativeHidden(prev => ({ ...prev, [nf.id]: !prev[nf.id] }));

  // ── pfcMap ref for use inside async callbacks (avoids stale closures) ──────
  const pfcMapRef = useRef(pfcMap);
  useEffect(() => { pfcMapRef.current = pfcMap; }, [pfcMap]);

  // ── Drag state ─────────────────────────────────────────────────────────────
  const dragFieldIdRef  = useRef(null);   // id of field being dragged
  const dragTypeRef     = useRef(null);   // 'native' | 'custom'
  const [dragFieldId,   setDragFieldId]  = useState(null);
  // dropIndicator: { sec, beforeId } — show a blue line before this field id (null = end of section)
  const [dropIndicator, setDropIndicator] = useState(null); // { sec, beforeId }
  const [expandedGate,  setExpandedGate] = useState(null); // field.id

  // ── Section UI state ───────────────────────────────────────────────────────
  const [addingSection,     setAddingSection]     = useState(false);
  const [addingSectionName, setAddingSectionName] = useState('');
  const [renamingSec,       setRenamingSec]       = useState(null);
  const [renameDraft,       setRenameDraft]       = useState('');

  // ── Field picker (per-section "Selecionar campo") ──────────────────────────
  const [pickerOpenSec, setPickerOpenSec] = useState(null); // secName | null

  // ── Create field inline ────────────────────────────────────────────────────
  const [addingField,   setAddingField]   = useState(false);
  const [createInSec,   setCreateInSec]   = useState('');   // which section the form is attached to
  const [newFieldName,  setNewFieldName]  = useState('');
  const [newFieldType,  setNewFieldType]  = useState('text');
  const [creatingField, setCreatingField] = useState(false);

  const addSecRef = useRef(null);

  useEffect(() => { if (addingSection && addSecRef.current) addSecRef.current.focus(); }, [addingSection]);

  // ── Fetch fields + values ─────────────────────────────────────────────────
  useEffect(() => {
    if (!entity) return;
    fetch(`${API}/custom-fields?entity=${entity}`)
      .then(r => r.json()).then(data => {
        const sorted = [...data].sort((a, b) => a.order - b.order);
        setFields(sorted);
        // Ensure any sections referenced by field-level .section are in sectionNames
        setSectionNames(prev => buildSectionsFromSources([], sorted, prev));
      }).catch(() => {});
  }, [entity]);

  useEffect(() => {
    if (!entityId || !entity) return;
    fetch(`${API}/custom-field-values?entity=${entity}&entity_id=${entityId}`)
      .then(r => r.json())
      .then(data => { const m = {}; data.forEach(v => { m[v.field_id] = v.value || ''; }); setValues(m); })
      .catch(() => {});
  }, [entity, entityId]);

  // ── Save field value ──────────────────────────────────────────────────────
  const saveValue = useCallback(async (fieldId, value) => {
    if (!entityId) return;
    setSaving(p => ({ ...p, [fieldId]: true }));
    try {
      await fetch(`${API}/custom-field-values?entity=${entity}&entity_id=${entityId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ field_id: fieldId, value: String(value ?? '') }]),
      });
      setSaved(p => ({ ...p, [fieldId]: true }));
      setTimeout(() => setSaved(p => ({ ...p, [fieldId]: false })), 1500);
    } catch {} finally { setSaving(p => ({ ...p, [fieldId]: false })); }
  }, [entity, entityId]);

  const change = (id, v) => setValues(p => ({ ...p, [id]: v }));
  const blur   = (id)    => saveValue(id, values[id] ?? '');
  const select = (id, v) => { setValues(p => ({ ...p, [id]: v })); saveValue(id, v); };
  const check  = (id, b) => { const v = b ? 'true' : 'false'; setValues(p => ({ ...p, [id]: v })); saveValue(id, v); };

  // ── Pipeline config helpers ───────────────────────────────────────────────
  const getSection    = (f) => { const p = pfcMap[f.id]; return p !== undefined ? (p.section || '') : (f.section || ''); };
  const getVisible    = (f) => { const p = pfcMap[f.id]; const s = p !== undefined ? p.show_in_modal : f.show_in_modal; return s !== false; };
  const getReqIds     = (f) => { try { return JSON.parse((pfcMap[f.id]?.required_stage_ids) || '[]'); } catch { return []; } };

  const savePfc = async (field, updates) => {
    // Read current pfcMap from ref (avoids stale closure)
    const original = pfcMapRef.current[field.id];
    const cur = original || {
      field_id: field.id, pipeline_id: resolvedPipelineId,
      section: field.section || '', show_in_modal: field.show_in_modal !== false, required_stage_ids: '[]',
    };
    const next = { ...cur, ...updates };

    // ── Optimistic update FIRST — UI responds instantly regardless of API ──
    setPfcMap(prev => ({ ...prev, [field.id]: next }));

    // ── Persist to backend (only if we have a resolvedPipelineId) ──
    if (!resolvedPipelineId) return;
    try {
      const res = await fetch(`${API}/pipelines/${resolvedPipelineId}/field-configs/${field.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: next.section, show_in_modal: next.show_in_modal, required_stage_ids: next.required_stage_ids }),
      });
      const saved2 = await res.json();
      // Replace optimistic entry with server-confirmed data
      setPfcMap(prev => {
        const newMap = { ...prev, [field.id]: saved2 };
        onConfigsChanged?.(Object.values(newMap));
        return newMap;
      });
    } catch {
      // Revert to original on network/server failure
      setPfcMap(prev => {
        const reverted = { ...prev };
        if (original === undefined) delete reverted[field.id];
        else reverted[field.id] = original;
        return reverted;
      });
    }
  };

  const toggleVisible   = (field) => savePfc(field, { show_in_modal: !getVisible(field) });
  const moveToSection   = (field, sec) => savePfc(field, { section: sec });
  const toggleStageReq  = (field, stageId) => {
    const ids = getReqIds(field);
    const next = ids.includes(stageId) ? ids.filter(i => i !== stageId) : [...ids, stageId];
    savePfc(field, { required_stage_ids: JSON.stringify(next) });
  };
  const setAllStages    = (field) => savePfc(field, { required_stage_ids: JSON.stringify(stages.map(s => s.id)) });
  const clearAllStages  = (field) => savePfc(field, { required_stage_ids: '[]' });

  // ── Section management ────────────────────────────────────────────────────
  const createSection = () => {
    const name = addingSectionName.trim();
    if (!name || sectionNames.includes(name)) { setAddingSection(false); setAddingSectionName(''); return; }
    setSectionNames(prev => [...prev, name]);
    setAddingSection(false); setAddingSectionName('');
  };
  const deleteSection = (secName) => {
    // Move all custom fields back to general pool
    const inSec = fields.filter(f => getSection(f) === secName);
    for (const f of inSec) moveToSection(f, '');
    // Move native fields back to general pool
    const nativeInSec = nativeFields.filter(nf => getNativeSec(nf) === secName);
    for (const nf of nativeInSec) moveNativeToSection(nf, '');
    setSectionNames(prev => prev.filter(s => s !== secName));
  };
  const applyRename = () => {
    const n = renameDraft.trim();
    if (!n || n === renamingSec) { setRenamingSec(null); return; }
    // Rename all custom fields in this section
    const inSec = fields.filter(f => getSection(f) === renamingSec);
    for (const f of inSec) moveToSection(f, n);
    // Rename all native fields in this section
    const nativeInSec = nativeFields.filter(nf => getNativeSec(nf) === renamingSec);
    for (const nf of nativeInSec) moveNativeToSection(nf, n);
    setSectionNames(prev => prev.map(s => s === renamingSec ? n : s));
    setRenamingSec(null); setRenameDraft('');
  };

  // ── Drag ─────────────────────────────────────────────────────────────────
  const onDragStart = (e, fieldId, type) => {
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
    dragFieldIdRef.current = fieldId;
    dragTypeRef.current = type; // 'native' | 'custom'
    setDragFieldId(fieldId);
  };

  const onDragEnd = () => {
    dragFieldIdRef.current = null;
    dragTypeRef.current = null;
    setDragFieldId(null);
    setDropIndicator(null);
  };

  // Called when dragging over a field row — shows indicator above or below it
  const onFieldDragOver = (e, sec, fieldId) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const beforeId = e.clientY < midY ? fieldId : '__after__' + fieldId;
    setDropIndicator({ sec, beforeId });
  };

  // Called when dragging over the empty area of a section (below all fields)
  const onSectionDragOver = (e, sec) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndicator({ sec, beforeId: null }); // null = append at end
  };

  const onDrop = (e, sec, targetBeforeId) => {
    e.preventDefault();
    e.stopPropagation();
    const fid = dragFieldIdRef.current;
    const type = dragTypeRef.current;
    if (fid == null) { onDragEnd(); return; }

    if (type === 'native') {
      const nf = nativeFields.find(n => String(n.id) === String(fid));
      if (nf) {
        if (!getNativeVisible(nf)) toggleNativeVisible(nf);
        moveNativeToSection(nf, sec);

        // Persist new order within the target section
        const nativesInTarget = getSortedNativesInSec(sec).filter(n => String(n.id) !== String(fid));
        let insertIndex = nativesInTarget.length;
        if (targetBeforeId != null) {
          const cleanId = String(targetBeforeId).replace('__after__', '');
          const idx = nativesInTarget.findIndex(n => String(n.id) === cleanId);
          if (idx !== -1) {
            insertIndex = String(targetBeforeId).startsWith('__after__') ? idx + 1 : idx;
          }
        }
        const reordered = [...nativesInTarget];
        reordered.splice(insertIndex, 0, nf);

        // Merge: fields not in this section keep their relative order; this section replaces
        setNativeOrder(prev => {
          const others = prev.filter(id => !reordered.some(n => String(n.id) === String(id)) && !nativeFields.filter(n => getNativeSec(n) === sec).some(n => String(n.id) === String(id)));
          return [...others, ...reordered.map(n => n.id)];
        });
      }
    } else {
      // Custom field — change section if needed
      const field = fields.find(f => f.id === fid);
      if (!field) { onDragEnd(); return; }

      // Find where to insert within target section (excluding the field being dragged)
      const customInTarget = fields.filter(f => getSection(f) === sec && getVisible(f) && f.id !== fid);
      let insertIndex = customInTarget.length; // default: end
      if (targetBeforeId != null) {
        const cleanId = String(targetBeforeId).replace('__after__', '');
        const idx = customInTarget.findIndex(f => String(f.id) === cleanId);
        if (idx !== -1) {
          insertIndex = String(targetBeforeId).startsWith('__after__') ? idx + 1 : idx;
        }
      }
      const newCustomOrder = [...customInTarget];
      newCustomOrder.splice(insertIndex, 0, field);

      // Optimistically update fields: non-target-section fields first, then target section in new order
      setFields(prev => {
        const notInSec = prev.filter(f => !newCustomOrder.some(x => x.id === f.id));
        return [...notInSec, ...newCustomOrder];
      });

      // Change section if needed
      if (getSection(field) !== sec) {
        savePfc(field, { section: sec, show_in_modal: true });
      }

      // Persist new order to backend
      const allForReorder = [...fields.filter(f => !newCustomOrder.some(x => x.id === f.id)), ...newCustomOrder];
      fetch(`${API}/custom-fields/reorder`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: allForReorder.map(f => f.id) }),
      }).catch(() => {});
    }
    onDragEnd();
  };

  // ── Create field inline ───────────────────────────────────────────────────
  const handleCreateField = async () => {
    if (!newFieldName.trim()) return;
    setCreatingField(true);
    const targetSec = createInSec; // section where this field will land
    try {
      const res = await fetch(`${API}/custom-fields`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity, name: newFieldName.trim(), key: slugify(newFieldName),
          field_type: newFieldType, section: targetSec, show_in_modal: true,
          show_on_card: false, required: false, options: '[]', order: fields.length,
        }),
      });
      const created = await res.json();
      setFields(prev => [...prev, created]);
      // Ensure the target section exists in sectionNames (survives remount via localStorage)
      if (targetSec) {
        setSectionNames(prev => prev.includes(targetSec) ? prev : [...prev, targetSec]);
      }
      if (resolvedPipelineId) {
        try {
          const cfgRes = await fetch(`${API}/pipelines/${resolvedPipelineId}/field-configs/${created.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section: targetSec, show_in_modal: true, required_stage_ids: '[]' }),
          });
          const cfg = await cfgRes.json();
          const newMap = { ...pfcMapRef.current, [created.id]: cfg };
          setPfcMap(newMap); onConfigsChanged?.(Object.values(newMap));
        } catch {}
      }
      setNewFieldName(''); setNewFieldType('text'); setAddingField(false); setCreateInSec('');
    } catch {} finally { setCreatingField(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const visibleFields = fields.filter(getVisible);
  const allSections   = ['', ...sectionNames];

  if (fields.length === 0 && nativeFields.length === 0) return null;

  // ── Render field input ────────────────────────────────────────────────────
  const renderInput = (field) => {
    const val = values[field.id] ?? '';
    let opts = []; try { opts = JSON.parse(field.options || '[]'); } catch {}

    if (field.field_type === 'attachment') return (
      <AttachmentField fieldId={field.id} value={val} entityId={entityId} entity={entity} disabled={readOnly || !entityId} />
    );
    if (field.field_type === 'checkbox') return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={val === 'true'} disabled={readOnly || !entityId}
          onChange={e => check(field.id, e.target.checked)} style={{ width: 15, height: 15, accentColor: '#10b981' }} />
        <span style={{ fontSize: 12, color: '#475569' }}>{val === 'true' ? 'Sim' : 'Não'}</span>
      </label>
    );
    if (field.field_type === 'select') return (
      <select className="form-select" style={{ fontSize: 14 }} value={val}
        disabled={readOnly || !entityId} onChange={e => select(field.id, e.target.value)}>
        <option value="">Selecionar...</option>
        {opts.map(o => <option key={o.id} value={String(o.id)}>{o.label}</option>)}
      </select>
    );
    if (field.field_type === 'textarea') return (
      <textarea className="form-textarea" style={{ fontSize: 14, minHeight: 60 }} value={val}
        readOnly={readOnly || !entityId} onChange={e => change(field.id, e.target.value)}
        onBlur={() => blur(field.id)} placeholder={readOnly ? '—' : `Inserir ${field.name.toLowerCase()}...`} />
    );
    return (
      <div style={{ position: 'relative' }}>
        {field.field_type === 'currency' && (
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', pointerEvents: 'none' }}>R$</span>
        )}
        <input
          type={field.field_type === 'number' || field.field_type === 'currency' ? 'number' : field.field_type === 'date' ? 'date' : field.field_type === 'email' ? 'email' : 'text'}
          className="form-input" style={{ fontSize: 14, paddingLeft: field.field_type === 'currency' ? 30 : undefined }}
          value={val} readOnly={readOnly || !entityId}
          onChange={e => change(field.id, e.target.value)} onBlur={() => blur(field.id)}
          placeholder={readOnly ? '—' : `Inserir ${field.name.toLowerCase()}...`}
        />
      </div>
    );
  };

  // ── Render one field (label + input + gate panel) ─────────────────────────
  const renderField = (field) => {
    const reqIds     = getReqIds(field);
    const reqCount   = reqIds.length;
    const isDragging = dragFieldId === field.id;
    const isGateOpen = expandedGate === field.id;
    const allSel     = stages.length > 0 && stages.every(s => reqIds.includes(s.id));
    const tm         = TYPE_META[field.field_type];

    return (
      <div key={field.id} className="field-row" style={{ opacity: isDragging ? 0.35 : 1 }}>
        {/* Label row — draggable */}
        <div
          draggable
          onDragStart={e => onDragStart(e, field.id, 'custom')}
          onDragEnd={onDragEnd}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            marginBottom: 4, cursor: 'grab', userSelect: 'none',
          }}
        >
          {/* Drag handle */}
          <span style={{ color: '#d1d5db', fontSize: 11, flexShrink: 0, cursor: 'grab' }}>⋮⋮</span>

          {/* Type chip */}
          <span style={{
            fontSize: 9, fontWeight: 800, color: '#8b5cf6', background: '#f3e8ff',
            padding: '1px 4px', borderRadius: 3, flexShrink: 0,
          }}>{tm?.icon}</span>

          {/* Name */}
          <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', flex: 1 }}>
            {field.name}
            {field.required && <span style={{ color: '#ef4444', fontSize: 10, marginLeft: 2 }}>*</span>}
            <UidBadge field={field} showIds={showIds} />
          </label>

          {/* Save indicators */}
          {saving[field.id] && <span style={{ fontSize: 9, color: '#94a3b8' }}>⏳</span>}
          {saved[field.id]  && <span style={{ fontSize: 9, color: '#10b981' }}>✓</span>}

          {/* Stage gate toggle */}
          {stages.length > 0 && pipelineId && (
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setExpandedGate(isGateOpen ? null : field.id); }}
              title="Configurar obrigatoriedade por etapa"
              style={{
                background: isGateOpen ? '#fef3c7' : (reqCount > 0 ? '#fefce8' : 'none'),
                border: `1px solid ${isGateOpen ? '#f59e0b' : (reqCount > 0 ? '#fde68a' : '#e2e8f0')}`,
                borderRadius: 4, cursor: 'pointer', padding: '1px 5px',
                fontSize: 9, color: isGateOpen ? '#92400e' : (reqCount > 0 ? '#b45309' : '#94a3b8'),
                fontWeight: 700, flexShrink: 0,
              }}
            >🔒{reqCount > 0 ? ` ${reqCount}` : ''}</button>
          )}

          {/* Visibility toggle — only show on hover to avoid accidental click */}
          {resolvedPipelineId && (
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); toggleVisible(field); }}
              title={getVisible(field) ? 'Ocultar campo do card' : 'Mostrar campo no card'}
              className="field-vis-btn"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '1px 5px',
                fontSize: 10, color: '#94a3b8', flexShrink: 0,
                opacity: getVisible(field) ? 0 : 1,  // always visible when hidden; only on hover when visible
              }}
            >{getVisible(field) ? '🙈' : '👁'}</button>
          )}
        </div>

        {/* Stage gate panel */}
        {isGateOpen && stages.length > 0 && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
            padding: '8px 10px', marginBottom: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🔒 Obrigatório nas etapas
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => allSel ? clearAllStages(field) : setAllStages(field)} style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
                  border: `1px solid ${allSel ? '#fca5a5' : '#86efac'}`,
                  background: allSel ? '#fef2f2' : '#dcfce7',
                  color: allSel ? '#b91c1c' : '#15803d', fontFamily: 'inherit',
                }}>{allSel ? '✗ Nenhuma' : '✓ Todas'}</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {stages.map(stage => {
                const isReq = reqIds.includes(stage.id);
                const col = stage.type === 'won' ? '#15803d' : stage.type === 'lost' ? '#b91c1c' : '#6366f1';
                return (
                  <button key={stage.id} onClick={() => toggleStageReq(field, stage.id)} style={{
                    padding: '3px 8px', borderRadius: 16,
                    border: `1.5px solid ${isReq ? col : '#e2e8f0'}`,
                    background: isReq ? col + '18' : 'white',
                    color: isReq ? col : '#64748b',
                    fontSize: 10, fontWeight: isReq ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    {stage.type === 'won' ? '🏆' : stage.type === 'lost' ? '❌' : '▸'}
                    {stage.name}{isReq && ' ✓'}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input */}
        {renderInput(field)}
      </div>
    );
  };

  // ── Render a native field row (draggable label + custom content) ──────────
  const renderNativeField = (nf) => {
    const isDragging = dragFieldId === nf.id;
    return (
      <div key={nf.id} style={{ opacity: isDragging ? 0.35 : 1 }}>
        {/* Draggable label */}
        <div
          draggable
          onDragStart={e => onDragStart(e, nf.id, 'native')}
          onDragEnd={onDragEnd}
          style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, cursor: 'grab', userSelect: 'none' }}
        >
          <span style={{ color: '#d1d5db', fontSize: 11, flexShrink: 0 }}>⋮⋮</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: '#0ea5e9', background: '#e0f2fe', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>◆</span>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', flex: 1 }}>{nf.name}</label>
        </div>
        {/* Content rendered by caller */}
        {nf.renderContent()}
      </div>
    );
  };

  // ── Helper: render a drop indicator line ─────────────────────────────────
  const DropLine = ({ sec, beforeId }) => {
    const active = dropIndicator && dropIndicator.sec === sec && dropIndicator.beforeId === beforeId && dragFieldId != null;
    return (
      <div style={{
        height: active ? 3 : 0, background: '#6366f1', borderRadius: 2,
        margin: active ? '3px 0' : 0, transition: 'height 0.1s, margin 0.1s',
        pointerEvents: 'none',
      }} />
    );
  };

  // ── Render section container (Bitrix24-style) ─────────────────────────────
  const renderSection = (secName) => {
    const isOver     = dropIndicator?.sec === secName && dragFieldId != null;
    const isUngroup  = secName === '';
    const pickerOpen = pickerOpenSec === secName;
    const isCreating = addingField && createInSec === secName;
    const nativeInSec = getSortedNativesInSec(secName);
    const customInSec = visibleFields.filter(f => getSection(f) === secName);
    const totalInSec  = nativeInSec.length + customInSec.length;

    // Named sections get a card visual; default section stays flat
    const wrapStyle = isUngroup
      ? { marginBottom: 10 }
      : {
          marginBottom: 10,
          background: '#fff',
          border: `1.5px solid ${isOver ? '#6366f1' : '#e2e8f0'}`,
          borderRadius: 12,
          padding: '14px 16px',
          transition: 'border-color 0.15s',
        };

    return (
      <div key={secName === '' ? '__ungrouped__' : secName} style={wrapStyle}>
        {/* ── Section header ── */}
        {!isUngroup && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
            {renamingSec === secName ? (
              <input
                autoFocus
                value={renameDraft}
                onChange={e => setRenameDraft(e.target.value)}
                onBlur={applyRename}
                onKeyDown={e => { if (e.key === 'Enter') applyRename(); if (e.key === 'Escape') setRenamingSec(null); }}
                style={{ flex: 1, fontSize: 12.5, fontWeight: 800, color: '#4f46e5', border: '1.5px solid #6366f1', borderRadius: 5, padding: '3px 8px', outline: 'none', fontFamily: 'inherit', background: '#eef2ff', textTransform: 'uppercase', letterSpacing: '0.07em' }}
              />
            ) : (
              <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {secName}
              </span>
            )}
            {!readOnly && renamingSec !== secName && (
              <button
                onClick={() => { setRenamingSec(secName); setRenameDraft(secName); }}
                style={{ fontSize: 12.5, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit' }}
                onMouseEnter={e => e.currentTarget.style.color = '#6366f1'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >editar</button>
            )}
          </div>
        )}

        {/* ── Drop zone + fields ── */}
        <div
          onDragOver={e => { e.preventDefault(); onSectionDragOver(e, secName); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropIndicator(null); }}
          onDrop={e => onDrop(e, secName, dropIndicator?.sec === secName ? dropIndicator?.beforeId : null)}
          style={{
            minHeight: (totalInSec === 0 && !isUngroup && !pickerOpen && !isCreating) ? 48 : 'auto',
            borderRadius: 7,
            background: isOver ? '#eef2ff' : 'transparent',
            padding: isOver && totalInSec === 0 ? '4px' : 0,
            transition: 'background 0.1s',
          }}
        >
          {totalInSec === 0 && !isUngroup && !isOver && !pickerOpen && !isCreating && (
            <div style={{ color: '#cbd5e1', fontSize: 12, padding: '10px 0', fontStyle: 'italic', textAlign: 'center' }}>
              Arraste campos aqui ou use "Selecionar campo"
            </div>
          )}
          {/* Render natives with per-item drag-over detection */}
          {nativeInSec.map(nf => (
            <div key={nf.id}
              onDragOver={e => onFieldDragOver(e, secName, nf.id)}
              onDrop={e => { e.stopPropagation(); onDrop(e, secName, dropIndicator?.beforeId); }}
            >
              <DropLine sec={secName} beforeId={nf.id} />
              {renderNativeField(nf)}
            </div>
          ))}
          {/* Render custom fields with per-item drag-over detection */}
          {customInSec.map(field => (
            <div key={field.id}
              onDragOver={e => onFieldDragOver(e, secName, field.id)}
              onDrop={e => { e.stopPropagation(); onDrop(e, secName, dropIndicator?.beforeId); }}
            >
              <DropLine sec={secName} beforeId={field.id} />
              {renderField(field)}
            </div>
          ))}
          {/* Drop indicator at end of section */}
          <DropLine sec={secName} beforeId={null} />
        </div>

        {/* ── Field picker ── */}
        {pickerOpen && (
          <FieldPicker
            fields={fields}
            nativeFields={nativeFields}
            secName={secName}
            getSection={getSection}
            getNativeSec={getNativeSec}
            getNativeVisible={getNativeVisible}
            getVisible={getVisible}
            onToggle={(r, isHere) => {
              if (r._isNative) {
                if (isHere) {
                  // Uncheck → hide native field entirely
                  toggleNativeVisible(r);
                } else if (!getNativeVisible(r)) {
                  // Was hidden → show it and place in this section
                  toggleNativeVisible(r);
                  moveNativeToSection(r, secName);
                } else {
                  // Visible but in another section → move here
                  moveNativeToSection(r, secName);
                }
              } else {
                if (isHere) {
                  // Uncheck → hide from card entirely
                  savePfc(r, { show_in_modal: false, section: '' });
                } else {
                  // Check → show and place in this section
                  savePfc(r, { show_in_modal: true, section: secName });
                }
              }
            }}
            onClose={() => setPickerOpenSec(null)}
          />
        )}

        {/* ── Create field inline form ── */}
        {isCreating && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Novo campo {secName ? `→ ${secName}` : ''}
            </div>
            <input
              autoFocus
              value={newFieldName}
              onChange={e => setNewFieldName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateField()}
              placeholder="Nome do campo..."
              style={{ width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}
            />
            {/* Type selector */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {Object.entries(TYPE_META).map(([k, v]) => (
                <button key={k} onClick={() => setNewFieldType(k)} style={{
                  padding: '3px 8px', borderRadius: 16, fontSize: 10, fontWeight: newFieldType === k ? 700 : 400,
                  border: `1.5px solid ${newFieldType === k ? '#6366f1' : '#e2e8f0'}`,
                  background: newFieldType === k ? '#eef2ff' : 'white',
                  color: newFieldType === k ? '#4338ca' : '#64748b', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setAddingField(false); setNewFieldName(''); setNewFieldType('text'); setCreateInSec(''); }}
                style={{ flex: 1, padding: '6px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={handleCreateField} disabled={!newFieldName.trim() || creatingField}
                style={{ flex: 2, padding: '6px', border: 'none', borderRadius: 6, background: newFieldName.trim() ? '#10b981' : '#e2e8f0', color: newFieldName.trim() ? 'white' : '#94a3b8', fontSize: 13, fontWeight: 700, cursor: newFieldName.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                {creatingField ? 'Criando...' : '＋ Criar campo'}
              </button>
            </div>
          </div>
        )}

        {/* ── Section actions bar ── */}
        {!readOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 10 }}>
            <button
              onClick={() => {
                setPickerOpenSec(pickerOpen ? null : secName);
                if (isCreating) { setAddingField(false); setNewFieldName(''); setNewFieldType('text'); setCreateInSec(''); }
              }}
              style={{ fontSize: 12.5, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit', fontWeight: 500 }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
            >{pickerOpen ? 'Fechar seleção' : 'Selecionar campo'}</button>

            <span style={{ color: '#e2e8f0', margin: '0 8px', userSelect: 'none' }}>|</span>

            <button
              onClick={() => {
                setPickerOpenSec(null);
                setCreateInSec(secName);
                setAddingField(true);
                setNewFieldName('');
                setNewFieldType('text');
              }}
              style={{ fontSize: 12.5, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit', fontWeight: 500 }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
            >Criar campo</button>

            {!isUngroup && (
              <>
                <span style={{ flex: 1 }} />
                <button
                  onClick={() => deleteSection(secName)}
                  style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit', fontWeight: 500 }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                >Excluir seção</button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* Sections */}
      {allSections.map(sec => renderSection(sec))}

      {/* ── Adicionar seção ── */}
      {!readOnly && pipelineId && (
        <div style={{ marginTop: 12 }}>
          {addingSection ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                ref={addSecRef}
                value={addingSectionName}
                onChange={e => setAddingSectionName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createSection(); if (e.key === 'Escape') { setAddingSection(false); setAddingSectionName(''); } }}
                placeholder="Nome da seção..."
                style={{ flex: 1, padding: '6px 10px', border: '1.5px solid #6366f1', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none', color: '#1e293b' }}
              />
              <button onClick={createSection} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Criar</button>
              <button onClick={() => { setAddingSection(false); setAddingSectionName(''); }} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>cancelar</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingSection(true)}
              style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit', fontWeight: 500 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#6366f1'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
            >Adicionar seção</button>
          )}
        </div>
      )}
    </div>
  );
}
