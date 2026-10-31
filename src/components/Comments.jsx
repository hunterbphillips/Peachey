import { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { Avatar, ConfirmBar, Menu, Spinner } from './ui.jsx';
import { MoreIcon, SendIcon } from './Icons.jsx';
import { fullDate, splitLinks, timeAgo } from '../lib/format.js';

export function Comments({ postId, me, onCountChange }) {
  const [list, setList] = useState(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null); // { id, body }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const rows = await api.listComments(postId);
    setList(rows);
    onCountChange(rows.length);
  }
  useEffect(() => { load().catch((e) => setError(e.message)); }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true); setError('');
    try { await api.addComment(postId, body); setDraft(''); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function saveEdit(e) {
    e.preventDefault();
    const body = editing.body.trim();
    if (!body) return;
    await api.updateComment(editing.id, body);
    setEditing(null);
    await load();
  }

  const [confirmId, setConfirmId] = useState(null);
  async function remove(id) {
    await api.deleteComment(id);
    setConfirmId(null);
    await load();
  }

  return (
    <div className="comments">
      {list == null ? <Spinner label="Loading comments" /> : (
        <ul>
          {list.map((c) => (
            <li key={c.id} className="comment">
              <Avatar person={c.author} size={30} />
              <div className="comment-main">
                <div className="comment-head">
                  <strong>{c.author_id === me.id ? 'You' : c.author?.display_name}</strong>
                  <time dateTime={c.created_at} title={fullDate(c.created_at)}>{timeAgo(c.created_at)}{c.edited_at && ' · edited'}</time>
                </div>
                {editing?.id === c.id ? (
                  <form className="comment-edit" onSubmit={saveEdit}>
                    <textarea rows={2} maxLength={1000} value={editing.body}
                      onChange={(e) => setEditing({ ...editing, body: e.target.value })} aria-label="Edit comment" />
                    <div className="row-end">
                      <button type="button" className="text-btn" onClick={() => setEditing(null)}>Cancel</button>
                      <button className="gel-btn small">Save</button>
                    </div>
                  </form>
                ) : (
                  <p>{splitLinks(c.body).map((part, i) => part.href
                    ? <a key={i} href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>
                    : <span key={i}>{part.text}</span>)}</p>
                )}
              </div>
              {c.author_id === me.id && editing?.id !== c.id && (
                <Menu label="Comment options" trigger={<MoreIcon width={18} height={18} />} items={[
                  { label: 'Edit comment', onClick: () => setEditing({ id: c.id, body: c.body }) },
                  { label: 'Delete comment', onClick: () => setConfirmId(c.id), danger: true },
                ]} />
              )}
              {confirmId === c.id && (
                <ConfirmBar text="Delete this comment?" action="Delete comment"
                  onCancel={() => setConfirmId(null)} onConfirm={() => remove(c.id)} />
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="comment-new" onSubmit={add}>
        <textarea rows={1} maxLength={1000} placeholder="Write a comment" value={draft}
          onChange={(e) => setDraft(e.target.value)} aria-label="Write a comment"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) add(e); }} />
        <button className="send-btn" disabled={busy || !draft.trim()} aria-label="Post comment"><SendIcon width={18} height={18} /></button>
      </form>
      {error && <p className="error-note" role="alert">{error}</p>}
    </div>
  );
}
