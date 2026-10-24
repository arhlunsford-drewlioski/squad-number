import { useEffect, useState } from 'react';

// The browser offers "install" once, as an event. Keep it so Settings can show a button.
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach(f => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach(f => f()); });
}

export interface InstallState {
  /** Running as an installed app (home screen icon), not in a browser tab. */
  installed: boolean;
  /** The browser can show its install prompt now. */
  canPrompt: boolean;
  /** iPhone or iPad in Safari, where installing is done from the Share menu. */
  ios: boolean;
  /** The game is saved for offline play. */
  offline: boolean;
  install(): Promise<void>;
}

export function useInstall(): InstallState {
  const [, bump] = useState(0);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const f = () => bump(n => n + 1);
    listeners.add(f);
    if ('serviceWorker' in navigator) void navigator.serviceWorker.getRegistration().then(r => setOffline(!!r?.active));
    return () => { listeners.delete(f); };
  }, []);
  const standalone = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { standalone?: boolean }) : undefined;
  const ua = nav?.userAgent ?? '';
  return {
    installed: standalone || !!nav?.standalone,
    canPrompt: !!deferred,
    ios: /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua),
    offline,
    install: async () => { if (!deferred) return; await deferred.prompt(); await deferred.userChoice; deferred = null; listeners.forEach(f => f()); },
  };
}
