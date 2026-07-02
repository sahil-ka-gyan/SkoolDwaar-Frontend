import React, { useEffect, useState } from 'react';
import { FiDownload, FiX, FiWifiOff, FiCheck } from 'react-icons/fi';
// Virtual module provided by vite-plugin-pwa at build time.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Toast that surfaces three PWA lifecycle events:
 *  1. A new SW is waiting to activate  → "Update available — Reload"
 *  2. The app was cached for offline use → "Ready to use offline"
 *  3. The browser went offline           → "You are offline"
 *
 * Mounted once in App.tsx. Renders nothing in the steady-state.
 */
export default function PWAUpdatePrompt() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [showCachedToast, setShowCachedToast] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
      // Check for updates every hour while the app stays open.
      if (registration) {
        setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
      }
    },
    onOfflineReady() {
      setShowCachedToast(true);
      setTimeout(() => setShowCachedToast(false), 4000);
    },
  });

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const baseStyle: React.CSSProperties = {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderRadius: 10,
    boxShadow: '0 10px 30px rgba(0,0,0,.18)',
    fontSize: '.88rem',
    fontWeight: 600,
  };

  return (
    <>
      {/* New version available */}
      {needRefresh && (
        <div style={{ ...baseStyle, bottom: 24, background: '#111827', color: '#fff' }}>
          <FiDownload />
          <span>A new version is available.</span>
          <button
            onClick={() => updateServiceWorker(true)}
            style={{
              background: '#6366f1', color: '#fff', border: 'none',
              padding: '6px 12px', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Reload
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            aria-label="Dismiss"
            style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
          >
            <FiX />
          </button>
        </div>
      )}

      {/* App is ready for offline use */}
      {showCachedToast && offlineReady && (
        <div style={{ ...baseStyle, top: 24, background: '#10b981', color: '#fff' }}>
          <FiCheck />
          <span>Ready to use offline.</span>
        </div>
      )}

      {/* Offline indicator */}
      {offline && (
        <div style={{ ...baseStyle, top: 24, background: '#f59e0b', color: '#111' }}>
          <FiWifiOff />
          <span>You are offline — showing the last loaded data.</span>
        </div>
      )}
    </>
  );
}
