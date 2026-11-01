import { useEffect, useRef, useState } from 'react';
import { BackIcon, CloseIcon } from './Icons.jsx';

// Full-screen photos: each one whole and uncropped. With several, move
// between them with the arrows, the keyboard, or a sideways swipe.
// Pinch or double-tap to zoom, drag to look around while zoomed.
const RESET = { scale: 1, x: 0, y: 0 };

export function PhotoViewer({ srcs, start = 0, alt, onClose }) {
  const [index, setIndex] = useState(start);
  const [view, setView] = useState(RESET);
  const g = useRef({});
  const lastTap = useRef(0);
  const many = srcs.length > 1;

  const go = (d) => {
    setIndex((i) => Math.min(Math.max(i + d, 0), srcs.length - 1));
    setView(RESET);
  };

  useEffect(() => {
    const prev = document.activeElement;
    const key = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', key);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', key);
      document.body.classList.remove('no-scroll');
      prev?.focus?.();
    };
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const clamp = (v) => ({ ...v, scale: Math.min(Math.max(v.scale, 1), 4), ...(v.scale <= 1 ? { x: 0, y: 0 } : {}) });
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const toggleZoom = () => setView((v) => (v.scale > 1 ? RESET : { scale: 2.5, x: 0, y: 0 }));

  function onTouchStart(e) {
    const t = e.touches;
    if (t.length === 2) g.current = { mode: 'pinch', d: dist(t), scale: view.scale };
    else if (t.length === 1) g.current = { mode: 'pan', sx: t[0].clientX, sy: t[0].clientY, x: view.x, y: view.y, dx: 0, moved: false };
  }
  function onTouchMove(e) {
    const t = e.touches;
    const s = g.current;
    if (s.mode === 'pinch' && t.length === 2) {
      setView((v) => clamp({ ...v, scale: s.scale * (dist(t) / s.d) }));
    } else if (s.mode === 'pan' && t.length === 1) {
      const dx = t[0].clientX - s.sx, dy = t[0].clientY - s.sy;
      s.dx = dx;
      if (Math.abs(dx) + Math.abs(dy) > 6) s.moved = true;
      if (view.scale > 1) setView((v) => ({ ...v, x: s.x + dx, y: s.y + dy }));
    }
  }
  function onTouchEnd(e) {
    const s = g.current;
    if (s.mode === 'pan' && e.touches.length === 0) {
      if (view.scale === 1 && many && Math.abs(s.dx) > 50) {
        go(s.dx < 0 ? 1 : -1);                    // sideways swipe: next / previous
      } else if (!s.moved) {
        const now = Date.now();
        if (now - lastTap.current < 300) { toggleZoom(); lastTap.current = 0; }
        else lastTap.current = now;
      }
    }
    if (e.touches.length === 0) g.current = {};
  }

  return (
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="Photo"
      onClick={(e) => e.target === e.currentTarget && view.scale === 1 && onClose()}>
      <button className="icon-btn photo-close" onClick={onClose} aria-label="Close photo" autoFocus><CloseIcon /></button>
      <img key={srcs[index]} src={srcs[index]} alt={alt || `Photo ${index + 1}`} draggable="false"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        className={g.current.mode ? 'dragging' : ''}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onDoubleClick={toggleZoom} />
      {many && (
        <>
          <button className="icon-btn photo-nav prev" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous photo">
            <BackIcon />
          </button>
          <button className="icon-btn photo-nav next" onClick={() => go(1)} disabled={index === srcs.length - 1} aria-label="Next photo">
            <BackIcon style={{ transform: 'scaleX(-1)' }} />
          </button>
          <div className="photo-count" aria-live="polite">{index + 1} / {srcs.length}</div>
        </>
      )}
    </div>
  );
}
