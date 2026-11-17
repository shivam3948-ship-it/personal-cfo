/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['unpdf'],
  outputFileTracingIncludes: { '/api/**': ['./data/demo/**/*'] },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=()' },
    ] }];
  },
};
export default nextConfig;
