import { useEffect, useRef, useState } from 'react';
import { api } from '../api/index.js';
import { ErrorNote, Sheet } from './ui.jsx';
import { CloseIcon, LinkIcon, PhotoIcon } from './Icons.jsx';
import { normalizeUrl } from '../lib/format.js';

const MAX_PHOTOS = 4;

// New post, or editing one (text and link only; to change photos,
// delete the post and post again).
export function Composer({ editing, onClose, onPosted }) {
  const [body, setBody] = useState(editing?.body ?? '');
  const [photos, setPhotos] = useState([]); // [{ file, url }]
  const [showLink, setShowLink] = useState(!!editing?.link_url);
  const [link, setLink] = useState(editing?.link_url ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  // tidy up preview images when they're no longer shown
  const shown = useRef([]);
  useEffect(() => { shown.current = photos; }, [photos]);
  useEffect(() => () => shown.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  function pick(e) {
    const chosen = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!chosen.length) return;
    const images = chosen.filter((f) => f.type.startsWith('image/'));
    const room = MAX_PHOTOS - photos.length;
    if (images.length < chosen.length) setError('Some of those files weren’t photos.');
    else if (images.length > room) setError(`A post can have up to ${MAX_PHOTOS} photos, so only the first ${room} were added.`);
    else setError('');
    setPhotos((ps) => [...ps, ...images.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  function removePhoto(i) {
    setPhotos((ps) => {
      URL.revokeObjectURL(ps[i].url);
      return ps.filter((_, j) => j !== i);
    });
  }

  const existing = editing ? (editing.image_urls?.length ? editing.image_urls : editing.image_url ? [editing.image_url] : []) : [];
  const linkValue = showLink ? normalizeUrl(link) : '';
  const hasImage = photos.length > 0 || existing.length > 0;
  const canPost = !busy && linkValue !== null && (body.trim() || hasImage || linkValue);

  async function submit() {
    if (!canPost) return;
    setBusy(true); setError('');
    try {
      if (editing) await api.updatePost(editing, { body: body.trim(), link_url: linkValue });
      else await api.createPost({ body: body.trim(), files: photos.map((p) => p.file), link_url: linkValue });
      onPosted();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const full = photos.length >= MAX_PHOTOS;

  return (
    <Sheet title={editing ? 'Edit post' : 'New post'} onClose={onClose}
      footer={
        <>
          {!editing && (
            <button className={`tool-btn ${photos.length ? 'on' : ''}`} onClick={() => fileRef.current.click()}
              disabled={full} aria-label={full ? 'Four photos added' : 'Add photos'}>
              <PhotoIcon /> <span>{photos.length ? `Photos ${photos.length}/${MAX_PHOTOS}` : 'Photos'}</span>
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

      {(photos.length > 0 || existing.length > 0) && (
        <div className="composer-photos">
          {(editing ? existing.map((url) => ({ url })) : photos).map((p, i) => (
            <div className="composer-thumb" key={p.url}>
              <img src={p.url} alt={`Photo ${i + 1}`} />
              {!editing && (
                <button className="icon-btn on-photo" onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}>
                  <CloseIcon width={16} height={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showLink && (
        <label className="field">
          <span>Link</span>
          <input type="url" inputMode="url" autoCapitalize="off" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          {linkValue === null && <small className="field-hint">That doesn’t look like a web address.</small>}
        </label>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pick} />
      <ErrorNote error={error} />
    </Sheet>
  );
}
