import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { Avatar, Spinner, Wordmark } from '../components/ui.jsx';
import { PlusIcon } from '../components/Icons.jsx';
import { timeAgo } from '../lib/format.js';
import { useRefreshOnFocus } from '../lib/hooks.js';

export function Home({ me, go, onCompose, refreshKey }) {
  const [friends, setFriends] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setFriends(await api.listFriends()); setError(''); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);
  useRefreshOnFocus(load);

  const newCount = friends?.filter((f) => f.has_new).length ?? 0;

  return (
    <>
      <header className="topbar">
        <Wordmark />
        <button className="me-btn" onClick={() => go(`/u/${me.id}`)} aria-label="Your profile">
          <Avatar person={me} size={38} />
        </button>
      </header>

      <main className="page">
        <div className="home-intro">
          <h1>Friends</h1>
          <p>{friends == null ? ' ' : newCount === 0 ? 'You’re all caught up.' : `${newCount} with something new`}</p>
        </div>

        {error && <p className="error-note" role="alert">Couldn’t load your friends. {error}</p>}
        {friends == null && !error && <Spinner />}

        {friends && friends.length === 0 && (
          <div className="glass panel empty">
            <p>No one else is here yet.</p>
            {me.is_admin
              ? <button className="gel-btn" onClick={() => go('/invites')}>Get invite codes</button>
              : <p className="fine">Friends will show up here once they join.</p>}
          </div>
        )}

        {friends && friends.length > 0 && (
          <ul className="glass panel friend-list">
            {friends.map((f) => (
              <li key={f.id}>
                <button className="friend-row" onClick={() => go(`/u/${f.id}`)}>
                  <Avatar person={f} size={50} />
                  <span className="friend-main">
                    <span className="friend-name">{f.display_name}</span>
                    <span className="friend-preview">{f.last_post_preview ?? 'No posts yet'}</span>
                  </span>
                  <span className="friend-meta">
                    {f.last_post_at && <time dateTime={f.last_post_at}>{timeAgo(f.last_post_at)}</time>}
                    {f.has_new && <span className="droplet" aria-label="New posts" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <button className="fab" onClick={onCompose} aria-label="New post"><PlusIcon width={28} height={28} /></button>
    </>
  );
}
