import { useState, useRef, useCallback } from 'react';

const API = 'http://localhost:8001';

const LEAD_FIELDS = [
  { key: '(skip)', label: '— Ignorar coluna —' },
  { key: 'title', label: 'Título do lead', required: true },
  { key: 'first_name', label: 'Nome' },
  { key: 'last_name', label: 'Sobrenome' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefone' },
  { key: 'company_name', label: 'Empresa' },
  { key: 'source', label: 'Fonte' },
  { key: 'position', label: 'Cargo' },
  { key: 'address', label: 'Endereço' },
  { key: 'website', label: 'Site' },
  { key: 'comment', label: 'Comentário' },
  { key: 'utm_source', label: 'UTM Source' },
  { key: 'utm_medium', label: 'UTM Medium' },
  { key: 'utm_campaign', label: 'UTM Campaign' },
];

function parseCSV(text) {
  // Strip UTF-8 BOM
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines = [];
  let i = 0;

  while (i < text.length) {
    const row = [];
    let inQuotes = false;
    let field = '';

    while (i < text.length) {
      const ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            // Escaped quote
            field += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          field += ch;
          i++;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i++;
        } else if (ch === ',') {
          row.push(field);
          field = '';
          i++;
        } else if (ch === '\n') {
          row.push(field);
          field = '';
          i++;
          break;
        } else {
          field += ch;
          i++;
        }
      }
    }

    if (i >= text.length && field !== '') {
      row.push(field);
    }

    if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
      lines.push(row);
    }
  }

  return lines;
}

function autoDetectMapping(headers) {
  const fieldKeys = LEAD_FIELDS.filter(f => f.key !== '(skip)').map(f => f.key);
  const fieldLabels = LEAD_FIELDS.filter(f => f.key !== '(skip)');
  const usedFields = new Set();
  const mapping = {};

  headers.forEach((header, idx) => {
    const normalized = header.trim().toLowerCase();
    let matched = '(skip)';

    // Match by key
    const byKey = fieldKeys.find(k => k.toLowerCase() === normalized);
    if (byKey && !usedFields.has(byKey)) {
      matched = byKey;
      usedFields.add(byKey);
    } else {
      // Match by label
      const byLabel = fieldLabels.find(
        f => f.label.toLowerCase() === normalized && !usedFields.has(f.key)
      );
      if (byLabel) {
        matched = byLabel.key;
        usedFields.add(byLabel.key);
      }
    }

    mapping[idx] = matched;
  });

  return mapping;
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
    width: '90vw',
    maxWidth: 820,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 24px 0',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: 16,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 20,
    color: '#94a3b8',
    lineHeight: 1,
    padding: 4,
    borderRadius: 6,
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 600,
    color: '#94a3b8',
  },
  stepDot: (active, done) => ({
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    background: done ? '#6366f1' : active ? '#6366f1' : '#e2e8f0',
    color: done || active ? '#fff' : '#94a3b8',
    flexShrink: 0,
  }),
  stepLabel: (active) => ({
    color: active ? '#1e293b' : '#94a3b8',
    fontWeight: active ? 700 : 500,
  }),
  stepSep: {
    width: 32,
    height: 2,
    background: '#e2e8f0',
    margin: '0 4px',
    flexShrink: 0,
  },
  body: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  btnPrimary: {
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 22px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSecondary: {
    background: '#f1f5f9',
    color: '#1e293b',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '10px 22px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  dropZone: (dragging) => ({
    border: `2px dashed ${dragging ? '#6366f1' : '#e2e8f0'}`,
    borderRadius: 12,
    padding: '48px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    background: dragging ? '#eef2ff' : '#fafafa',
    transition: 'all 0.15s',
  }),
  dropIcon: {
    fontSize: 40,
    marginBottom: 12,
    color: '#94a3b8',
  },
  dropText: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: 600,
    marginBottom: 6,
  },
  dropSub: {
    fontSize: 13,
    color: '#94a3b8',
  },
  fileInfo: {
    marginTop: 16,
    padding: '12px 16px',
    background: '#f0fdf4',
    borderRadius: 8,
    border: '1px solid #bbf7d0',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    color: '#166534',
    fontWeight: 500,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    background: '#f8fafc',
    padding: '10px 12px',
    textAlign: 'left',
    color: '#64748b',
    fontWeight: 600,
    border: '1px solid #e2e8f0',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: {
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    color: '#1e293b',
    verticalAlign: 'top',
  },
  sampleVal: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 140,
  },
  select: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    fontSize: 13,
    color: '#1e293b',
    background: '#fff',
    cursor: 'pointer',
  },
  errorMsg: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
    padding: '8px 12px',
    background: '#fef2f2',
    borderRadius: 6,
    border: '1px solid #fecaca',
  },
  successBox: {
    textAlign: 'center',
    padding: '32px 0',
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    color: '#64748b',
  },
};

