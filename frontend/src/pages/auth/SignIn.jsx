import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const DEMO_ROLES = [
  { label: 'Super Admin',     sub: 'All centers',   initials: 'SA', style: { background: '#ede9fe', color: '#5b21b6' }, phone: '+92 300 0000001', password: 'demo1234' },
  { label: 'Center Manager',  sub: 'Gulshan',       initials: 'CM', style: { background: 'var(--emerald-light)', color: 'var(--emerald)' }, phone: '+92 300 0000002', password: 'demo1234' },
  { label: 'Teacher',         sub: 'Ustad Tariq',   initials: 'T',  style: { background: 'var(--blue-light)', color: 'var(--blue)' }, phone: '+92 300 0000003', password: 'demo1234' },
  { label: 'Student',         sub: 'Fatima Ahmed',  initials: 'S',  style: { background: 'var(--gold-light)', color: 'var(--gold)' }, phone: '+92 300 0000004', password: 'demo1234' },
];

export default function SignIn() {
  const { signIn } = useAuth();
  const navigate   = useNavigate();

  const [tab,      setTab]      = useState('signin');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

  // Sign-up fields
  const [firstName,    setFirstName]    = useState('');
  const [lastName,     setLastName]     = useState('');
  const [fullNameUr,   setFullNameUr]   = useState('');
  const [signupPhone,  setSignupPhone]  = useState('');
  const [approvalCode, setApprovalCode] = useState('');
  const [signupPwd,    setSignupPwd]    = useState('');

  async function handleSignIn(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn({ phone, password });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDemoLogin(demo) {
    setError('');
    setBusy(true);
    try {
      await signIn({ phone: demo.phone, password: demo.password });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Demo login failed.');
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
          <div className="auth-stat">
            <div className="auth-stat-num">7</div>
            <div className="auth-stat-label">Centers</div>
          </div>
          <div className="auth-stat">
            <div className="auth-stat-num">1,284</div>
            <div className="auth-stat-label">Students</div>
          </div>
          <div className="auth-stat">
            <div className="auth-stat-num">64</div>
            <div className="auth-stat-label">Teachers</div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-right">
        <div className="auth-box">
          {/* Tabs */}
          <div className="auth-tabs">
            <button className={`auth-tab${tab === 'signin' ? ' active' : ''}`} onClick={() => { setTab('signin'); setError(''); }}>
              Sign in
            </button>
            <button className={`auth-tab${tab === 'signup' ? ' active' : ''}`} onClick={() => { setTab('signup'); setError(''); }}>
              Sign up
            </button>
          </div>

          {error && <div className="auth-error">{error}</div>}

          {/* ── SIGN IN ── */}
          {tab === 'signin' && (
            <form onSubmit={handleSignIn}>
              <div className="auth-title">Welcome back</div>
              <div className="auth-subtitle">Sign in to your Quran Foundation account</div>

              <div className="field">
                <label>Phone number</label>
                <input
                  type="tel"
                  placeholder="+92 3xx xxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button className="btn-auth" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>

              <div className="auth-divider">or try a demo role</div>
              <div className="demo-label">Click any role to preview that dashboard</div>

              <div className="role-demo">
                {DEMO_ROLES.map((role) => (
                  <button
                    key={role.label}
                    type="button"
                    className="role-card"
                    onClick={() => handleDemoLogin(role)}
                    disabled={busy}
                  >
                    <div className="role-dot" style={role.style}>{role.initials}</div>
                    <div>
                      <div className="role-info-name">{role.label}</div>
                      <div className="role-info-sub">{role.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </form>
          )}

          {/* ── SIGN UP ── */}
          {tab === 'signup' && (
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="auth-title">Create account</div>
              <div className="auth-subtitle">Register with your center manager's approval code</div>

              <div className="field-row">
                <div className="field">
                  <label>First name</label>
                  <input type="text" placeholder="e.g. Hamza" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Last name</label>
                  <input type="text" placeholder="e.g. Rauf" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>

              <div className="field">
                <label>Full name (Urdu) — اردو نام</label>
                <input
                  type="text"
                  placeholder="حمزہ رؤف"
                  dir="rtl"
                  style={{ fontFamily: "'Amiri', serif", fontSize: 16 }}
                  value={fullNameUr}
                  onChange={(e) => setFullNameUr(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Phone number</label>
                <input type="tel" placeholder="+92 3xx xxxxxxx" value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)} required />
              </div>

              <div className="field">
                <label>Center approval code</label>
                <input type="text" placeholder="e.g. GUL-2026" value={approvalCode} onChange={(e) => setApprovalCode(e.target.value)} required />
              </div>

              <div className="field">
                <label>Password</label>
                <input type="password" placeholder="Min. 8 characters" value={signupPwd} onChange={(e) => setSignupPwd(e.target.value)} required />
              </div>

              <button className="btn-auth" type="submit">Create account</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
