import type { MetadataRoute } from 'next';

// Add to Home Screen (D-060): opens full-screen like an app, for the daily check-in. Icons: public/icons (मु on Munim teal).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Munim · मुनीम',
    short_name: 'Munim',
    description: 'Your daily money check-in, in Hindi or English. आपके पैसों का रोज़ का हिसाब।',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F2F7F6',
    theme_color: '#0F5E58',
    lang: 'hi-IN',
    categories: ['finance'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
