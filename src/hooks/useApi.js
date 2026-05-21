import { useState, useEffect, useCallback } from 'react';

export function useApi(url, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => { fetch_(); }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}
