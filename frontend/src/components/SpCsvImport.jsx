import React, { useState, useRef, useCallback } from 'react';
import { API_URL as API } from '../config.js';

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('nexus_token')}`,
  'Content-Type': 'application/json',
});

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line) => {
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        cols.push(cur.trim()); cur = '';
      } else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(l => {
    const cols = parseRow(l);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

function downloadTemplate(process) {
  const fields = process.fields_config || [];
  const cols = ['titulo', 'etapa', ...fields.filter(f => f.type !== 'entity').map(f => f.key)];
  const header = cols.join(',');
  const stageNames = (process.stages || []).map(s => s.name).join(' | ');
  const exampleStage = process.stages?.[0]?.name || 'Etapa 1';
  const exampleCols = ['Exemplo Moto 1', exampleStage, ...fields.filter(f => f.type !== 'entity').map(f => {
    if (f.type === 'number') return '0';
    if (f.type === 'date') return '2026-01-01';
    if (f.type === 'select' && f.options?.length) return f.options[0];
    return '';
  })];
  const comment = `# Etapas disponíveis: ${stageNames}`;
  const blob = new Blob([comment + '\n' + header + '\n' + exampleCols.join(',')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `template_${process.name.replace(/\s+/g, '_')}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export default function SpCsvImport({ process, onClose, onImported }) {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const fields = process.fields_config || [];
  const stages = process.stages || [];

  const resolveStageIndex = (val) => {
    if (!val) return 0;
    const idx = stages.findIndex(s => s.name.toLowerCase() === val.toLowerCase());
    return idx >= 0 ? idx : (parseInt(val, 10) || 0);
  };

  const buildRecord = (row) => {
    const title = row['titulo'] || row['title'] || row['nome'] || Object.values(row)[0] || '';
    const stageIndex = resolveStageIndex(row['etapa'] || row['stage'] || row['stage_index'] || '');
    const data = {};
    fields.filter(f => f.type !== 'entity').forEach(f => {
      const val = row[f.key] ?? row[f.label] ?? '';
      if (val !== '') {
        data[f.key] = f.type === 'number' ? (parseFloat(val) || 0) : val;
      }
    });
    return { title, stage_index: stageIndex, data };
  };

  const loadFile = useCallback((file) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null); setErrors([]);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      const { headers: h, rows: r } = parseCSV(text.replace(/^#[^\n]*\n/, ''));
      setHeaders(h);
      const built = r.filter(row => Object.values(row).some(v => v.trim())).map((row, i) => {
        const rec = buildRecord(row);
        const err = !rec.title ? `Linha ${i + 2}: título obrigatório` : null;
        return { ...rec, _row: i + 2, _raw: row, _err: err };
      });
      setRows(built);
      setErrors(built.filter(r => r._err).map(r => r._err));
    };
    reader.readAsText(file, 'UTF-8');
  }, [fields, stages]);

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) loadFile(file);
  };

  const validRows = rows.filter(r => !r._err);
  const invalidRows = rows.filter(r => r._err);

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);
    try {
      const payload = { records: validRows.map(({ _row, _raw, _err, ...rec }) => rec) };
      const res = await fetch(`${API}/sp-import/${process.id}`, {
        method: 'POST', headers: authHeader(), body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
      onImported();
    } catch (e) {
      setErrors(prev => [...prev, 'Erro ao importar: ' + e.message]);
    } finally {
      setImporting(false);
    }
  };

  const S = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
    modal: { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' },
    header: { padding: '18px 24px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    body: { flex: 1, overflowY: 'auto', padding: '20px 24px' },
    footer: { padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 10 },
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>Importar via CSV — {process.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Importe múltiplos registros de uma planilha CSV</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => downloadTemplate(process)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', fontSize: 12, color: '#475569', fontFamily: 'inherit', fontWeight: 600 }}
            >⬇ Baixar template</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20, lineHeight: 1, padding: 2 }}>×</button>
          </div>
        </div>

        <div style={S.body}>
          {/* Drop zone */}
          {!rows.length && !result && (
            <div
              style={{
                border: `2px dashed ${dragOver ? '#6366f1' : '#e2e8f0'}`,
                borderRadius: 12, padding: '40px 24px', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? '#f0f0ff' : '#f8fafc', transition: 'all 0.15s',
                marginBottom: 20,
              }}
              onClick={() => fileRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#475569', marginBottom: 4 }}>
                Arraste o arquivo CSV aqui ou clique para selecionar
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Apenas arquivos .csv</div>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => loadFile(e.target.files[0])} />
            </div>
          )}

          {/* Result screen */}
          {result && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{result.errors?.length ? '⚠️' : '✅'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                {result.created} registro{result.created !== 1 ? 's' : ''} criado{result.created !== 1 ? 's' : ''}
              </div>
              {result.errors?.length > 0 && (
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>
                  {result.errors.length} erro{result.errors.length > 1 ? 's' : ''} durante a importação
                </div>
              )}
              <button onClick={onClose} style={{ marginTop: 20, padding: '9px 24px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                Fechar
              </button>
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && !result && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  Arquivo: <strong>{fileName}</strong> — {rows.length} linha{rows.length !== 1 ? 's' : ''}
                  {invalidRows.length > 0 && <span style={{ color: '#ef4444', marginLeft: 6 }}>({invalidRows.length} com erro)</span>}
                </div>
                <button
                  onClick={() => { setRows([]); setHeaders([]); setFileName(''); setErrors([]); fileRef.current && (fileRef.current.value = ''); }}
                  style={{ marginLeft: 'auto', background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#64748b', padding: '3px 8px', fontFamily: 'inherit' }}
                >Trocar arquivo</button>
              </div>

              {errors.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', marginBottom: 4 }}>Problemas encontrados:</div>
                  {errors.map((e, i) => <div key={i} style={{ fontSize: 11, color: '#ef4444' }}>• {e}</div>)}
                </div>
              )}

              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>#</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Título</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Etapa</th>
                      {fields.filter(f => f.type !== 'entity').slice(0, 5).map(f => (
                        <th key={f.key} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{f.label}</th>
                      ))}
                      {fields.filter(f => f.type !== 'entity').length > 5 && (
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>+{fields.filter(f => f.type !== 'entity').length - 5} campos</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((row, i) => (
                      <tr key={i} style={{ background: row._err ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '7px 12px', color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>{row._row}</td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f1f5f9', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row._err ? <span style={{ color: '#ef4444' }}>⚠ {row.title || '(vazio)'}</span> : row.title}
                        </td>
                        <td style={{ padding: '7px 12px', borderBottom: '1px solid #f1f5f9' }}>
                          {stages[row.stage_index] ? (
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: (stages[row.stage_index].color || '#6366f1') + '18', color: stages[row.stage_index].color || '#6366f1', fontWeight: 600 }}>
                              {stages[row.stage_index].name}
                            </span>
                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                        {fields.filter(f => f.type !== 'entity').slice(0, 5).map(f => (
                          <td key={f.key} style={{ padding: '7px 12px', borderBottom: '1px solid #f1f5f9', color: '#475569', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.data[f.key] ?? <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                        ))}
                        {fields.filter(f => f.type !== 'entity').length > 5 && <td style={{ padding: '7px 12px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8' }}>…</td>}
                      </tr>
                    ))}
                    {rows.length > 50 && (
                      <tr><td colSpan={99} style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>… e mais {rows.length - 50} linhas</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {rows.length > 0 && !result && (
          <div style={S.footer}>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {validRows.length} de {rows.length} linha{rows.length !== 1 ? 's' : ''} válida{validRows.length !== 1 ? 's' : ''}
              {invalidRows.length > 0 && <span style={{ color: '#f59e0b', marginLeft: 6 }}>(linhas inválidas serão ignoradas)</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#475569', fontFamily: 'inherit' }}>Cancelar</button>
              <button
                onClick={handleImport}
                disabled={importing || !validRows.length}
                style={{ padding: '8px 20px', background: validRows.length ? '#6366f1' : '#e2e8f0', color: validRows.length ? '#fff' : '#94a3b8', border: 'none', borderRadius: 8, cursor: validRows.length ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}
              >
                {importing ? 'Importando…' : `Importar ${validRows.length} registro${validRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
