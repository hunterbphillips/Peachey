import { useLayoutEffect, useRef } from 'react';

// A name that shrinks to fit its space instead of being cut off with "…".
// First it tries one line, stepping down from `max` to `oneLineMin` px.
// If that isn't enough, it uses two lines (breaking only between words),
// stepping down from `twoLineMax` to `min`. Anything longer still wraps.
export function FitName({ text, max = 21, oneLineMin = 16, twoLineMax = 18, min = 13, className = '' }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const set = (size, wrap) => {
        el.style.fontSize = `${size}px`;
        el.style.whiteSpace = wrap ? 'normal' : 'nowrap';
        el.style.overflowWrap = wrap ? 'normal' : '';
      };
      const fitsWidth = () => el.scrollWidth <= el.clientWidth + 0.5;
      const lines = (size) => Math.round(el.scrollHeight / (size * 1.15));
      for (let size = max; size >= oneLineMin; size -= 0.5) {
        set(size, false);
        if (fitsWidth()) return;
      }
      for (let size = twoLineMax; size >= min; size -= 0.5) {
        set(size, true);
        if (fitsWidth() && lines(size) <= 2) return;
      }
      set(min, true);
      el.style.overflowWrap = 'anywhere';
    };
    fit();
    document.fonts?.ready.then(fit);          // re-measure once the serif font has loaded
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [text, max, oneLineMin, twoLineMax, min]);

  return <h1 ref={ref} className={`fit-name ${className}`}>{text}</h1>;
}
