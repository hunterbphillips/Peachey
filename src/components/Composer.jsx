import { useEffect, useRef, useState } from 'react';
import { api } from '../api/index.js';
import { ErrorNote, Sheet } from './ui.jsx';
import { CloseIcon, LinkIcon, PhotoIcon } from './Icons.jsx';
import { normalizeUrl } from '../lib/format.js';

// New post, or editing one (text and link only; to change a photo,
// delete the post and post again).
export function Composer({ editing, onClose, onPosted }) {
  const [body, setBody] = useState(editing?.body ?? '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [showLink, setShowLink] = useState(!!editing?.link_url);
  const [link, setLink] = useState(editing?.link_url ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  function pick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('That file isn’t a photo.'); return; }
    setFile(f); setPreview(URL.createObjectURL(f)); setError('');
  }

  const linkValue = showLink ? normalizeUrl(link) : '';
  const hasImage = !!file || !!editing?.image_url;
  const canPost = !busy && linkValue !== null && (body.trim() || hasImage || linkValue);

  async function submit() {
    if (!canPost) return;
    setBusy(true); setError('');
    try {
      if (editing) await api.updatePost(editing, { body: body.trim(), link_url: linkValue });
      else await api.createPost({ body: body.trim(), file, link_url: linkValue });
      onPosted();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Sheet title={editing ? 'Edit post' : 'New post'} onClose={onClose}
      footer={
        <>
          {!editing && (
            <button className={`tool-btn ${file ? 'on' : ''}`} onClick={() => fileRef.current.click()} aria-label="Add a photo">
              <PhotoIcon /> <span>Photo</span>
            </button>
          )}
          <button className={`tool-btn ${showLink ? 'on' : ''}`} onClick={() => setShowLink((s) => !s)} aria-label="Add a link">
            <LinkIcon /> <span>Link</span>
          </button>
          <span className="spacer" />
          <button className="gel-btn" disabled={!canPost} onClick={submit}>
            {busy ? (editing ? 'Saving…' : 'Posting…') : editing ? 'Save' : 'Post'}
          </button>
        </>
      }>
      <textarea className="composer-text" rows={4} maxLength={2000} value={body}
        onChange={(e) => setBody(e.target.value)} placeholder="What’s new?" aria-label="Post text" />

      {(preview || editing?.image_url) && (
        <div className="composer-photo">
          <img src={preview || editing.image_url} alt="Selected photo" />
          {!editing && (
            <button className="icon-btn on-photo" onClick={() => { setFile(null); setPreview(null); fileRef.current.value = ''; }} aria-label="Remove photo">
              <CloseIcon />
            </button>
          )}
        </div>
      )}

      {showLink && (
        <label className="field">
          <span>Link</span>
          <input type="url" inputMode="url" autoCapitalize="off" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          {linkValue === null && <small className="field-hint">That doesn’t look like a web address.</small>}
        </label>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
      <ErrorNote error={error} />
    </Sheet>
  );
}
