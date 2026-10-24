import { useEffect, useState } from 'react';

// When a new version is deployed, the new service worker takes over while the app is open. Tell the player so they can reload.
let ready = false;
const listeners = new Set<() => void>();
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had || ready) return;
    ready = true;
    listeners.forEach(f => f());
  });
}

/** True once a newer version of the game has been downloaded in the background. */
export function useUpdateReady(): boolean {
  const [r, setR] = useState(ready);
  useEffect(() => {
    const f = () => setR(ready);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  return r;
}

/** The build time as a short readable string. */
export const buildLabel = () => {
  try { return new Date(__BUILD__).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return __BUILD__; }
};
