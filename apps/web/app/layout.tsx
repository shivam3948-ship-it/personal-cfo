import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from './client';

export const metadata: Metadata = {
  title: 'Munim · your money, explained',
  description: 'Your money in one place: mutual funds, bank, cards, loans, insurance and credit, explained in Hindi or English.',
  appleWebApp: { capable: true, title: 'Munim', statusBarStyle: 'black-translucent' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#16201B' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap" />
      </head>
      <body><AppProvider>{children}</AppProvider></body>
    </html>
  );
}
