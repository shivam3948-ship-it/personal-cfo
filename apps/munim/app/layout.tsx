import type { Metadata, Viewport } from 'next';
import './globals.css';
import { TestSwitches } from '@/ui/TestSwitches';

export const metadata: Metadata = {
  title: 'Munim', description: 'Your personal CFO: a daily money check-in, your spends and your investments, explained.',
  // home-screen install (D-060): iPhone needs these; Android reads app/manifest.ts
  appleWebApp: { capable: true, title: 'Munim', statusBarStyle: 'default' },
  icons: { icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: [{ url: '/icons/apple-icon.png', sizes: '180x180' }] },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0F5E58' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif:wght@500;700&family=Noto+Serif+Devanagari:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Devanagari:wght@400;600&display=swap" />
      </head>
      <body className="t-light"><TestSwitches />{children}</body>
    </html>
  );
}
