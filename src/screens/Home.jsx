import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { Avatar, Spinner, Wordmark } from '../components/ui.jsx';
import { PeopleIcon, PlusIcon } from '../components/Icons.jsx';
import { timeAgo } from '../lib/format.js';
import { useRefreshOnFocus } from '../lib/hooks.js';

export function Home({ me, go, onCompose, refreshKey }) {
  const [friends, setFriends] = useState(null);
  const [requests, setRequests] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [f, members] = await Promise.all([api.listFriends(), api.listMembers()]);
      setFriends(f);
      setRequests(members.filter((m) => m.status === 'received').length);
      setError('');
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);
  useRefreshOnFocus(load);

  const newCount = friends?.filter((f) => f.has_new).length ?? 0;

  return (
    <>
      <header className="topbar">
        <Wordmark />
        <div className="topbar-actions">
          <button className="people-btn" onClick={() => go('/people')}
            aria-label={requests ? `People, ${requests} friend request${requests > 1 ? 's' : ''}` : 'People'}>
            <PeopleIcon />
            {requests > 0 && <span className="badge">{requests}</span>}
          </button>
          <button className="me-btn" onClick={() => go(`/u/${me.id}`)} aria-label="Your profile">
            <Avatar person={me} size={38} />
          </button>
        </div>
      </header>

      <main className="page">
        <div className="home-intro">
          <h1>Friends</h1>
          <p>{friends == null ? ' ' : newCount === 0 ? 'You’re all caught up.' : `${newCount} with something new`}</p>
        </div>

        {error && <p className="error-note" role="alert">Couldn’t load your friends. {error}</p>}
        {friends == null && !error && <Spinner />}

        {requests > 0 && (
          <button className="glass panel request-nudge" onClick={() => go('/people')}>
            <span className="new-mark" aria-hidden="true">New</span>
            {requests === 1 ? '1 friend request is waiting' : `${requests} friend requests are waiting`}
          </button>
        )}

        {friends && friends.length === 0 && (
          <div className="glass panel empty">
            <p>Your friends’ posts will show up here.</p>
            <button className="gel-btn" onClick={() => go('/people')}>Find friends</button>
            {me.is_admin && <button className="text-btn" onClick={() => go('/invites')}>Get invite codes</button>}
          </div>
        )}

        {friends && friends.length > 0 && (
          <ul className="glass panel friend-list">
            {friends.map((f) => (
              <li key={f.id}>
                <button className={`friend-row ${f.has_new ? 'is-new' : ''}`} onClick={() => go(`/u/${f.id}`)}>
                  <Avatar person={f} size={50} />
                  <span className="friend-main">
                    <span className="friend-line">
                      <span className="friend-name">{f.display_name}</span>
                      <span className="leader" aria-hidden="true" />
                      {f.last_post_at && <time dateTime={f.last_post_at}>{timeAgo(f.last_post_at)}</time>}
                    </span>
                    <span className="friend-preview">
                      {f.has_new && <span className="new-mark">New</span>}
                      {f.last_post_preview ?? 'No posts yet'}
                    </span>
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
