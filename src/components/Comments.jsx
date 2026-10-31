import { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { Avatar, ConfirmBar, Menu, Spinner } from './ui.jsx';
import { HeartIcon, MoreIcon, SendIcon } from './Icons.jsx';
import { fullDate, joinNames, splitLinks, timeAgo } from '../lib/format.js';

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
  const [showHearts, setShowHearts] = useState(null);

  async function toggleHeart(c) {
    const on = !c.hearted_by_me;
    const patch = (fn) => setList((l) => l.map((x) => (x.id === c.id ? fn(x) : x)));
    patch((x) => ({
      ...x, hearted_by_me: on, heart_count: x.heart_count + (on ? 1 : -1),
      hearted_by: on ? [...x.hearted_by, 'you'] : x.hearted_by.filter((n) => n !== 'you'),
    }));
    try { await api.setCommentHeart(c.id, on); }
    catch { patch(() => c); }
  }
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
                <div className="comment-actions">
                  <button className={`act small heart ${c.hearted_by_me ? 'on' : ''}`} onClick={() => toggleHeart(c)}
                    aria-pressed={c.hearted_by_me} aria-label={c.hearted_by_me ? 'Remove heart from comment' : 'Heart comment'}>
                    <HeartIcon filled={c.hearted_by_me} width={16} height={16} />
                  </button>
                  {c.heart_count > 0 && (
                    <button className="act-count small" onClick={() => setShowHearts(showHearts === c.id ? null : c.id)}
                      aria-expanded={showHearts === c.id} aria-label={`${c.heart_count} hearts, show who`}>
                      {c.heart_count}
                    </button>
                  )}
                  {showHearts === c.id && c.heart_count > 0 && (
                    <span className="hearters inline">Hearted by {joinNames(c.hearted_by)}</span>
                  )}
                </div>
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
