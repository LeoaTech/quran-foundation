import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const DEMO_ROLES = [
  {
    label: 'Super Admin', sub: 'All centers', initials: 'SA',
    style: { background: '#ede9fe', color: '#5b21b6' },
    phone: '+92 300 0000001', password: 'demo1234',
  },
  {
    label: 'Center Manager', sub: 'Gulshan', initials: 'CM',
    style: { background: 'var(--emerald-light)', color: 'var(--emerald)' },
    phone: '+92 300 0000002', password: 'demo1234',
  },
  {
    label: 'Teacher', sub: 'Ustad Tariq', initials: 'T',
    style: { background: 'var(--blue-light)', color: 'var(--blue)' },
    phone: '+92 300 0000003', password: 'demo1234',
  },
  {
    label: 'Student', sub: 'Fatima Ahmed', initials: 'S',
    style: { background: 'var(--gold-light)', color: 'var(--gold)' },
    phone: '+92 300 0000004', password: 'demo1234',
  },
];

export default function SignIn() {
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

  async function submit(credentials) {
    setError('');
    setBusy(true);
    try {
      await login(credentials);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Sign in failed. Check your credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      {/* ── LEFT PANEL ── */}
      <div className="auth-left">
        <div className="auth-left-pattern" />
        <div className="auth-left-geo" />

        <div className="auth-logo">
          <div className="auth-logo-arabic">قرآن فاؤنڈیشن</div>
          <div className="auth-logo-en">Quran Foundation LMS</div>
        </div>

        <div className="auth-left-content">
          <div className="auth-left-headline">
            Nurturing Hearts<br />Through Knowledge
          </div>
          <div className="auth-left-sub">
            A learning management system built for Quran schools — tracking
            progress, attendance, and homework across every center and class.
          </div>
        </div>

        <div className="auth-left-stats">
          <div className="auth-stat"><div className="auth-stat-num">7</div><div className="auth-stat-label">Centers</div></div>
          <div className="auth-stat"><div className="auth-stat-num">1,284</div><div className="auth-stat-label">Students</div></div>
          <div className="auth-stat"><div className="auth-stat-num">64</div><div className="auth-stat-label">Teachers</div></div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-right">
        <div className="auth-box">
          {/* Tab row (Sign in active) */}
          <div className="auth-tabs">
            <button className="auth-tab active">Sign in</button>
            <Link to="/signup" style={{ flex: 1, textDecoration: 'none' }}>
              <button className="auth-tab" style={{ width: '100%' }}>Sign up</button>
            </Link>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={(e) => { e.preventDefault(); submit({ phone, password }); }}>
            <div className="auth-title">Welcome back</div>
            <div className="auth-subtitle">Sign in to your Quran Foundation account</div>

            <div className="field">
              <label>Phone number</label>
              <input type="tel" placeholder="+92 3xx xxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>

            <button className="btn-auth" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="auth-divider">or try a demo role</div>
          <div className="demo-label">Click any role to preview that dashboard</div>

          <div className="role-demo">
            {DEMO_ROLES.map((r) => (
              <button
                key={r.label}
                type="button"
                className="role-card"
                onClick={() => submit({ phone: r.phone, password: r.password })}
                disabled={busy}
              >
                <div className="role-dot" style={r.style}>{r.initials}</div>
                <div>
                  <div className="role-info-name">{r.label}</div>
                  <div className="role-info-sub">{r.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
