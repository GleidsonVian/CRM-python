import { useState } from 'react';

// pendingMove = { cardId, newStageId, newOrder, stageName, missing: [{field, label}] }
// onFilled(updatedFields) — called with {price?, description?, source?, responsible_user_id?, contact_id?, custom_*?}
// onCancel()
export default function StageRequiredModal({ pendingMove, allUsers = [], allContacts = [], onFilled, onCancel }) {
  const { stageName, missing } = pendingMove;
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, val) => setValues(v => ({ ...v, [field]: val }));

  const handleSubmit = async () => {
    for (const f of missing) {
      const key = f.field === 'contact' ? 'contact_id'
                : f.field === 'responsible' ? 'responsible_user_id'
                : f.field;
      const v = values[key];
      if (v === undefined || v === null || v === '') {
        setError(`Preencha: ${f.label}`);
        return;
      }
      if (f.field === 'price' && (parseFloat(v) || 0) <= 0) {
        setError(`${f.label}: deve ser maior que 0`);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      onFilled(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: 'var(--bg-primary, #ffffff)', borderRadius: 14, width: 420, maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: '#fef3c7',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
            }}>⚠</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary, #0f172a)' }}>
                Campos obrigatórios
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 1 }}>
                Preencha os campos abaixo para mover para <strong>{stageName}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {missing.map(f => (
            <div key={f.field}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #64748b)', marginBottom: 5 }}>
                {f.label} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              {f.field === 'price' && (
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={values.price ?? ''}
                  onChange={e => set('price', parseFloat(e.target.value) || 0)}
                />
              )}
              {f.field === 'description' && (
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Descreva o negócio..."
                  style={{ resize: 'none', width: '100%', boxSizing: 'border-box' }}
                  value={values.description ?? ''}
                  onChange={e => set('description', e.target.value)}
                />
              )}
              {f.field === 'source' && (
                <select
                  className="form-input"
                  value={values.source ?? ''}
                  onChange={e => set('source', e.target.value)}
                >
                  <option value="">Selecionar...</option>
                  {['Site', 'Indicação', 'LinkedIn', 'Google Ads', 'Facebook', 'Email', 'Telefone', 'WhatsApp', 'Evento', 'Outro']
                    .map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {f.field === 'responsible' && (
                <select
                  className="form-input"
                  value={values.responsible_user_id ?? ''}
                  onChange={e => set('responsible_user_id', parseInt(e.target.value))}
                >
                  <option value="">Selecionar responsável...</option>
                  {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
              {f.field === 'contact' && (
                <select
                  className="form-input"
                  value={values.contact_id ?? ''}
                  onChange={e => set('contact_id', parseInt(e.target.value))}
                >
                  <option value="">Selecionar contato...</option>
                  {allContacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name || ''}
                    </option>
                  ))}
                </select>
              )}
              {f.field.startsWith('custom_') && (
                <input
                  className="form-input"
                  placeholder={`Valor para ${f.label}`}
                  value={values[f.field] ?? ''}
                  onChange={e => set(f.field, e.target.value)}
                />
              )}
            </div>
          ))}

          {error && (
            <div style={{
              fontSize: 12, color: '#ef4444', background: '#fef2f2',
              padding: '8px 12px', borderRadius: 6, border: '1px solid #fca5a5',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border, #e2e8f0)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button className="btn btn-ghost" onClick={onCancel} style={{ fontSize: 13 }}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving}
            style={{ fontSize: 13, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Salvando...' : 'Preencher e mover'}
          </button>
        </div>
      </div>
    </div>
  );
}
