import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { NetworkStatusBanner } from '@/components/ui/network-status-banner';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

const inter = Inter({ subsets: ['latin'] });

// ─── App-wide metadata ──────────────────────────────────────────────────
// Also drives the PWA install prompt. Chrome uses `manifest` +
// `themeColor` + a registered service worker + the icons in
// /public/manifest.json to decide whether to show the install icon in
// the URL bar. Keep these in sync with /public/manifest.json.
export const metadata = {
  title: 'Forkcast — Your Personal Meal Planning Companion',
  description:
    'Create, share, and discover amazing meal ideas with photos, ingredients, and cooking instructions.',
  keywords:
    'meals, recipes, cooking, food, meal planning, ingredients, instructions, pantry, shopping list',
  applicationName: 'Forkcast',
  // metadataBase resolves relative URLs in OG / Twitter images.
  // Pulled from NEXT_PUBLIC_BASE_URL when set (Vercel, production);
  // falls back to localhost in dev so Next stops warning about it.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  ),
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Forkcast',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    title: 'Forkcast — Meal Planning',
    description:
      'Create, share, and plan meals with photos, ingredients, and AI-assisted ideas.',
    siteName: 'Forkcast',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512 }],
  },
};

// Next 14 splits `themeColor` / `viewport` out of `metadata`.
export const viewport = {
  themeColor: '#10B981',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Global offline banner — renders only when navigator.onLine === false */}
        <NetworkStatusBanner />

        {/* Registers /sw.js in production. See components/ServiceWorkerRegister.jsx */}
        <ServiceWorkerRegister />

        {children}

        {/*
          Standardised toast styling:
            - richColors: sonner picks green/red/etc. based on toast.success / toast.error
            - closeButton: user can dismiss long errors early
            - duration bumped to 5s so error copy is readable
            - toastOptions.classNames: consistent radius + padding across variants
        */}
        <Toaster
          position="top-right"
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
      </body>
    </html>
  );
}
