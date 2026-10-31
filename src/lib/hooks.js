import { useEffect } from 'react';

// Refresh when the app comes back to the foreground (e.g. reopening it on a phone).
export function useRefreshOnFocus(fn) {
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && fn();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [fn]);
}
