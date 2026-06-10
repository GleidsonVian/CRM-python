import React, { useState, useEffect } from 'react';

const API = 'http://localhost:8002';

const fmt = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.includes('+') || iso.endsWith('Z') ? iso : iso + 'Z');
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(d);
};

const avatarColor = (name) => {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

function renderCFValue(field, rawValue) {
  if (!rawValue && rawValue !== 0) return null;
  if (field.field_type === 'checkbox') return rawValue === 'true' ? '✓ Sim' : '✗ Não';
  if (field.field_type === 'currency') return `R$ ${parseFloat(rawValue || 0).toFixed(2).replace('.', ',')}`;
  if (field.field_type === 'select') {
    let opts = [];
    try { opts = JSON.parse(field.options || '[]'); } catch {}
    return opts.find(o => String(o.id) === rawValue)?.label || rawValue;
  }
  if (field.field_type === 'attachment') {
    let files = [];
    try { files = JSON.parse(rawValue || '[]'); } catch {}
    return files.length ? `📎 ${files.length} arquivo${files.length !== 1 ? 's' : ''}` : null;
  }
  return rawValue;
}

export default function KanbanCard({
  card,
  onDragStart,
  onOpen,      // double-click or button → opens modal
  onSelect,    // single click → selects card
  isSelected = false,
  showOnCardFields = [],
  isLead = false,
}) {
  const [cfValues, setCfValues] = useState({});

  useEffect(() => {
    if (!showOnCardFields.length) return;
    fetch(`${API}/custom-field-values?entity=deal&entity_id=${card.id}`)
      .then(r => r.json())
      .then(data => {
        const map = {};
        data.forEach(v => { map[v.field_id] = v.value; });
        setCfValues(map);
      })
      .catch(() => {});
  }, [card.id, showOnCardFields.length]);

  const price = card.price || 0;
  const contacts = card.contacts || [];
  const users = card.users || [];

  const primaryContact = contacts[0];
  const contactLabel = primaryContact
    ? `${primaryContact.first_name} ${primaryContact.last_name || ''}`.trim() +
      (contacts.length > 1 ? ` +${contacts.length - 1}` : '')
    : null;

  const visibleCFs = showOnCardFields
    .map(f => ({ field: f, display: renderCFValue(f, cfValues[f.id]) }))
    .filter(({ display }) => display !== null && display !== '');

  return (
    <div
      className={`card${isSelected ? ' card-selected' : ''}`}
      draggable
      onDragStart={e => onDragStart(e, card)}
      onClick={e => { e.stopPropagation(); onSelect && onSelect(card); }}
      onDoubleClick={e => { e.stopPropagation(); onOpen && onOpen(card); }}
    >
      {/* Selection checkbox */}
      <div
        className="card-check"
        onClick={e => { e.stopPropagation(); onSelect && onSelect(card); }}
      >
        {isSelected
          ? <svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="3" fill="var(--accent)" stroke="var(--accent)"/><path d="M3 7l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : <svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" rx="3" fill="white" stroke="#cbd5e1"/></svg>
        }
      </div>

      {/* Open modal button on hover */}
      <button
        className="card-open-btn"
        title="Abrir detalhes"
        onClick={e => { e.stopPropagation(); onOpen && onOpen(card); }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 11L11 1M11 1H5M11 1v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {isLead && (
        <div style={{ marginBottom: 4 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            background: '#ede9fe', color: '#7c3aed', padding: '2px 6px', borderRadius: 4,
          }}>
            {card.converted ? '✓ Convertido' : 'Lead'}
          </span>
        </div>
      )}
      <div className="card-title">{card.title}</div>

      {price > 0 ? (
        <div className="card-price">{fmt(price)}</div>
      ) : (
        <div className="card-price zero">Sem valor</div>
      )}

      {contactLabel && (
        <div className="card-contact">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.1" />
            <path d="M1 10a4.5 4.5 0 0 1 9 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          {contactLabel}
        </div>
      )}

      {visibleCFs.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {visibleCFs.map(({ field, display }) => (
            <div key={field.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#64748b' }}>
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#6366f1',
                background: '#eef2ff', padding: '0px 4px', borderRadius: 3,
                flexShrink: 0, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{field.name}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{display}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card-divider" />

      <div className="card-footer">
        <div className="card-assignee">
          {users.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {users.slice(0, 3).map(u => {
                const initials = u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <div
                    key={u.id}
                    className="card-avatar"
                    style={{ background: avatarColor(u.name), color: 'white', marginLeft: -4 }}
                    title={u.name}
                  >
                    {initials}
                  </div>
                );
              })}
              {users.length > 3 && (
                <span style={{ fontSize: 10, color: '#64748b', marginLeft: 2 }}>+{users.length - 3}</span>
              )}
            </div>
          ) : (
            <span className="card-assignee-name" style={{ fontStyle: 'italic' }}>Sem responsável</span>
          )}
        </div>
        <span className="card-date">{fmtDate(card.created_at)}</span>
      </div>
    </div>
  );
}
