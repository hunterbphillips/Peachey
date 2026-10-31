import { useState } from 'react';
import { api } from '../api/index.js';
import { ErrorNote, PeachMark } from '../components/ui.jsx';

// Email → 6-digit code. Typing the code (rather than tapping the link)
// matters on iPhone: a link opens Safari, not the home-screen app.
export function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.sendCode(email.trim());
      setStep('code');
    } catch (err) {
      setError(friendly(err.message));
    } finally { setBusy(false); }
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.verifyCode(email.trim(), code.replace(/\s/g, ''));
    } catch (err) {
      setError(friendly(err.message));
      setBusy(false);
    }
  }

  return (
    <main className="welcome">
      <div className="welcome-hero">
        <PeachMark size={88} />
        <h1>Peaches</h1>
      </div>
      <div className="glass panel welcome-card">
        {step === 'email' ? (
          <form onSubmit={send}>
            <label className="field">
              <span>Your email</span>
              <input type="email" inputMode="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <ErrorNote error={error} />
            <button className="gel-btn wide" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in code'}</button>
            <p className="fine">No password needed. We’ll send a code each time you sign in on a new device.</p>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p className="lede">We sent a code to <strong>{email}</strong>.</p>
            <label className="field">
              <span>Sign-in code</span>
              <input className="code-input" inputMode="numeric" autoComplete="one-time-code" required
                pattern="[0-9 ]{6,12}" maxLength={12} value={code}
                onChange={(e) => setCode(e.target.value)} placeholder="123456" />
            </label>
            {api.isDemo && <p className="fine">Demo: any six digits will work.</p>}
            <ErrorNote error={error} />
            <button className="gel-btn wide" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
            <button type="button" className="text-btn" onClick={() => { setStep('email'); setCode(''); setError(''); }}>
              Use a different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function friendly(msg = '') {
  if (/rate limit|security purposes/i.test(msg)) return 'Too many tries. Wait a minute, then ask for a new code.';
  if (/expired|invalid/i.test(msg)) return 'That code is wrong or has expired. Ask for a new one.';
  return msg;
}
