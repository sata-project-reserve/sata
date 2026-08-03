import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  typedRoutes: true,
  output: 'export',
  ...(process.env.GITHUB_PAGES === 'true' ? { assetPrefix: '/sata' } : {}),
  images: {
    unoptimized: true
  }
};

export default nextConfig;
