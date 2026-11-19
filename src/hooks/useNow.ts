import { useEffect, useState } from 'react';

/** Re-renders every `ms` milliseconds; returns Date.now(). */
export function useNow(ms = 1000, enabled = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms, enabled]);
  return now;
}
