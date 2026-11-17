import type { MetadataRoute } from 'next';

// Installable PWA (D-014, D-023): add to home screen on Android/iOS, opens full-screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Munim · voice CFO',
    short_name: 'Munim',
    description: 'Ask about your money in Hindi or English.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F3F4EF',
    theme_color: '#16201B',
    lang: 'hi-IN',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
