import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { API_URL as API } from '../config.js';

const ENTITY_CONFIG = {
  leads: {
    title: 'Importar Leads',
    templateName: 'modelo_leads.xlsx',
    endpoint: '/leads/import',
    fields: [
      { key: '(skip)', label: '— Ignorar coluna —' },
      { key: 'title', label: 'Título do lead', required: true },
      { key: 'first_name', label: 'Nome' },
      { key: 'last_name', label: 'Sobrenome' },
      { key: 'email', label: 'E-mail' },
      { key: 'phone', label: 'Telefone' },
      { key: 'company_name', label: 'Empresa' },
      { key: 'stage_id', label: 'ID da Etapa (Opcional)' }
    ]
  },
  cards: {
    title: 'Importar Negócios',
    templateName: 'modelo_negocios.xlsx',
    endpoint: '/cards/import',
    fields: [
      { key: '(skip)', label: '— Ignorar coluna —' },
      { key: 'title', label: 'Título do negócio', required: true },
      { key: 'price', label: 'Valor' },
      { key: 'contact_name', label: 'Nome do Contato' },
      { key: 'contact_email', label: 'E-mail do Contato' },
      { key: 'contact_phone', label: 'Telefone do Contato' },
      { key: 'stage_id', label: 'ID da Etapa (Opcional)' }
    ]
  },
  contacts: {
    title: 'Importar Contatos',
    templateName: 'modelo_contatos.xlsx',
    endpoint: '/contacts/import',
    fields: [
      { key: '(skip)', label: '— Ignorar coluna —' },
      { key: 'first_name', label: 'Nome', required: true },
      { key: 'last_name', label: 'Sobrenome' },
      { key: 'email', label: 'E-mail' },
      { key: 'phone', label: 'Telefone' },
      { key: 'cpf', label: 'CPF' },
      { key: 'position', label: 'Cargo' }
    ]
  },
  companies: {
    title: 'Importar Empresas',
    templateName: 'modelo_empresas.xlsx',
    endpoint: '/companies/import',
    fields: [
      { key: '(skip)', label: '— Ignorar coluna —' },
      { key: 'name', label: 'Nome Fantasia', required: true },
      { key: 'legal_name', label: 'Razão Social' },
      { key: 'cnpj', label: 'CNPJ' },
      { key: 'email', label: 'E-mail' },
      { key: 'phone', label: 'Telefone' },
      { key: 'industry', label: 'Setor/Indústria' }
    ]
  }
};

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
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
          if (text[i + 1] === '"') { field += '"'; i += 2; } 
          else { inQuotes = false; i++; }
        } else { field += ch; i++; }
      } else {
        if (ch === '"') { inQuotes = true; i++; } 
        else if (ch === ',') { row.push(field); field = ''; i++; } 
        else if (ch === '\n') { row.push(field); field = ''; i++; break; } 
        else { field += ch; i++; }
      }
    }
    if (i >= text.length && field !== '') row.push(field);
    if (row.length > 0 && !(row.length === 1 && row[0] === '')) lines.push(row);
  }
  return lines;
}

function autoDetectMapping(headers, fields) {
  const fieldKeys = fields.filter(f => f.key !== '(skip)').map(f => f.key);
  const usedFields = new Set();
  const mapping = {};
  headers.forEach((header, idx) => {
    const normalized = header.trim().toLowerCase();
    let matched = '(skip)';
    const byKey = fieldKeys.find(k => k.toLowerCase() === normalized);
    if (byKey && !usedFields.has(byKey)) { matched = byKey; } 
    else {
      const byLabel = fields.find(f => f.label.toLowerCase() === normalized && f.key !== '(skip)');
      if (byLabel && !usedFields.has(byLabel.key)) matched = byLabel.key;
    }
    if (matched !== '(skip)') usedFields.add(matched);
    mapping[idx] = matched;
  });
  return mapping;
}

