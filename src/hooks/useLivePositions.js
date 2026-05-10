import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

export function useLivePositions() {
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    // Initial load
    fetch(`${BACKEND}/api/gps/latest`)
      .then(r => r.json())
      .then(setPositions)
      .catch(() => {});

    // Real-time updates via WebSocket
    const socket = io(BACKEND || window.location.origin);

    socket.on('position:update', (update) => {
      setPositions(prev => {
        const idx = prev.findIndex(p => p.id === update.id);
        if (idx === -1) return [...prev, update];
        const next = [...prev];
        next[idx] = update;
        return next;
      });
    });

    return () => socket.disconnect();
  }, []);

  return positions;
}
