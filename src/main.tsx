import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);

// Offline support. Only in a built app: the dev server should always show the code as it is now.
if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol !== 'file:') {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ }); });
}
