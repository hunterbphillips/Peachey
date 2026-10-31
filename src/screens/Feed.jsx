import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { Avatar, ConfirmBar, Menu, Spinner } from '../components/ui.jsx';
import { BackIcon, MoreIcon, PlusIcon } from '../components/Icons.jsx';
import { PostCard } from '../components/PostCard.jsx';
import { FriendButton } from '../components/FriendButton.jsx';
import { useRefreshOnFocus } from '../lib/hooks.js';

export function Feed({ userId, me, go, onCompose, onEdit, refreshKey }) {
  const isMe = userId === me.id;
  const [person, setPerson] = useState(isMe ? me : null);
  const [status, setStatus] = useState(isMe ? 'me' : null);
  const [posts, setPosts] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmUnfriend, setConfirmUnfriend] = useState(false);

  const load = useCallback(async () => {
    try {
      const [prof, rel] = await Promise.all([
        isMe ? me : api.getProfile(userId),
        isMe ? 'me' : api.friendshipStatus(userId),
      ]);
      if (!prof) { setError('This person isn’t on Peachey.'); return; }
      setPerson(prof); setStatus(rel); setError('');
      if (rel === 'me' || rel === 'friends') {
        const page = await api.listPosts(userId);
        setPosts(page.posts); setHasMore(page.hasMore);
        if (!isMe) api.markViewed(userId);
      } else {
        setPosts([]); setHasMore(false);
      }
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

  async function unfriend() {
    await api.removeFriend(userId);
    setConfirmUnfriend(false);
    await load();
  }

  function changed(newStatus) {
    setStatus(newStatus);
    if (newStatus === 'friends') load();
  }

  const firstName = person?.display_name?.split(' ')[0];
  const canSeePosts = status === 'me' || status === 'friends';

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
        {status === 'friends' && (
          <Menu label={`Options for ${person?.display_name ?? 'this person'}`} trigger={<MoreIcon />} items={[
            { label: 'Remove friend', onClick: () => setConfirmUnfriend(true), danger: true },
          ]} />
        )}
      </header>

      <main className="page">
        {error && <p className="error-note" role="alert">{error}</p>}
        {person && (
          <section className="profile-head">
            <Avatar person={person} size={88} />
            <h1>{person.display_name}</h1>
            {person.bio && <p>{person.bio}</p>}
            {isMe && <span className="you-tag">This is you</span>}
            {status === 'friends' && <span className="you-tag">Friends</span>}
          </section>
        )}

        {confirmUnfriend && (
          <ConfirmBar text={`Remove ${firstName} as a friend? You’ll stop seeing each other’s posts.`}
            action="Remove friend" onCancel={() => setConfirmUnfriend(false)} onConfirm={unfriend} />
        )}

        {person && status && !canSeePosts && (
          <div className="glass panel empty not-friends">
            <p>
              {status === 'received' && `${firstName} wants to be friends. Accept to see each other’s posts.`}
              {status === 'sent' && `You’ve asked ${firstName} to be friends. Their posts will show here once they accept.`}
              {status === 'none' && `You and ${firstName} aren’t friends yet. Friends see each other’s posts.`}
            </p>
            <FriendButton person={person} status={status} onChange={changed} />
          </div>
        )}

        {canSeePosts && posts == null && !error && <Spinner />}
        {!status && !error && <Spinner />}

        {canSeePosts && posts && posts.length === 0 && (
          <div className="glass panel empty">
            {isMe ? (
              <>
                <p>Your friends will see your posts here.</p>
                <button className="gel-btn" onClick={onCompose}>Write your first post</button>
              </>
            ) : <p>{firstName} hasn’t posted yet.</p>}
          </div>
        )}

        {canSeePosts && posts && posts.map((p) => (
          <PostCard key={p.id + (p.edited_at ?? '')} post={p} me={me} author={person} onEdit={onEdit}
            onDeleted={(id) => setPosts((list) => list.filter((x) => x.id !== id))} />
        ))}

        {canSeePosts && hasMore && (
          <button className="pill-btn more" onClick={more} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Show older posts'}
          </button>
        )}
      </main>

      {isMe && <button className="fab" onClick={onCompose} aria-label="New post"><PlusIcon width={28} height={28} /></button>}
    </>
  );
}
