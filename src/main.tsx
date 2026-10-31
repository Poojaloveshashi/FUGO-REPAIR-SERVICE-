import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register Workbox service worker for offline warehouse capabilities
if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[Workbox] New repair cache content available.');
    },
    onOfflineReady() {
      console.log('[Workbox] App ready for low-connectivity warehouse usage.');
    },
    onRegisterError(error) {
      console.warn('[Workbox] Service worker registration notice:', error);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
