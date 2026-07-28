import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  typedRoutes: true,
  output: 'export',
  images: {
    unoptimized: true
  }
};

export default nextConfig;
