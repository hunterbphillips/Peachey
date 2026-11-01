import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api/index.js';
import { Avatar, ConfirmBar, Menu, Spinner } from '../components/ui.jsx';
import { BackIcon, MoreIcon, PlusIcon } from '../components/Icons.jsx';
import { PostCard } from '../components/PostCard.jsx';
import { FriendButton } from '../components/FriendButton.jsx';
import { agoLong } from '../lib/format.js';

// A person's page reads like a conversation: it opens at the newest post at
// the bottom, and scrolling up reveals older posts (loaded as you get near
// the top, keeping your place). Their photo and name stay in the top bar.
const docHeight = () => document.documentElement.scrollHeight;
const distanceFromBottom = () => docHeight() - (window.scrollY + window.innerHeight);

// "Active now" within five minutes, otherwise "Last seen 3 hours ago".
function lastSeenText(iso) {
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 5) return 'Active now';
  return `Last seen ${agoLong(iso)}`;
}

export function Feed({ userId, me, go, onCompose, onEdit, refreshKey, focusPostId, openComments }) {
  const isMe = userId === me.id;
  const [person, setPerson] = useState(isMe ? me : null);
  const [status, setStatus] = useState(isMe ? 'me' : null);
  const [posts, setPosts] = useState(null);           // newest first, as the server sends them
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [confirmUnfriend, setConfirmUnfriend] = useState(false);
  const [seenAt, setSeenAt] = useState(null);

  const pinned = useRef(!focusPostId);   // keep the view at the bottom while the page settles
  const restore = useRef(null);          // distance from bottom to restore after adding older posts
  const topSentinel = useRef(null);
  const mainRef = useRef(null);

  const load = useCallback(async ({ pin = true } = {}) => {
    try {
      const [prof, rel] = await Promise.all([
        isMe ? me : api.getProfile(userId),
        isMe ? 'me' : api.friendshipStatus(userId),
      ]);
      if (!prof) { setError('This person isn’t on Peaches.'); return; }
      setPerson(prof); setStatus(rel); setError('');
      if (rel === 'friends') api.lastSeen(userId).then(setSeenAt).catch(() => {});
      if (rel === 'me' || rel === 'friends') {
        const page = await api.listPosts(userId);
        if (pin && !focusPostId) pinned.current = true;
        setPosts(page.posts); setHasMore(page.hasMore);
        if (!isMe) api.markViewed(userId);
      } else {
        setPosts([]); setHasMore(false);
      }
    } catch (e) { setError(e.message); }
  }, [userId, isMe, me, focusPostId]);

  useEffect(() => { pinned.current = !focusPostId || refreshKey > 0; load(); }, [load, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Coming back to the app: refresh only if you're already at the newest posts,
  // so nobody reading further up gets yanked around.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && distanceFromBottom() < 200) load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  // Stay pinned to the bottom until the reader takes over (touch, wheel, keys).
  useEffect(() => {
    const unpin = () => { pinned.current = false; };
    window.addEventListener('touchstart', unpin, { passive: true });
    window.addEventListener('wheel', unpin, { passive: true });
    window.addEventListener('keydown', unpin);
    // photos finishing loading can still nudge the layout; follow them down
    const el = mainRef.current;
    const onLoad = () => { if (pinned.current) window.scrollTo(0, docHeight()); };
    el?.addEventListener('load', onLoad, true);
    return () => {
      window.removeEventListener('touchstart', unpin);
      window.removeEventListener('wheel', unpin);
      window.removeEventListener('keydown', unpin);
      el?.removeEventListener('load', onLoad, true);
    };
  }, []);

  // After every change to the list: either keep your place (older posts were
  // added above) or sit at the bottom (fresh load).
  useLayoutEffect(() => {
    if (!posts) return;
    if (restore.current != null) {
      window.scrollTo(0, docHeight() - window.innerHeight - restore.current);
      restore.current = null;
    } else if (pinned.current) {
      window.scrollTo(0, docHeight());
    }
  }, [posts]);

  // Load older posts when the top of the list comes near.
  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || !posts?.length) return;
    setLoadingOlder(true);
    try {
      const page = await api.listPosts(userId, posts.at(-1).created_at);
      restore.current = distanceFromBottom();
      setPosts((p) => [...p, ...page.posts]); setHasMore(page.hasMore);
    } finally { setLoadingOlder(false); }
  }, [loadingOlder, hasMore, posts, userId]);

  useEffect(() => {
    const el = topSentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !pinned.current) loadOlder();
    }, { rootMargin: '400px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadOlder]);

  // Arriving from Activity: scroll to that post and give it a brief highlight.
  const [focused, setFocused] = useState(null);
  useEffect(() => {
    if (!focusPostId || !posts?.length || focused === focusPostId) return;
    const el = document.getElementById(`post-${focusPostId}`);
    if (!el) return;
    setFocused(focusPostId);
    pinned.current = false;
    el.scrollIntoView({ block: 'start' });
    el.classList.add('focus');
    setTimeout(() => el.classList.remove('focus'), 2200);
  }, [focusPostId, posts, focused]);

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
  const oldestFirst = posts ? [...posts].reverse() : null;

  // Your own settings live behind the gear on the home screen.
  const menuItems = isMe
    ? []
    : status === 'friends'
      ? [{ label: 'Remove friend', onClick: () => setConfirmUnfriend(true), danger: true }]
      : [];

  return (
    <>
      <header className="topbar feed-bar">
        <button className="icon-btn back" onClick={() => go('/')} aria-label="Back to friends"><BackIcon /></button>
        {person && (
          <div className="feed-who">
            <Avatar person={person} size={34} />
            <div className="feed-name-wrap">
              <h1 className="feed-name">{person.display_name}</h1>
              {status === 'friends' && seenAt && <span className="feed-seen">{lastSeenText(seenAt)}</span>}
            </div>
          </div>
        )}
        {menuItems.length > 0 && (
          <Menu label={isMe ? 'Profile options' : `Options for ${person?.display_name ?? 'this person'}`}
            trigger={<MoreIcon />} items={menuItems} />
        )}
      </header>

      <main className="page feed-page" ref={mainRef}>
        {error && <p className="error-note" role="alert">{error}</p>}

        {confirmUnfriend && (
          <ConfirmBar text={`Remove ${firstName} as a friend? You’ll stop seeing each other’s posts.`}
            action="Remove friend" onCancel={() => setConfirmUnfriend(false)} onConfirm={unfriend} />
        )}

        {person && status && !canSeePosts && (
          <div className="empty not-friends">
            <p>
              {status === 'received' && `${firstName} wants to be friends. Accept to see each other’s posts.`}
              {status === 'sent' && `You’ve asked ${firstName} to be friends. Their posts will show here once they accept.`}
              {status === 'none' && `You and ${firstName} aren’t friends yet. Friends see each other’s posts.`}
            </p>
            <FriendButton person={person} status={status} onChange={changed} />
          </div>
        )}

        {((canSeePosts && posts == null) || !status) && !error && <Spinner />}

        {canSeePosts && posts && posts.length === 0 && (
          <div className="empty">
            {isMe ? (
              <>
                <p>Your friends will see your posts here.</p>
                <button className="gel-btn" onClick={onCompose}>Write your first post</button>
              </>
            ) : <p>{firstName} hasn’t posted yet.</p>}
          </div>
        )}

        {canSeePosts && posts && posts.length > 0 && (
          <>
            <div ref={topSentinel} className="feed-top">
              {hasMore
                ? (loadingOlder ? <Spinner label="Loading older posts" /> : <span className="feed-start">Scroll up for older posts</span>)
                : <span className="feed-start">The beginning of {isMe ? 'your' : `${firstName}’s`} posts</span>}
            </div>
            {oldestFirst.map((p) => (
              <PostCard key={p.id + (p.edited_at ?? '')} post={p} me={me} author={person} onEdit={onEdit}
                startWithComments={openComments && p.id === focusPostId}
                onDeleted={(id) => setPosts((list) => list.filter((x) => x.id !== id))} />
            ))}
          </>
        )}
      </main>

      {isMe && <button className="fab" onClick={onCompose} aria-label="New post"><PlusIcon width={28} height={28} /></button>}
    </>
  );
}
