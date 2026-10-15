import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Munim · voice CFO',
  description: 'Ask about your money in Hindi or English. Munim reads your statements, SMS, emails, loan and insurance papers, and helps you act.',
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
      <body>{children}</body>
    </html>
  );
}
