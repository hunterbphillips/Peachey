import { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { Avatar, Spinner } from '../components/ui.jsx';
import { BackIcon } from '../components/Icons.jsx';
import { FriendButton } from '../components/FriendButton.jsx';
import { timeAgo } from '../lib/format.js';
import { groupActivity as group } from '../lib/activity.js';

// Names for a grouped line: "Ruth", "Ruth and Priya", "Ruth, Priya and 2 others".
function Names({ names }) {
  const b = (n) => <strong key={n}>{n}</strong>;
  if (names.length === 1) return b(names[0]);
  if (names.length === 2) return <>{b(names[0])} and {b(names[1])}</>;
  if (names.length === 3) return <>{b(names[0])}, {b(names[1])} and {b(names[2])}</>;
  return <>{b(names[0])}, {b(names[1])} and {names.length - 2} others</>;
}

// One line of plain English for each kind of activity.
function describe(item, me) {
  const who = <Names names={item.names} />;
  const whose = item.post_author_id === me.id ? 'your'
    : item.post_author_id === item.actor_id ? 'their' : `${item.post_author_name}’s`;
  switch (item.kind) {
    case 'heart_post': return <>{who} hearted your post</>;
    case 'comment': return <>{who} commented on your post</>;
    case 'heart_comment': return <>{who} hearted your comment on {whose} post</>;
    case 'thread_comment': return <>{who} also commented on {whose} post</>;
    case 'friend_request': return <>{who} wants to be friends</>;
    case 'friend_accepted': return <>{who} accepted your friend request</>;
    case 'joined': return <>{who} joined Peaches with your invite</>;
    default: return who;
  }
}

const HEART_KINDS = new Set(['heart_post', 'heart_comment']);

export function Activity({ me, go, onSeen }) {
  const [items, setItems] = useState(null);
  const [seenBefore, setSeenBefore] = useState(null);
  const [error, setError] = useState('');
  const [requestState, setRequestState] = useState({}); // actor_id -> friendship status after acting here

  useEffect(() => {
    (async () => {
      try {
        const list = await api.listActivity();
        const previous = await api.markActivitySeen();
        setItems(group(list));
        setSeenBefore(previous);
        onSeen?.();
      } catch (e) { setError(e.message); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function open(item) {
    if (item.post_id) {
      const comments = item.kind === 'comment' || item.kind === 'thread_comment' || item.kind === 'heart_comment';
      go(`/u/${item.post_author_id}/p/${item.post_id}${comments ? '/c' : ''}`);
    } else {
      go(`/u/${item.actor_id}`);
    }
  }

  return (
    <>
      <header className="topbar">
        <button className="icon-btn back" onClick={() => go('/')} aria-label="Back to friends"><BackIcon /></button>
      </header>
      <main className="page">
        <div className="home-intro">
          <h1>Activity</h1>
          <p>Hearts, comments and friends, newest first.</p>
        </div>
        {error && <p className="error-note" role="alert">Couldn’t load activity. {error}</p>}
        {!items && !error && <Spinner />}
        {items && items.length === 0 && (
          <div className="empty"><p>Nothing yet. When friends heart or comment on your posts, it shows up here.</p></div>
        )}
        {items && items.length > 0 && (
          <ul className="activity-list">
            {items.map((item, i) => {
              const isNew = seenBefore && item.created_at > seenBefore;
              const pending = item.kind === 'friend_request' ? (requestState[item.actor_id] ?? 'received') : null;
              return (
                <li key={`${item.kind}-${item.actor_id}-${item.post_id ?? ''}-${item.created_at}-${i}`}
                  className={`activity-item ${isNew ? 'is-new' : ''}`}>
                  <button className="activity-main" onClick={() => open(item)}>
                    <span className="activity-avatar">
                      <Avatar person={{ id: item.actor_id, display_name: item.actor_name, avatar_url: item.actor_avatar_url }} size={44} />
                      {HEART_KINDS.has(item.kind) && <span className="activity-kind heart" aria-hidden="true">♥</span>}
                    </span>
                    <span className="activity-text">
                      <span className="activity-line">
                        {isNew && <span className="new-mark">New</span>}
                        {describe(item, me)}
                      </span>
                      {item.snippet && (
                        <span className="activity-snippet">{item.snippet === 'your photo' ? 'Your photo' : `“${item.snippet}”`}</span>
                      )}
                      <time dateTime={item.created_at}>{timeAgo(item.created_at)}</time>
                    </span>
                  </button>
                  {item.kind === 'friend_request' && (
                    <div className="activity-actions">
                      <FriendButton person={{ id: item.actor_id, display_name: item.actor_name }} status={pending}
                        onChange={(s) => setRequestState((m) => ({ ...m, [item.actor_id]: s }))} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
