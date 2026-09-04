import type { NextConfig } from 'next';

const siteBasePath = process.env.GITHUB_PAGES === 'true' ? '/sata' : '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  typedRoutes: true,
  output: 'export',
  ...(siteBasePath ? { assetPrefix: siteBasePath } : {}),
  env: {
    NEXT_PUBLIC_SITE_BASE_PATH: siteBasePath
  },
  images: {
    unoptimized: true
  }
};

export default nextConfig;
