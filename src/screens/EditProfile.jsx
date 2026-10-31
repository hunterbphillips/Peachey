import { useRef, useState } from 'react';
import { api } from '../api/index.js';
import { Avatar, ErrorNote } from '../components/ui.jsx';
import { BackIcon } from '../components/Icons.jsx';

export function EditProfile({ me, go, onSaved }) {
  const [name, setName] = useState(me.display_name);
  const [showSeen, setShowSeen] = useState(me.show_last_seen !== false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.updateProfile({ display_name: name.trim(), show_last_seen: showSeen, avatarFile: file });
      await onSaved();
      go(`/u/${me.id}`);
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <>
      <header className="topbar">
        <button className="icon-btn back" onClick={() => go(`/u/${me.id}`)} aria-label="Back to your profile"><BackIcon /></button>
      </header>
      <main className="page">
        <form className="glass panel form-panel" onSubmit={save}>
          <h1>Edit profile</h1>
          <div className="avatar-edit">
            <Avatar person={{ ...me, display_name: name, avatar_url: preview ?? me.avatar_url }} size={88} />
            <button type="button" className="pill-btn" onClick={() => fileRef.current.click()}>Change photo</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setFile(f); setPreview(URL.createObjectURL(f)); }
            }} />
          </div>
          <label className="field">
            <span>Name</span>
            <input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="switch-row" htmlFor="show-last-seen">
            <span>
              <strong>Show when I was last on</strong>
              <small>Friends see “Active now” or “Last seen 2 hours ago” on your profile.</small>
            </span>
            <input id="show-last-seen" type="checkbox" role="switch" checked={showSeen}
              onChange={(e) => setShowSeen(e.target.checked)} />
          </label>
          <ErrorNote error={error} />
          <button className="gel-btn wide" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save profile'}</button>
          <button type="button" className="text-btn" onClick={() => api.signOut()}>Sign out</button>
        </form>
      </main>
    </>
  );
}
