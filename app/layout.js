import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

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
        {children}
        <Toaster 
          position="top-right"
          richColors
          expand={false}
          duration={4000}
        />
      </body>
    </html>
  );
}