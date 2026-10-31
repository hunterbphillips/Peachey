import { useState } from 'react';
import { api } from '../api/index.js';
import { ConfirmBar, Menu } from './ui.jsx';
import { CommentIcon, HeartIcon, LinkIcon, MoreIcon, ShareIcon } from './Icons.jsx';
import { entryDate, fullDate, joinNames, linkParts, splitLinks } from '../lib/format.js';
import { Comments } from './Comments.jsx';
import { sharePost, shareText } from '../lib/share.js';

export function PostCard({ post, me, author, onEdit, onDeleted, onChanged }) {
  const [p, setP] = useState(post);
  const [showComments, setShowComments] = useState(false);
  const [hearters, setHearters] = useState(null);
  const [pop, setPop] = useState(false);
  const mine = p.author_id === me.id;

  async function toggleHeart() {
    const on = !p.hearted_by_me;
    setP((x) => ({ ...x, hearted_by_me: on, heart_count: x.heart_count + (on ? 1 : -1) }));
    if (on) { setPop(true); setTimeout(() => setPop(false), 450); }
    setHearters(null);
    try { await api.setHeart(p, on); }
    catch { setP((x) => ({ ...x, hearted_by_me: !on, heart_count: x.heart_count + (on ? -1 : 1) })); }
  }

  async function showHearters() {
    if (hearters) { setHearters(null); return; }
    setHearters(await api.listHearts(p.id));
  }

  const [confirming, setConfirming] = useState(false);
  async function remove() {
    await api.deletePost(p);
    onDeleted(p.id);
  }

  // Share: the device's share sheet where there is one; otherwise copy/open options.
  const [shareFallback, setShareFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualText, setManualText] = useState(null);
  const authorName = mine ? me.display_name : author?.display_name;
  async function share() {
    if (shareFallback) { setShareFallback(false); return; }
    const result = await sharePost(p, authorName, mine);
    if (result === 'unsupported') { setShareFallback(true); setCopied(false); setManualText(null); }
  }
  function copyText() {
    const text = shareText(p, authorName, mine);
    navigator.clipboard.writeText(text)
      .then(() => { setCopied(true); setManualText(null); })
      .catch(() => setManualText(text));
  }

  const link = p.link_url && linkParts(p.link_url);

  return (
    <article className="post glass">
      <div className="post-head">
        <time dateTime={p.created_at} title={fullDate(p.created_at)}>
          {entryDate(p.created_at)}{p.edited_at && <span className="edited"> · edited</span>}
        </time>
        {mine && (
          <Menu label="Post options" trigger={<MoreIcon />} items={[
            { label: 'Edit post', onClick: () => onEdit(p) },
            { label: 'Delete post', onClick: () => setConfirming(true), danger: true },
          ]} />
        )}
      </div>

      {confirming && (
        <ConfirmBar text="Delete this post and its hearts and comments?" action="Delete post"
          onCancel={() => setConfirming(false)} onConfirm={remove} />
      )}

      {p.body && (
        <p className="post-body">
          {splitLinks(p.body).map((part, i) => part.href
            ? <a key={i} href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>
            : <span key={i}>{part.text}</span>)}
        </p>
      )}

      {p.image_url && (
        <div className="post-photo">
          <img src={p.image_url} alt={p.body ? '' : 'Photo'} loading="lazy" onDoubleClick={() => !p.hearted_by_me && toggleHeart()} />
        </div>
      )}

      {link && (
        <a className="link-chip" href={p.link_url} target="_blank" rel="noopener noreferrer">
          <span className="link-chip-icon"><LinkIcon width={18} height={18} /></span>
          <span className="link-chip-text">
            <strong>{link.host}</strong>
            {link.path && <span>{link.path}</span>}
          </span>
        </a>
      )}

      <div className="post-actions">
        <span className="heart-group">
          <button className={`act heart ${p.hearted_by_me ? 'on' : ''} ${pop ? 'pop' : ''}`}
            onClick={toggleHeart} aria-pressed={p.hearted_by_me} aria-label={p.hearted_by_me ? 'Remove heart' : 'Heart'}>
            <HeartIcon filled={p.hearted_by_me} />
          </button>
          <button className="act-count" onClick={showHearters} disabled={p.heart_count === 0}
            aria-label={`${p.heart_count} hearts, show who`} aria-expanded={!!hearters}>
            {p.heart_count}
          </button>
        </span>
        <button className={`act ${showComments ? 'on-aqua' : ''}`} onClick={() => setShowComments((s) => !s)}
          aria-expanded={showComments} aria-label={`${p.comment_count} comments`}>
          <CommentIcon /><span>{p.comment_count}</span>
        </button>
        <button className={`act share ${shareFallback ? 'on-share' : ''}`} onClick={share}
          aria-label="Share this post" aria-expanded={shareFallback}>
          <ShareIcon /><span>Share</span>
        </button>
      </div>

      {shareFallback && (
        <div className="share-fallback">
          <p>Send a copy of this post{p.image_url ? ' and its photo' : ''} outside Peachey.</p>
          <div className="share-options">
            {(p.body || p.link_url) && (
              <button className="pill-btn" onClick={copyText}>{copied ? 'Copied' : 'Copy text'}</button>
            )}
            {p.image_url && (
              <a className="pill-btn" href={p.image_url} target="_blank" rel="noopener noreferrer">Open photo</a>
            )}
          </div>
          {manualText && (
            <textarea className="share-manual" readOnly rows={3} value={manualText}
              aria-label="Post text to copy" onFocus={(e) => e.target.select()} autoFocus />
          )}
        </div>
      )}

      {hearters && hearters.length > 0 && (
        <p className="hearters">Hearted by {joinNames(hearters.map((h) => (h.user_id === me.id ? 'you' : h.display_name)))}</p>
      )}

      {showComments && (
        <Comments postId={p.id} me={me}
          onCountChange={(n) => { setP((x) => ({ ...x, comment_count: n })); onChanged?.(); }} />
      )}
    </article>
  );
}
