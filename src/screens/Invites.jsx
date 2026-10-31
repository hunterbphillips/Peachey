import { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { Spinner } from '../components/ui.jsx';
import { BackIcon, CheckIcon, CopyIcon } from '../components/Icons.jsx';
import { timeAgo } from '../lib/format.js';

export function Invites({ me, go }) {
  const [codes, setCodes] = useState(null);
  const [copied, setCopied] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.listInvites().then(setCodes).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const [manual, setManual] = useState(null); // invite text to copy by hand if the clipboard is blocked
  const inviteText = (code) =>
    `You’re invited to Peachey! Sign in at ${window.location.origin} and use this invite code: ${code}`;

  function copy(code) {
    const text = inviteText(code);
    navigator.clipboard.writeText(text)
      .then(() => { setCopied(code); setManual(null); setTimeout(() => setCopied(null), 1600); })
      .catch(() => setManual(text));
  }

  async function makeMore() {
    setBusy(true);
    try { await api.createInvites(10); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (!me.is_admin) return <main className="page"><p className="error-note">Only the admin can see invite codes.</p></main>;

  const unused = codes?.filter((c) => !c.used_at) ?? [];
  const used = codes?.filter((c) => c.used_at) ?? [];

  return (
    <>
      <header className="topbar">
        <button className="icon-btn back" onClick={() => go(`/u/${me.id}`)} aria-label="Back to your profile"><BackIcon /></button>
      </header>
      <main className="page">
        <div className="home-intro">
          <h1>Invite codes</h1>
          <p>Each code works once. Copy one to send a ready-made invite message.</p>
        </div>
        {error && <p className="error-note" role="alert">{error}</p>}
        {!codes && !error && <Spinner />}
        {codes && (
          <>
            {manual && (
              <label className="field glass panel manual-copy">
                <span>Copy this invite and send it</span>
                <textarea id="manual-invite" readOnly rows={3} value={manual} onFocus={(e) => e.target.select()} autoFocus />
              </label>
            )}
            <h2 className="section-title">Ready to send <span>{unused.length}</span></h2>
            <ul className="glass panel code-list">
              {unused.map((c) => (
                <li key={c.code}>
                  <code>{c.code}</code>
                  <button className="pill-btn" onClick={() => copy(c.code)} aria-label={`Copy invite ${c.code}`}>
                    {copied === c.code ? <><CheckIcon width={16} height={16} /> Copied</> : <><CopyIcon width={16} height={16} /> Copy invite</>}
                  </button>
                </li>
              ))}
              {unused.length === 0 && <li className="fine">All codes are used. Make more below.</li>}
            </ul>
            <button className="gel-btn" onClick={makeMore} disabled={busy}>{busy ? 'Making codes…' : 'Make 10 more codes'}</button>

            {used.length > 0 && (
              <>
                <h2 className="section-title">Used <span>{used.length}</span></h2>
                <ul className="glass panel code-list used">
                  {used.map((c) => (
                    <li key={c.code}>
                      <code>{c.code}</code>
                      <span className="used-by">{c.used_by_name ?? 'Someone'} · {timeAgo(c.used_at)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
