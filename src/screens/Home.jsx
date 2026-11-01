import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { Avatar, Spinner, Wordmark } from '../components/ui.jsx';
import { BellIcon, PeopleIcon, PlusIcon } from '../components/Icons.jsx';
import { timeAgo } from '../lib/format.js';
import { useRefreshOnFocus } from '../lib/hooks.js';

export function Home({ me, go, onCompose, refreshKey }) {
  const [friends, setFriends] = useState(null);
  const [requests, setRequests] = useState(0);
  const [unread, setUnread] = useState(0);
  const [myLast, setMyLast] = useState(undefined); // undefined = loading, null = no posts yet
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [f, members, u, mine] = await Promise.all([
        api.listFriends(), api.listMembers(), api.activityUnread().catch(() => 0),
        api.listPosts(me.id).catch(() => ({ posts: [] })),
      ]);
      setFriends(f);
      setMyLast(mine.posts[0] ?? null);
      setUnread(u);
      setRequests(members.filter((m) => m.status === 'received').length);
      setError('');
    } catch (e) { setError(e.message); }
  }, [me.id]);
  useEffect(() => { load(); }, [load, refreshKey]);
  useRefreshOnFocus(load);

  const newCount = friends?.filter((f) => f.has_new).length ?? 0;

  return (
    <>
      <header className="topbar">
        <Wordmark />
        <div className="topbar-actions">
          <button className="people-btn" onClick={() => go('/activity')}
            aria-label={unread ? `Activity, ${unread} new` : 'Activity'}>
            <BellIcon />
            {unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
          </button>
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
        <ul className="friend-list me-list">
          <li>
            <button className="friend-row" onClick={() => go(`/u/${me.id}`)} aria-label="Your page">
              <Avatar person={me} size={50} />
              <span className="friend-main">
                <span className="me-line">
                  <span className="friend-name">{me.display_name}</span>
                  <span className="me-tag">Your page</span>
                </span>
                <span className="friend-line">
                  <span className="friend-preview">
                    {myLast === undefined ? '\u00a0'
                      : myLast ? (myLast.body || (myLast.image_urls?.length || myLast.image_url ? '📷 Photo' : '🔗 Link'))
                      : 'Nothing posted yet'}
                  </span>
                  {myLast && <time dateTime={myLast.created_at}>{timeAgo(myLast.created_at)}</time>}
                </span>
              </span>
            </button>
          </li>
        </ul>

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
                    <span className="friend-name">{f.display_name}</span>
                    <span className="friend-line">
                      {f.has_new && <span className="new-mark">New</span>}
                      <span className="friend-preview">{f.last_post_preview ?? 'No posts yet'}</span>
                      {f.last_post_at && <time dateTime={f.last_post_at}>{timeAgo(f.last_post_at)}</time>}
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
