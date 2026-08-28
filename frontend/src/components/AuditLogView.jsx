import { useState, useEffect, useCallback, useRef } from 'react';

import { API_URL as API } from '../config.js';

const ACTION_META = {
  created:   { bg: '#dcfce7', color: '#166534', label: 'Criado' },
  updated:   { bg: '#dbeafe', color: '#1d4ed8', label: 'Atualizado' },
  deleted:   { bg: '#fee2e2', color: '#991b1b', label: 'Excluído' },
  moved:     { bg: '#fef3c7', color: '#92400e', label: 'Movido' },
  converted: { bg: '#f3e8ff', color: '#6b21a8', label: 'Convertido' },
  login:     { bg: '#f1f5f9', color: '#475569', label: 'Login' },
};

const ENTITY_COLORS = {
  card:     '#6366f1',
  lead:     '#8b5cf6',
  contact:  '#10b981',
  company:  '#f59e0b',
  user:     '#3b82f6',
  pipeline: '#ec4899',
};

const ENTITY_LABELS = {
  card:     'Negócio',
  lead:     'Lead',
  contact:  'Contato',
  company:  'Empresa',
  user:     'Usuário',
  pipeline: 'Pipeline',
};

function formatDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

function ActionBadge({ action }) {
  const meta = ACTION_META[action] || { bg: '#f1f5f9', color: '#475569', label: action };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 14,
      fontWeight: 600,
      background: meta.bg,
      color: meta.color,
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  );
}

function EntityBadge({ entityType, entityName }) {
  const color = ENTITY_COLORS[entityType] || '#94a3b8';
  const label = ENTITY_LABELS[entityType] || entityType;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        display: 'inline-block',
        padding: '1px 7px',
        borderRadius: 4,
        fontSize: 13,
        fontWeight: 600,
        background: color + '22',
        color: color,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>{entityName || '-'}</span>
    </span>
  );
}

function DetailsCell({ details }) {
  if (!details) return <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>—</span>;
  try {
    const obj = typeof details === 'string' ? JSON.parse(details) : details;
    const entries = Object.entries(obj);
    if (entries.length === 0) return <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>—</span>;
    return (
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {entries.map(([k, v]) => (
          <span key={k} style={{ marginRight: 8 }}>
            <strong>{k}:</strong> {String(v)}
          </span>
        ))}
      </span>
    );
  } catch {
    const str = typeof details === 'string' ? details : JSON.stringify(details);
    return <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{str}</span>;
  }
}

export default function AuditLogView() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const offsetRef = useRef(0);
  const pollingRef = useRef(null);

  const buildQuery = useCallback((offset = 0) => {
    const params = new URLSearchParams({ limit: 100, offset });
    if (search) params.set('search', search);
    if (filterEntity) params.set('entity_type', filterEntity);
    if (filterAction) params.set('action', filterAction);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    return params;
  }, [search, filterEntity, filterAction, dateFrom, dateTo]);

  const fetchLogs = useCallback(async (reset = true) => {
    setLoading(true);
    try {
      const offset = reset ? 0 : offsetRef.current;
      const res = await fetch(`${API}/audit-log?${buildQuery(offset)}`);
      if (!res.ok) throw new Error('fetch error');
      const data = await res.json();
      setTotal(data.total);
      if (reset) {
        setItems(data.items);
        offsetRef.current = data.items.length;
      } else {
        setItems(prev => [...prev, ...data.items]);
        offsetRef.current += data.items.length;
      }
    } catch (e) {
      console.error('AuditLog fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  // Initial + filter change fetch
  useEffect(() => {
    fetchLogs(true);
  }, [fetchLogs]);

  // Polling every 30s
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      fetchLogs(true);
    }, 30000);
    return () => clearInterval(pollingRef.current);
  }, [fetchLogs]);

  const hasFilters = search || filterEntity || filterAction || dateFrom || dateTo;

  function clearFilters() {
    setSearch('');
    setFilterEntity('');
    setFilterAction('');
    setDateFrom('');
    setDateTo('');
  }

  function exportCSV() {
    const BOM = '﻿';
    const header = ['ID', 'Data/Hora', 'Ação', 'Tipo de Entidade', 'ID Entidade', 'Nome', 'Responsável', 'Email', 'Detalhes'];
    const rows = items.map(i => [
      i.id,
      formatDate(i.created_at),
      ACTION_META[i.action]?.label || i.action,
      ENTITY_LABELS[i.entity_type] || i.entity_type,
      i.entity_id ?? '',
      i.entity_name ?? '',
      i.actor,
      i.actor_email ?? '',
      i.details ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    const csv = BOM + [header.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'auditoria.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="view-container">
      <div className="view-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            Log de Auditoria
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--text-secondary)' }}>
            {total} {total === 1 ? 'registro' : 'registros'} encontrado{total === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        marginBottom: 16,
        padding: '10px 14px',
        background: 'var(--bg-secondary)',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        <input
          type="text"
          placeholder="Buscar nome ou responsável..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: 15,
            minWidth: 200,
            flex: '1 1 180px',
          }}
        />

        <select
          value={filterEntity}
          onChange={e => setFilterEntity(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: 15,
          }}
        >
          <option value="">Todos os tipos</option>
          <option value="card">Negócios</option>
          <option value="lead">Leads</option>
          <option value="contact">Contatos</option>
          <option value="company">Empresas</option>
          <option value="user">Usuários</option>
        </select>

        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: 15,
          }}
        >
          <option value="">Todas as ações</option>
          <option value="created">Criado</option>
          <option value="updated">Atualizado</option>
          <option value="deleted">Excluído</option>
          <option value="moved">Movido</option>
          <option value="converted">Convertido</option>
          <option value="login">Login</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          title="Data inicial"
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: 15,
          }}
        />

        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          title="Data final"
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: 15,
          }}
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Limpar
          </button>
        )}

        <button
          onClick={exportCSV}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          Exportar CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
              {['Data/Hora', 'Ação', 'Entidade', 'Responsável', 'Detalhes'].map(h => (
                <th key={h} style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  fontSize: 14,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: 16,
                }}>
                  Nenhuma atividade registrada ainda. As ações no CRM aparecerão aqui.
                </td>
              </tr>
            )}
            {items.map((item, idx) => (
              <tr
                key={item.id}
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                }}
              >
                <td style={{ padding: '9px 14px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: 14 }}>
                  {formatDate(item.created_at)}
                </td>
                <td style={{ padding: '9px 14px' }}>
                  <ActionBadge action={item.action} />
                </td>
                <td style={{ padding: '9px 14px' }}>
                  <EntityBadge entityType={item.entity_type} entityName={item.entity_name} />
                </td>
                <td style={{ padding: '9px 14px', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                  {item.actor}
                  {item.actor_email && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.actor_email}</div>
                  )}
                </td>
                <td style={{ padding: '9px 14px', maxWidth: 260 }}>
                  <DetailsCell details={item.details} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {items.length < total && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => fetchLogs(false)}
            disabled={loading}
            style={{
              padding: '8px 24px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Carregando...' : `Carregar mais (${total - items.length} restantes)`}
          </button>
        </div>
      )}

      {loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
          Carregando...
        </div>
      )}
    </div>
  );
}
