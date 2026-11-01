import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { Menu } from './ui.jsx';
import { BellIcon, GearIcon, PeopleIcon } from './Icons.jsx';
import { useRefreshOnFocus } from '../lib/hooks.js';

// The bell (Activity), People (with friend requests) and gear (settings)
// buttons, shared by Home and every profile page. `extraItems` adds
// page-specific entries, like "Remove friend", to the top of the gear menu.
export function TopActions({ me, go, refreshKey, extraItems = [] }) {
  const [unread, setUnread] = useState(0);
  const [requests, setRequests] = useState(0);

  const load = useCallback(async () => {
    const [u, members] = await Promise.all([
      api.activityUnread().catch(() => 0),
      api.listMembers().catch(() => []),
    ]);
    setUnread(u);
    setRequests(members.filter((m) => m.status === 'received').length);
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);
  useRefreshOnFocus(load);

  return (
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
      <Menu label="Settings" trigger={<GearIcon />} items={[
        ...extraItems,
        { label: 'Edit profile', onClick: () => go('/me/edit') },
        ...(me.is_admin ? [
          { label: 'Invite codes', onClick: () => go('/invites') },
          { label: 'Reports', onClick: () => go('/reports') },
        ] : []),
        { label: 'Sign out', onClick: () => api.signOut() },
      ]} />
    </div>
  );
}
