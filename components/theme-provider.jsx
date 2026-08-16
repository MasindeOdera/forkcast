'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Thin wrapper around next-themes so we can mount it from the (server)
 * root layout. Configured app-wide in app/layout.js with:
 *   attribute="class"      → toggles the `.dark` class on <html>
 *   defaultTheme="light"   → light is the default (per product decision)
 *   enableSystem={false}   → we expose an explicit light/dark switch only
 *   disableTransitionOnChange → avoids a color-flash when switching
 */
export function ThemeProvider({ children, ...props }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
