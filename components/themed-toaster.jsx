'use client';

import { useTheme } from 'next-themes';
import { Toaster as SonnerToaster } from 'sonner';

/**
 * Toaster that follows the active theme (light/dark) via next-themes.
 *
 * Keeps the app's standardised toast styling (richColors, closeButton,
 * 5s duration, consistent radius/shadow) but makes the toast surface flip
 * with the theme instead of being locked to light.
 */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      position="top-right"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      richColors
      expand={false}
      closeButton
      duration={5000}
      toastOptions={{
        classNames: {
          toast: 'rounded-lg shadow-lg border',
          title: 'font-medium',
          description: 'text-sm text-muted-foreground',
        },
      }}
    />
  );
}
