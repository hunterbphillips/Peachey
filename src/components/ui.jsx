import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from './Icons.jsx';

// Muted bookcloth colours for people without a profile photo.
// Each is a CSS token pair (see styles.css) so they work in light and dark.
const TINTS = ['clay', 'sage', 'ink-blue', 'plum', 'ochre', 'rose'];
function tintFor(id = '') {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}
const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export function Avatar({ person, size = 44 }) {
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (person?.avatar_url) {
    return <img className="avatar" style={style} src={person.avatar_url} alt="" />;
  }
  return (
    <span className={`avatar avatar-initials tint-${tintFor(person?.id)}`} style={style} aria-hidden="true">
      {initials(person?.display_name)}
    </span>
  );
}

// Peaches' mark: a pair of rosy peaches, one nestled behind the other.
function Peach({ fill, transform }) {
  return (
    <g transform={transform}>
      <path d="M16 9.5c-1-2.2-1.4-4-1-5.6" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.2 8.6c1.2-3.4 4.6-5.2 9-4.6-1.3 3.9-5 5.7-9 4.6z" fill="var(--sage)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 9.6c-6.3-1.4-11 3.2-11 9.3C5 25.1 9.8 29 16 29s11-3.9 11-10.1c0-6.1-4.7-10.7-11-9.3z" fill={fill} stroke="var(--ink)" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M16 10.2c-2.4 4.6-2.6 11.6 0 18.2" fill="none" stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9.2 14.6c.8-1.3 2-2.2 3.4-2.6" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" opacity=".85" />
    </g>
  );
}

export function PeachMark({ size = 28 }) {
  return (
    <svg className="peach-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <Peach fill="var(--peach-back)" transform="translate(-1.2 0.6) scale(0.74)" />
      <Peach fill="var(--peach-front)" transform="translate(8.6 7.2) scale(0.74)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <PeachMark size={38} />
      <span>Peaches</span>
    </span>
  );
}

export function Spinner({ label = 'Loading' }) {
  return <div className="spinner" role="status" aria-label={label}><span /><span /><span /></div>;
}

export function Sheet({ title, onClose, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    ref.current?.querySelector('textarea, input, button')?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet glass" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Menu({ label, items, trigger }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button className="icon-btn" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && (
        <div className="menu-pop glass" role="menu">
          {items.map((it) => (
            <button key={it.label} role="menuitem" className={it.danger ? 'danger' : ''}
              onClick={() => { setOpen(false); it.onClick(); }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConfirmBar({ text, action, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="confirm-bar" role="alertdialog" aria-label={text}>
      <p>{text}</p>
      <div className="row-end">
        <button className="text-btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="danger-btn" disabled={busy} autoFocus
          onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>
          {busy ? 'Deleting…' : action}
        </button>
      </div>
    </div>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <p className="error-note" role="alert">{error}</p>;
}
