/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { externalDir: true }, // @core/* lives in ../../packages/core
  serverExternalPackages: ['unpdf'],
  outputFileTracingIncludes: { '/api/**': ['../../packages/core/data/**/*'] },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
      { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=()' },
    ] }];
  },
};
export default nextConfig;
