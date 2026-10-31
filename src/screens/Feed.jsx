import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { Avatar, Spinner } from '../components/ui.jsx';
import { BackIcon, PlusIcon } from '../components/Icons.jsx';
import { PostCard } from '../components/PostCard.jsx';
import { useRefreshOnFocus } from '../lib/hooks.js';

export function Feed({ userId, me, go, onCompose, onEdit, refreshKey }) {
  const isMe = userId === me.id;
  const [person, setPerson] = useState(isMe ? me : null);
  const [posts, setPosts] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      const [prof, page] = await Promise.all([isMe ? me : api.getProfile(userId), api.listPosts(userId)]);
      if (!prof) { setError('This person isn’t on Peachey.'); return; }
      setPerson(prof); setPosts(page.posts); setHasMore(page.hasMore); setError('');
      if (!isMe) api.markViewed(userId);
    } catch (e) { setError(e.message); }
  }, [userId, isMe, me]);

  useEffect(() => { window.scrollTo(0, 0); }, [userId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  useRefreshOnFocus(load);

  async function more() {
    setLoadingMore(true);
    try {
      const page = await api.listPosts(userId, posts.at(-1).created_at);
      setPosts((p) => [...p, ...page.posts]); setHasMore(page.hasMore);
    } finally { setLoadingMore(false); }
  }

  const firstName = person?.display_name?.split(' ')[0];

  return (
    <>
      <header className="topbar">
        <button className="icon-btn back" onClick={() => go('/')} aria-label="Back to friends"><BackIcon /></button>
        {isMe && (
          <div className="topbar-actions">
            {me.is_admin && <button className="pill-btn" onClick={() => go('/invites')}>Invite codes</button>}
            <button className="pill-btn" onClick={() => go('/me/edit')}>Edit profile</button>
          </div>
        )}
      </header>

      <main className="page">
        {error && <p className="error-note" role="alert">{error}</p>}
        {person && (
          <section className="profile-head">
            <Avatar person={person} size={88} />
            <h1>{isMe ? `${person.display_name}` : person.display_name}</h1>
            {person.bio && <p>{person.bio}</p>}
            {isMe && <span className="you-tag">This is you</span>}
          </section>
        )}

        {posts == null && !error && <Spinner />}

        {posts && posts.length === 0 && (
          <div className="glass panel empty">
            {isMe ? (
              <>
                <p>Your friends will see your posts here.</p>
                <button className="gel-btn" onClick={onCompose}>Write your first post</button>
              </>
            ) : <p>{firstName} hasn’t posted yet.</p>}
          </div>
        )}

        {posts && posts.map((p) => (
          <PostCard key={p.id + (p.edited_at ?? '')} post={p} me={me} onEdit={onEdit}
            onDeleted={(id) => setPosts((list) => list.filter((x) => x.id !== id))} />
        ))}

        {hasMore && (
          <button className="pill-btn more" onClick={more} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Show older posts'}
          </button>
        )}
      </main>

      {isMe && <button className="fab" onClick={onCompose} aria-label="New post"><PlusIcon width={28} height={28} /></button>}
    </>
  );
}
