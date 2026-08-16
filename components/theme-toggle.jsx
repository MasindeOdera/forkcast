'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Light/Dark theme switch. Sits next to the Forkcast logo in the header.
 *
 * next-themes resolves the active theme only on the client, so we guard the
 * icon behind a `mounted` flag to avoid an SSR/CSR hydration mismatch (and a
 * wrong-icon flash on first paint). A fixed-size invisible placeholder keeps
 * the header from shifting while we hydrate.
 */
export function ThemeToggle({ className = '' }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`rounded-full ${className}`}
    >
      {!mounted ? (
        // invisible placeholder → no hydration flash, no layout shift
        <span className="h-5 w-5" />
      ) : isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
}
