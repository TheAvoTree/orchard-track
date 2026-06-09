import { useState, useEffect, useCallback, useRef } from 'react';

export function useApi(url, { deps = [], pollMs = 0 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const fetch_ = useCallback(async () => {
    if (!url) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    fetch_();
    if (pollMs > 0) {
      timerRef.current = setInterval(fetch_, pollMs);
      return () => clearInterval(timerRef.current);
    }
  }, [fetch_, pollMs]);

  return { data, loading, error, refetch: fetch_ };
}
