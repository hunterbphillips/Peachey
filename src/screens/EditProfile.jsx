import { useCallback, useRef, useState } from 'react';
import { api } from '../api/index.js';
import { Avatar, ConfirmBar, ErrorNote } from '../components/ui.jsx';
import { BackIcon } from '../components/Icons.jsx';
import { AvatarCropper } from '../components/AvatarCropper.jsx';

export function EditProfile({ me, go, onSaved }) {
  const [name, setName] = useState(me.display_name);
  const [showSeen, setShowSeen] = useState(me.show_last_seen !== false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);   // photo being positioned
  const cancelCrop = useCallback(() => setCropSrc(null), []);

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.updateProfile({ display_name: name.trim(), show_last_seen: showSeen, avatarFile: file });
      await onSaved();
      go("/");
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <>
      <header className="topbar">
        <button className="icon-btn back" onClick={() => go("/")} aria-label="Back home"><BackIcon /></button>
      </header>
      <main className="page">
        <form className="glass panel form-panel" onSubmit={save}>
          <h1>Edit profile</h1>
          <div className="avatar-edit">
            <Avatar person={{ ...me, display_name: name, avatar_url: preview ?? me.avatar_url }} size={88} />
            <button type="button" className="pill-btn" onClick={() => fileRef.current.click()}>Change photo</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';           // so picking the same photo again still opens the cropper
              if (f) setCropSrc(URL.createObjectURL(f));
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
          {!me.is_admin && !confirmDelete && (
            <button type="button" className="text-btn danger-text" onClick={() => setConfirmDelete(true)}>Delete my account</button>
          )}
          {confirmDelete && (
            <ConfirmBar text="Delete your account? Your posts, photos, comments and hearts are erased for good. This can’t be undone."
              action="Delete my account" onCancel={() => setConfirmDelete(false)}
              onConfirm={async () => {
                try { await api.deleteMyAccount(); }
                catch (err) { setError(err.message); setConfirmDelete(false); }
              }} />
          )}
        </form>
      </main>
      {cropSrc && (
        <AvatarCropper src={cropSrc} onCancel={cancelCrop} onDone={(blob) => {
          setFile(blob); setPreview(URL.createObjectURL(blob)); setCropSrc(null);
        }} />
      )}
    </>
  );
}
