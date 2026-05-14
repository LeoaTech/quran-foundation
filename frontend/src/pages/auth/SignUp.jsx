import { useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';

export default function SignUp() {
  const [firstName,    setFirstName]    = useState('');
  const [lastName,     setLastName]     = useState('');
  const [fullNameUr,   setFullNameUr]   = useState('');
  const [phone,        setPhone]        = useState('');
  const [approvalCode, setApprovalCode] = useState('');
  const [password,     setPassword]     = useState('');
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState(false);
  const [busy,         setBusy]         = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await client.post('/auth/signup', {
        full_name:    `${firstName} ${lastName}`.trim(),
        full_name_ur: fullNameUr || undefined,
        phone,
        password,
        approval_code: approvalCode,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Registration failed.');
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
            Register with your center manager's approval code to join your
            Quran Foundation center.
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
          {/* Tab row (Sign up active) */}
          <div className="auth-tabs">
            <Link to="/auth/signin" style={{ flex: 1, textDecoration: 'none' }}>
              <button className="auth-tab" style={{ width: '100%' }}>Sign in</button>
            </Link>
            <button className="auth-tab active">Sign up</button>
          </div>

          {error   && <div className="auth-error">{error}</div>}

          {success ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
              <div className="auth-title">Account created</div>
              <div className="auth-subtitle" style={{ marginBottom: 24 }}>
                Your account is pending approval by your center manager.
              </div>
              <Link to="/auth/signin">
                <button className="btn-auth" style={{ width: 'auto', padding: '12px 32px' }}>
                  Back to sign in
                </button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
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
                <input type="tel" placeholder="+92 3xx xxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" />
              </div>

              <div className="field">
                <label>Center approval code</label>
                <input type="text" placeholder="e.g. GUL-2026" value={approvalCode} onChange={(e) => setApprovalCode(e.target.value)} required />
              </div>

              <div className="field">
                <label>Password</label>
                <input type="password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>

              <button className="btn-auth" type="submit" disabled={busy}>
                {busy ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