export default function UniversalImportModal({ entityType, pipelineId, onClose, onImported }) {
  const config = ENTITY_CONFIG[entityType];
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [previewData, setPreviewData] = useState([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const processFile = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError('');

    if (selectedFile.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const lines = parseCSV(e.target.result);
          if (lines.length < 2) { setError('O arquivo deve ter um cabeçalho e pelo menos uma linha de dados.'); return; }
          const h = lines[0];
          const dataRows = lines.slice(1);
          setHeaders(h);
          setRows(dataRows);
          setColumnMapping(autoDetectMapping(h, config.fields));
        } catch (err) {
          setError('Erro ao ler CSV. Verifique a formatação.');
        }
      };
      reader.readAsText(selectedFile, 'UTF-8');
    } else if (selectedFile.name.match(/\.xlsx?$/i)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          
          if (json.length < 2) { setError('O arquivo deve ter um cabeçalho e pelo menos uma linha de dados.'); return; }
          
          const h = json[0].map(h => String(h).trim());
          const dataRows = json.slice(1).map(row => {
            return h.map((_, i) => (row[i] !== undefined && row[i] !== null) ? String(row[i]) : '');
          });
          
          setHeaders(h);
          setRows(dataRows);
          setColumnMapping(autoDetectMapping(h, config.fields));
        } catch (err) {
          console.error(err);
          setError('Erro ao ler Excel. Verifique a formatação do arquivo.');
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      setError('Formato não suportado. Envie um arquivo .csv ou .xlsx');
    }
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');
    const payload = previewData.map(r => {
      const { _id, _errors, ...dataFields } = r;
      return dataFields;
    });

    try {
      const token = localStorage.getItem('token');
      let url = `${API}${config.endpoint}`;
      if (pipelineId) url += `?pipeline_id=${pipelineId}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro na importação');
      setDone(true);
      onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const renderStep1 = () => (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
        Para garantir que a importação funcione perfeitamente, utilize nosso arquivo de modelo.
        <br/><br/>
        <a href={`/templates/${config.templateName}`} download className="btn btn-secondary" style={{ textDecoration: 'none' }}>
          📥 Baixar Modelo de {config.title.replace('Importar ', '')}
        </a>
      </p>
      <div
        style={{
          border: `2px dashed ${isDragging ? '#6366f1' : '#cbd5e1'}`,
          borderRadius: 8, padding: 40, background: isDragging ? '#f8fafc' : 'white',
          cursor: 'pointer', transition: 'all 0.2s'
        }}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>{file ? '📄' : '📁'}</div>
        <div style={{ fontWeight: 600, color: '#334155' }}>
          {file ? file.name : 'Arraste seu arquivo Excel ou CSV aqui'}
        </div>
        {!file && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Ou clique para selecionar</div>}
      </div>
      <input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} style={{ display: 'none' }} onChange={e => processFile(e.target.files[0])} />
      {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 12 }}>{error}</div>}
    </div>
  );

  const renderStep2 = () => {
    return (
      <div>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Confirme como as colunas do seu arquivo correspondem aos campos do sistema.
        </p>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Coluna do Arquivo</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Exemplo (1ª linha)</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Mapear para Campo</th>
              </tr>
            </thead>
            <tbody>
              {headers.map((h, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1e293b' }}>{h}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{rows[0]?.[i] || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      className="form-input"
                      value={columnMapping[i] || '(skip)'}
                      onChange={e => setColumnMapping({ ...columnMapping, [i]: e.target.value })}
                      style={{ padding: '6px 12px', fontSize: 13 }}
                    >
                      {config.fields.map(f => (
                        <option key={f.key} value={f.key}>{f.label} {f.required ? '*' : ''}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const hasRequiredFields = () => {
    const reqFields = config.fields.filter(f => f.required).map(f => f.key);
    const mappedVals = Object.values(columnMapping);
    return reqFields.every(f => mappedVals.includes(f));
  };

  const validateRow = (obj, fieldsConfig) => {
    const errors = {};
    fieldsConfig.forEach(f => {
      if (f.key === '(skip)') return;
      const val = (obj[f.key] || '').trim();
      if (f.required && !val) {
        errors[f.key] = 'Campo obrigatório';
      } else if (val) {
        if (f.key.includes('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          errors[f.key] = 'E-mail inválido';
        } else if (f.key.includes('phone')) {
          if (/[a-zA-Z]/.test(val)) errors[f.key] = 'Telefone não pode conter letras';
          const digits = val.replace(/\D/g, '');
          if (digits.length > 0 && digits.length < 8) errors[f.key] = 'Telefone muito curto';
        }
      }
    });
    return errors;
  };

  const handleNextFromStep2 = () => {
    const reqFields = config.fields.filter(f => f.required);
    const mappedVals = Object.values(columnMapping);
    const missing = reqFields.filter(f => !mappedVals.includes(f.key));
    
    if (missing.length > 0) {
      alert('Atenção! Você precisa mapear as seguintes colunas obrigatórias antes de continuar:\n\n' + missing.map(f => '- ' + f.label).join('\n'));
      return;
    }

    const data = rows.map((r, i) => {
      const obj = { _id: i };
      headers.forEach((h, idx) => {
        const fieldKey = columnMapping[idx];
        if (fieldKey && fieldKey !== '(skip)') {
          obj[fieldKey] = r[idx] || '';
        }
      });
      obj._errors = validateRow(obj, config.fields);
      return obj;
    }).filter(obj => Object.keys(obj).length > 2); // >2 because _id and _errors are present
    setPreviewData(data);
    setStep(3);
  };

  const handleCellChange = (rowIndex, fieldKey, val) => {
    const newData = [...previewData];
    const row = { ...newData[rowIndex] };
    row[fieldKey] = val;
    row._errors = validateRow(row, config.fields);
    newData[rowIndex] = row;
    setPreviewData(newData);
  };

  const hasValidationErrors = previewData.some(r => Object.keys(r._errors).length > 0);

  const renderStep3 = () => {
    const mappedFields = config.fields.filter(f => Object.values(columnMapping).includes(f.key) && f.key !== '(skip)');
    
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Revise os dados. Células com erros estão <strong style={{ color: '#ef4444' }}>marcadas em vermelho</strong>. Edite clicando sobre elas.
          </p>
          {hasValidationErrors && (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', background: '#fef2f2', padding: '4px 8px', borderRadius: 4 }}>
              Existem erros a serem corrigidos
            </span>
          )}
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflowX: 'auto', maxHeight: '50vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, minWidth: mappedFields.length * 150 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {mappedFields.map(f => (
                  <th key={f.key} style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                    {f.label} {f.required ? '*' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.map((row, rowIndex) => (
                <tr key={row._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {mappedFields.map(f => {
                    const errorMsg = row._errors[f.key];
                    return (
                      <td key={f.key} style={{ padding: '8px 12px' }}>
                        <input
                          type="text"
                          value={row[f.key] || ''}
                          onChange={e => handleCellChange(rowIndex, f.key, e.target.value)}
                          title={errorMsg || ''}
                          style={{
                            width: '100%', padding: '6px 8px', fontSize: 13,
                            border: errorMsg ? '1px solid #ef4444' : '1px solid transparent',
                            background: errorMsg ? '#fef2f2' : 'transparent',
                            borderRadius: 4, outline: 'none', transition: 'all 0.2s',
                            boxSizing: 'border-box'
                          }}
                          onFocus={e => { e.target.style.border = '1px solid #3b82f6'; e.target.style.background = '#fff'; }}
                          onBlur={e => { 
                            e.target.style.border = errorMsg ? '1px solid #ef4444' : '1px solid transparent';
                            e.target.style.background = errorMsg ? '#fef2f2' : 'transparent';
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="modal-backdrop fade-in" style={{ zIndex: 1200, justifyContent: 'center', alignItems: 'center', display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxWidth: step === 3 ? 1000 : 700, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'max-width 0.3s' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e293b' }}>{config.title}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, minHeight: 300 }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && !done && renderStep3()}
          {done && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>Importação Concluída!</h3>
              <p style={{ color: '#64748b' }}>Seus dados foram processados com sucesso.</p>
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', background: '#f8fafc', alignItems: 'center' }}>
          <div>
            {step === 2 && !done && <button className="btn btn-secondary" onClick={() => setStep(1)}>← Voltar</button>}
            {step === 3 && !done && <button className="btn btn-secondary" onClick={() => setStep(2)}>← Voltar para Mapeamento</button>}
          </div>
          <div>
            {!done ? (
              step === 1 ? (
                <button className="btn btn-primary" disabled={!file} onClick={() => setStep(2)}>Próximo →</button>
              ) : step === 2 ? (
                <button className="btn btn-primary" onClick={handleNextFromStep2}>Continuar para Revisão →</button>
              ) : (
                <button className="btn btn-primary" disabled={hasValidationErrors || importing} onClick={handleImport}>
                  {importing ? 'Importando...' : `Concluir Importação (${previewData.length})`}
                </button>
              )
            ) : (
              <button className="btn btn-primary" onClick={onClose}>Fechar</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
