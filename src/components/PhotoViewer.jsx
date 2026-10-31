import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from './Icons.jsx';

// Full-screen photo: the whole image, uncropped. Pinch or double-tap to zoom,
// drag to look around while zoomed, tap the background or × to close.
export function PhotoViewer({ src, alt, onClose }) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const g = useRef({}); // gesture scratchpad
  const lastTap = useRef(0);

  useEffect(() => {
    const prev = document.activeElement;
    const key = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', key);
      document.body.classList.remove('no-scroll');
      prev?.focus?.();
    };
  }, [onClose]);

  const clamp = (v) => ({ ...v, scale: Math.min(Math.max(v.scale, 1), 4), ...(v.scale <= 1 ? { x: 0, y: 0 } : {}) });
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  function onTouchStart(e) {
    const t = e.touches;
    if (t.length === 2) {
      g.current = { mode: 'pinch', d: dist(t), scale: view.scale };
    } else if (t.length === 1) {
      g.current = { mode: 'pan', sx: t[0].clientX, sy: t[0].clientY, x: view.x, y: view.y, moved: false };
    }
  }
  function onTouchMove(e) {
    const t = e.touches;
    const s = g.current;
    if (s.mode === 'pinch' && t.length === 2) {
      setView((v) => clamp({ ...v, scale: s.scale * (dist(t) / s.d) }));
    } else if (s.mode === 'pan' && t.length === 1) {
      const dx = t[0].clientX - s.sx, dy = t[0].clientY - s.sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) s.moved = true;
      if (view.scale > 1) setView((v) => ({ ...v, x: s.x + dx, y: s.y + dy }));
    }
  }
  function onTouchEnd(e) {
    const s = g.current;
    if (s.mode === 'pan' && !s.moved && e.touches.length === 0) {
      const now = Date.now();
      if (now - lastTap.current < 300) {           // double-tap: toggle zoom
        setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 }));
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
    }
    if (e.touches.length === 0) g.current = {};
  }

  return (
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="Photo"
      onClick={(e) => e.target === e.currentTarget && view.scale === 1 && onClose()}>
      <button className="icon-btn photo-close" onClick={onClose} aria-label="Close photo" autoFocus><CloseIcon /></button>
      <img src={src} alt={alt || 'Photo'} draggable="false"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        className={g.current.mode ? 'dragging' : ''}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onDoubleClick={() => setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 }))} />
    </div>
  );
}
