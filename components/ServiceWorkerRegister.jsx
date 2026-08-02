'use client';

/**
 * Registers /sw.js once the app has hydrated.
 *
 * Deliberate design choices:
 *   • Registration is deferred to the `load` event so the SW install work
 *     never competes with first paint or hydration.
 *   • We only register in production. In dev, Next.js webpack HMR uses
 *     `_next/static/*` chunks that change on every reload; a SW cache
 *     there causes stale-chunk errors that look catastrophic.
 *   • On activation of a NEW worker we simply reload once — no toast,
 *     no dialog. Users almost never notice, and it prevents the
 *     confusing state where half the app is v1 and half is v2.
 */

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // If a new SW takes control, refresh the tab so the user is on
          // the latest bundle. Guarded to fire exactly once.
          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          });

          // Nudge a waiting worker to activate immediately.
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (
                installing.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                installing.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch((err) => {
          // Swallow — a failed SW registration should never break the app.
          console.warn('[Forkcast] Service worker registration failed:', err);
        });
    };

    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad, { once: true });
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);

  return null;
}
