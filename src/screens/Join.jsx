import { useState } from 'react';
import { api } from '../api/index.js';
import { ErrorNote, PeachMark } from '../components/ui.jsx';

export function Join({ onJoined }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.redeemInvite(code, name);
      await onJoined();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="welcome">
      <div className="welcome-hero">
        <PeachMark size={64} />
        <h1>Welcome in</h1>
        <p>Enter the invite code a friend gave you.</p>
      </div>
      <form className="glass panel welcome-card" onSubmit={submit}>
        <label className="field">
          <span>Invite code</span>
          <input className="code-input" autoCapitalize="characters" autoComplete="off" spellCheck="false" required
            value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PEACH-XXXX-XXXX" />
        </label>
        {api.isDemo && (
          <p className="fine">Demo: try <button type="button" className="text-btn inline" onClick={() => setCode(api.demoInviteCode())}>{api.demoInviteCode()}</button></p>
        )}
        <label className="field">
          <span>Your name, as friends will see it</span>
          <input autoComplete="name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last, or a nickname" />
        </label>
        <ErrorNote error={error} />
        <button className="gel-btn wide" disabled={busy}>{busy ? 'Joining…' : 'Join Peaches'}</button>
        <button type="button" className="text-btn" onClick={() => api.signOut()}>Sign out</button>
      </form>
    </main>
  );
}
