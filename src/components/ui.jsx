import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from './Icons.jsx';

// Soft pastel tints for people without a profile photo.
const TINTS = [
  ['#FFD3BF', '#B4532F'], ['#CDEFF5', '#1C7C8C'], ['#DDF3D3', '#3A7D3A'],
  ['#E5DEFA', '#5C4BA6'], ['#FFE6B0', '#8A5A00'], ['#FAD6E4', '#A23767'],
];
function tintFor(id = '') {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}
const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export function Avatar({ person, size = 44 }) {
  const [bg, fg] = tintFor(person?.id);
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (person?.avatar_url) {
    return <img className="avatar" style={style} src={person.avatar_url} alt="" />;
  }
  return (
    <span className="avatar avatar-initials" style={{ ...style, background: bg, color: fg }} aria-hidden="true">
      {initials(person?.display_name)}
    </span>
  );
}

export function Orb({ size = 28 }) {
  return <span className="orb" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <Orb size={26} />
      <span>Peachey</span>
    </span>
  );
}

export function Spinner({ label = 'Loading' }) {
  return <div className="spinner" role="status" aria-label={label}><span /></div>;
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
