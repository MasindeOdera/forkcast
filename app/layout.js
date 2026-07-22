import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { NetworkStatusBanner } from '@/components/ui/network-status-banner';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Forkcast - Your Personal Meal Planning Companion',
  description: 'Create, share, and discover amazing meal ideas with photos, ingredients, and cooking instructions.',
  keywords: 'meals, recipes, cooking, food, meal planning, ingredients, instructions',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Global offline banner \u2014 renders only when navigator.onLine === false */}
        <NetworkStatusBanner />

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
