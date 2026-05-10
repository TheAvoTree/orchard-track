import { createContext, useContext, useState, useEffect, useCallback, createElement } from 'react';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({ geofence_radius_metres: '200' });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) setSettings(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = useCallback(async (updates) => {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setSettings(updated);
    }
    return res.ok;
  }, []);

  return createElement(SettingsContext.Provider, { value: { settings, saveSettings, fetchSettings } }, children);
}

export function useSettings() {
  return useContext(SettingsContext);
}
