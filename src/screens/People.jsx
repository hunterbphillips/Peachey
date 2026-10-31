import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { Avatar, Spinner } from '../components/ui.jsx';
import { BackIcon } from '../components/Icons.jsx';
import { FriendButton } from '../components/FriendButton.jsx';
import { useRefreshOnFocus } from '../lib/hooks.js';

export function People({ go, onRequestsChanged }) {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setMembers(await api.listMembers()); setError(''); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(load);

  function setStatus(id, status) {
    setMembers((list) => list.map((m) => (m.id === id ? { ...m, status } : m)));
    onRequestsChanged?.();
  }

  const requests = members?.filter((m) => m.status === 'received') ?? [];
  const everyone = members?.filter((m) => m.status !== 'received') ?? [];

  const row = (m) => (
    <li key={m.id} className="person-row">
      <button className="person-main" onClick={() => go(`/u/${m.id}`)}>
        <Avatar person={m} size={46} />
        <span className="friend-main">
          <span className="friend-name">{m.display_name}</span>
        </span>
      </button>
      <FriendButton person={m} status={m.status} onChange={(s) => setStatus(m.id, s)} />
    </li>
  );

  return (
    <>
      <header className="topbar">
        <button className="icon-btn back" onClick={() => go('/')} aria-label="Back to friends"><BackIcon /></button>
      </header>
      <main className="page">
        <div className="home-intro">
          <h1>People</h1>
          <p>Everyone on Peaches. Only your friends see your posts.</p>
        </div>
        {error && <p className="error-note" role="alert">Couldn’t load people. {error}</p>}
        {!members && !error && <Spinner />}

        {requests.length > 0 && (
          <>
            <h2 className="section-title">Friend requests <span>{requests.length}</span></h2>
            <ul className="glass panel person-list requests">{requests.map(row)}</ul>
          </>
        )}

        {members && (
          everyone.length === 0
            ? <div className="glass panel empty"><p>No one else has joined yet.</p></div>
            : (
              <>
                {requests.length > 0 && <h2 className="section-title">Everyone</h2>}
                <ul className="glass panel person-list">{everyone.map(row)}</ul>
              </>
            )
        )}
      </main>
    </>
  );
}
