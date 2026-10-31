import { useState } from 'react';
import { api } from '../api/index.js';
import { CheckIcon } from './Icons.jsx';

// The right control for where I stand with someone:
// none → Add friend · sent → Requested (cancel) · received → Accept / Decline · friends → Friends
export function FriendButton({ person, status, onChange }) {
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    try { onChange(await fn()); } finally { setBusy(false); }
  };
  const first = person.display_name.split(' ')[0];

  if (status === 'friends') {
    return <span className="friend-state"><CheckIcon width={16} height={16} /> Friends</span>;
  }
  if (status === 'sent') {
    return (
      <span className="friend-actions">
        <span className="friend-state muted">Requested</span>
        <button className="text-btn inline" disabled={busy} aria-label={`Cancel request to ${person.display_name}`}
          onClick={() => run(() => api.removeFriend(person.id))}>Cancel</button>
      </span>
    );
  }
  if (status === 'received') {
    return (
      <span className="friend-actions">
        <button className="text-btn inline" disabled={busy} aria-label={`Decline ${person.display_name}`}
          onClick={() => run(() => api.respondFriendRequest(person.id, false))}>Decline</button>
        <button className="gel-btn small" disabled={busy} aria-label={`Accept ${person.display_name}`}
          onClick={() => run(() => api.respondFriendRequest(person.id, true))}>Accept</button>
      </span>
    );
  }
  return (
    <button className="pill-btn add" disabled={busy} aria-label={`Add ${first} as a friend`}
      onClick={() => run(() => api.sendFriendRequest(person.id))}>
      {busy ? 'Sending…' : 'Add friend'}
    </button>
  );
}
