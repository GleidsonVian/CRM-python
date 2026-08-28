import { useState } from 'react';
import { useAuth } from '../AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#0f172a',
      fontFamily: 'inherit',
    }}>
      {/* Left panel — branding */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 72px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background blobs */}
        <div style={{
          position: 'absolute', top: -120, left: -120, width: 480, height: 480,
          borderRadius: '50%', background: 'radial-gradient(circle, #6366f140 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, right: -80, width: 360, height: 360,
          borderRadius: '50%', background: 'radial-gradient(circle, #818cf830 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 64, position: 'relative' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 24, letterSpacing: '-0.5px',
            boxShadow: '0 4px 16px #6366f150',
          }}>N</div>
          <span style={{ fontWeight: 700, fontSize: 22, color: '#f1f5f9', letterSpacing: '-0.3px' }}>Nexus CRM</span>
        </div>

        {/* Headline */}
        <div style={{ position: 'relative' }}>
          <h1 style={{
            fontSize: 44, fontWeight: 800, color: '#f8fafc',
            lineHeight: 1.15, margin: '0 0 20px', letterSpacing: '-1px',
          }}>
            Gerencie seus<br />
            <span style={{ color: '#818cf8' }}>negócios</span> com<br />
            inteligência.
          </h1>
          <p style={{ fontSize: 17, color: '#94a3b8', lineHeight: 1.7, maxWidth: 360, margin: 0 }}>
            Pipeline de vendas, leads, automações e relatórios — tudo em um só lugar para sua equipe crescer mais rápido.
          </p>
        </div>

        {/* Feature bullets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 48, position: 'relative' }}>
          {[
            { icon: '⚡', text: 'Automações inteligentes de pipeline' },
            { icon: '📊', text: 'Relatórios e métricas em tempo real' },
            { icon: '🔗', text: 'Webhooks e integrações via API' },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#1e293b', border: '1px solid #334155',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, flexShrink: 0,
              }}>{icon}</div>
              <span style={{ fontSize: 15, color: '#94a3b8' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{
        width: 460,
        flexShrink: 0,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 52px',
        borderLeft: '1px solid #1e293b',
      }}>
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            Entrar
          </h2>
          <p style={{ fontSize: 16, color: '#94a3b8', margin: 0 }}>
            Acesse sua conta para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1.5px solid #e2e8f0', borderRadius: 10,
                padding: '11px 14px', fontSize: 16, outline: 'none',
                color: '#0f172a', background: '#f8fafc',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                fontFamily: 'inherit',
              }}
              onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px #6366f118'; e.target.style.background = '#fff'; }}
              onBlur={e =>  { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f8fafc'; }}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: '1.5px solid #e2e8f0', borderRadius: 10,
                  padding: '11px 44px 11px 14px', fontSize: 16, outline: 'none',
                  color: '#0f172a', background: '#f8fafc',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  fontFamily: 'inherit',
                }}
                onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px #6366f118'; e.target.style.background = '#fff'; }}
                onBlur={e =>  { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f8fafc'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  color: '#94a3b8', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center',
                }}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5',
              color: '#dc2626', borderRadius: 8, padding: '10px 14px',
              fontSize: 15, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px 0', fontSize: 16, fontWeight: 700,
              background: loading ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              color: '#fff', border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 14px #6366f140',
              transition: 'all 0.15s', letterSpacing: '0.02em',
              marginTop: 4,
            }}
            onMouseEnter={e => { if (!loading) e.target.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.target.style.transform = 'none'; }}
          >
            {loading ? 'Entrando…' : 'Entrar →'}
          </button>
        </form>

        {/* Footer hint */}
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #f1f5f9' }}>
          <details style={{ cursor: 'pointer' }}>
            <summary style={{ fontSize: 14, color: '#94a3b8', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12 }}>▶</span> Primeiro acesso?
            </summary>
            <div style={{
              marginTop: 10, padding: '10px 12px',
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
              fontSize: 13, color: '#64748b', lineHeight: 1.7,
            }}>
              Configure a senha via API:<br />
              <code style={{ fontFamily: 'monospace', color: '#475569' }}>POST /auth/set-password</code><br />
              <code style={{ fontFamily: 'monospace', color: '#475569' }}>{'{"email":"...","password":"..."}'}</code>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
