import { useEffect, useState } from 'react';

/** True on a phone-sized screen. Matches the breakpoint in styles.css (48rem at 16px). */
export function useMobile(): boolean {
  const q = '(max-width: 768px)';
  const [m, setM] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}
