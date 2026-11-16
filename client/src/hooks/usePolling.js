import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Polling hook - the project's real-time mechanism.
 *
 * Design notes
 *  - Every request is short-lived, which is exactly what Vercel serverless
 *    functions need (no WebSocket connection to keep alive).
 *  - The Page Visibility API pauses the interval when the tab is hidden, so a
 *    forgotten waiting-room tab does not burn function invocations.
 *  - The previous data stays on screen while a refresh is in flight, avoiding
 *    layout flicker; only `isRefreshing` flips.
 *  - Everything is cleaned up on unmount to prevent leaked timers.
 */
export function usePolling(fetcher, { intervalMs = 8000, enabled = true, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const run = useCallback(async () => {
    if (!enabled || inFlightRef.current) return null;
    inFlightRef.current = true;
    setIsRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (mountedRef.current) {
        setData(result);
        setError(null);
        setLastUpdated(new Date());
      }
      return result;
    } catch (err) {
      if (err && err.name === 'AbortError') return null;
      if (mountedRef.current) setError(err);
      return null;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setIsRefreshing(false);
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    run();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, intervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, intervalMs, enabled, ...deps]);

  return { data, error, loading, isRefreshing, lastUpdated, refresh: run };
}
