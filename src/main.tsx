import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { useStore } from './store';
import { importTrikker } from './import/trikker';
import { watchStaleChunks } from './appUpdate';

// Nouvelle version en ligne pendant que la page est ouverte : proposer de recharger
watchStaleChunks();

// Accès de débogage en développement uniquement
if (import.meta.env.DEV) Object.assign(window, { __store: useStore, __importTrikker: importTrikker });

// Hors ligne : service worker en version publiée (pas en développement, ni dans l'application de bureau)
if (import.meta.env.PROD && 'serviceWorker' in navigator && !('__TAURI_INTERNALS__' in window) && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
