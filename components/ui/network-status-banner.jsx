'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * <NetworkStatusBanner /> — sticky bar at the very top of the app that
 * appears when the browser reports `navigator.onLine === false` and slides
 * away when connectivity returns.
 *
 * Rendered globally from app/layout.js so it can react to network events
 * regardless of which route the user is on.
 */
export function NetworkStatusBanner() {
  // Default to true (online) so SSR + first paint don't flash the banner.
  const [online, setOnline] = useState(true);
  // Track whether we've been offline at least once so we can show the
  // "You're back online" toast without spamming on first mount.
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Sync with the real state on mount (client-only).
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => {
      setOnline(true);
    };
    const handleOffline = () => {
      setOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Only render when offline (banner appears above the sticky header).
  if (online) {
    // If we were previously offline, the parent app can show a toast.
    // We intentionally keep this component silent to stay decoupled.
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'sticky top-0 z-[60] w-full bg-destructive text-destructive-foreground',
        'px-4 py-2 text-sm font-medium shadow-md'
      )}
    >
      <div className="container flex items-center justify-center gap-2">
        <WifiOff className="h-4 w-4" aria-hidden="true" />
        <span>You're offline. Some features may not work until connection returns.</span>
      </div>
    </div>
  );
}

export default NetworkStatusBanner;