export default function ImportLeadsModal({ onClose, defaultStageId }) {
  const [step, setStep] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]); // all rows including header
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef();

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setError('Por favor, selecione um arquivo .csv');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        setError('O arquivo CSV deve ter pelo menos uma linha de cabeçalho e uma linha de dados.');
        return;
      }
      const hdrs = parsed[0];
      const dataRows = parsed.slice(1);
      setFileName(file.name);
      setHeaders(hdrs);
      setRows(dataRows);
      setMapping(autoDetectMapping(hdrs));
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const onDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onFileChange = (e) => {
    handleFile(e.target.files[0]);
    e.target.value = '';
  };

  const handleMappingChange = (colIdx, newField) => {
    setMapping(prev => {
      const updated = { ...prev };
      // If the new field is already used elsewhere, swap with (skip)
      if (newField !== '(skip)') {
        Object.keys(updated).forEach(k => {
          if (parseInt(k) !== colIdx && updated[k] === newField) {
            updated[k] = '(skip)';
          }
        });
      }
      updated[colIdx] = newField;
      return updated;
    });
  };

  const getMappedLeads = () => {
    return rows.map(row => {
      const lead = { stage_id: defaultStageId };
      headers.forEach((_, idx) => {
        const field = mapping[idx];
        if (field && field !== '(skip)') {
          lead[field] = row[idx] ?? '';
        }
      });
      return lead;
    });
  };

  const canProceedStep1 = rows.length > 0;

  const canProceedStep2 = () => {
    return Object.values(mapping).some(v => v === 'title');
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');
    const leads = getMappedLeads();
    try {
      const res = await fetch(`${API}/leads/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Erro ${res.status}`);
      }
      const data = await res.json();
      setImportedCount(data.count ?? leads.length);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Erro ao importar leads.');
    } finally {
      setImporting(false);
    }
  };

  const previewRows = getMappedLeads().slice(0, 10);
  const mappedFields = LEAD_FIELDS.filter(
    f => f.key !== '(skip)' && Object.values(mapping).includes(f.key)
  );

  const renderStepIndicator = () => (
    <div style={styles.steps}>
      {[
        { n: 1, label: 'Upload' },
        { n: 2, label: 'Mapear' },
        { n: 3, label: 'Importar' },
      ].map(({ n, label }, i) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
          {i > 0 && <div style={styles.stepSep} />}
          <div style={styles.stepItem}>
            <div style={styles.stepDot(step === n, step > n)}>
              {step > n ? '✓' : n}
            </div>
            <span style={styles.stepLabel(step === n)}>{label}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div>
      <div
        style={styles.dropZone(dragging)}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current.click()}
      >
        <div style={styles.dropIcon}>📂</div>
        <div style={styles.dropText}>Arraste um arquivo CSV aqui</div>
        <div style={styles.dropSub}>ou clique para selecionar</div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
      </div>
      {fileName && (
        <div style={styles.fileInfo}>
          <span>✅</span>
          <span>
            <strong>{fileName}</strong> — {rows.length} linha{rows.length !== 1 ? 's' : ''} encontrada{rows.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      {error && <div style={styles.errorMsg}>{error}</div>}
    </div>
  );

  const renderStep2 = () => (
    <div style={{ overflowX: 'auto' }}>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
        Associe cada coluna do CSV a um campo do lead. Colunas com "— Ignorar coluna —" não serão importadas.
      </p>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Coluna CSV</th>
            <th style={styles.th}>Amostras</th>
            <th style={styles.th}>Campo do lead</th>
          </tr>
        </thead>
        <tbody>
          {headers.map((header, idx) => {
            const sample1 = rows[0]?.[idx] ?? '';
            const sample2 = rows[1]?.[idx] ?? '';
            const selectedField = mapping[idx] ?? '(skip)';

            // Build available options: all fields not used elsewhere, plus current
            const usedElsewhere = new Set(
              Object.entries(mapping)
                .filter(([k]) => parseInt(k) !== idx)
                .map(([, v]) => v)
            );

            return (
              <tr key={idx}>
                <td style={styles.td}>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{header}</span>
                </td>
                <td style={styles.td}>
                  <div style={styles.sampleVal}>{sample1}</div>
                  {sample2 && <div style={styles.sampleVal}>{sample2}</div>}
                </td>
                <td style={styles.td}>
                  <select
                    style={styles.select}
                    value={selectedField}
                    onChange={(e) => handleMappingChange(idx, e.target.value)}
                  >
                    {LEAD_FIELDS.map(f => (
                      <option
                        key={f.key}
                        value={f.key}
                        disabled={f.key !== '(skip)' && usedElsewhere.has(f.key) && f.key !== selectedField}
                      >
                        {f.label}{f.required ? ' *' : ''}
                        {f.key !== '(skip)' && usedElsewhere.has(f.key) && f.key !== selectedField ? ' (em uso)' : ''}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!canProceedStep2() && (
        <div style={styles.errorMsg}>O campo "Título do lead" é obrigatório e deve ser mapeado.</div>
      )}
    </div>
  );

  const renderStep3 = () => {
    if (done) {
      return (
        <div style={styles.successBox}>
          <div style={styles.successIcon}>🎉</div>
          <div style={styles.successTitle}>Importação concluída!</div>
          <div style={styles.successSub}>{importedCount} lead{importedCount !== 1 ? 's' : ''} importado{importedCount !== 1 ? 's' : ''} com sucesso.</div>
        </div>
      );
    }

    return (
      <div>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
          Pré-visualização das primeiras 10 linhas ({rows.length} linha{rows.length !== 1 ? 's' : ''} no total).
        </p>
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {mappedFields.map(f => (
                  <th key={f.key} style={styles.th}>{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((lead, i) => (
                <tr key={i}>
                  {mappedFields.map(f => (
                    <td key={f.key} style={styles.td}>
                      {lead[f.key] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && <div style={styles.errorMsg}>{error}</div>}
      </div>
    );
  };

  return (
    <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.headerRow}>
            <h2 style={styles.title}>Importar Leads via CSV</h2>
            <button style={styles.closeBtn} onClick={onClose} title="Fechar">✕</button>
          </div>
          {renderStepIndicator()}
        </div>

        <div style={styles.body}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        <div style={styles.footer}>
          <div>
            {step > 1 && !done && (
              <button
                style={styles.btnSecondary}
                onClick={() => { setStep(s => s - 1); setError(''); }}
              >
                ← Voltar
              </button>
            )}
          </div>
          <div>
            {done ? (
              <button style={styles.btnPrimary} onClick={onClose}>
                Fechar
              </button>
            ) : step < 3 ? (
              <button
                style={{
                  ...styles.btnPrimary,
                  ...(!canProceedStep1 && step === 1 ? styles.btnDisabled : {}),
                  ...(!canProceedStep2() && step === 2 ? styles.btnDisabled : {}),
                }}
                disabled={
                  (step === 1 && !canProceedStep1) ||
                  (step === 2 && !canProceedStep2())
                }
                onClick={() => { setError(''); setStep(s => s + 1); }}
              >
                Próximo →
              </button>
            ) : (
              <button
                style={{
                  ...styles.btnPrimary,
                  ...(importing ? styles.btnDisabled : {}),
                  minWidth: 160,
                }}
                disabled={importing}
                onClick={handleImport}
              >
                {importing ? 'Importando…' : `Importar ${rows.length} lead${rows.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
