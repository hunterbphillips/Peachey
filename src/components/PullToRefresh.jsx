import { useEffect, useRef, useState } from 'react';

// Pull down from the top of the page to reload. Only switched on where the
// phone has no pull-to-refresh of its own: the home-screen app (and the demo).
const THRESHOLD = 70;

export function PullToRefresh({ enabled, onRefresh }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef(null);
  const pullRef = useRef(0);
  const set = (v) => { pullRef.current = v; setPull(v); };

  useEffect(() => {
    if (!enabled) return;
    const down = (e) => {
      if (refreshing || window.scrollY > 0 || document.body.classList.contains('no-scroll')) return;
      start.current = e.touches[0].clientY;
    };
    const move = (e) => {
      if (start.current == null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) { set(0); return; }
      set(Math.min(dy * 0.5, 110));
    };
    const up = async () => {
      if (start.current == null) return;
      start.current = null;
      const reached = pullRef.current >= THRESHOLD;
      set(0);
      if (reached) {
        setRefreshing(true);
        Promise.resolve(onRefresh()).finally(() => setTimeout(() => setRefreshing(false), 700));
      }
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
    };
  }, [enabled, onRefresh, refreshing]);

  if (!enabled || (!pull && !refreshing)) return null;
  const ready = pull >= THRESHOLD;
  const offset = refreshing ? 56 : pull;
  return (
    <div className="ptr" style={{ transform: `translate(-50%, ${offset - 44}px)` }} role="status"
      aria-label={refreshing ? 'Refreshing' : ready ? 'Release to refresh' : 'Pull to refresh'}>
      <span className={`ptr-ball ${refreshing ? 'spinning' : ''}`}
        style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg) scale(${0.6 + Math.min(pull / THRESHOLD, 1) * 0.4})` }} />
    </div>
  );
}

export const pullToRefreshAvailable = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
