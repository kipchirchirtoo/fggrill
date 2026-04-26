/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Image optimization configuration
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 86400,
      'localhost',
      'famousgateshotels.com',
      'famousgates.com',
      'api.hirall.com',
      'staging-api.famousgateshotels.com',
      'api.famousgateshotels.com',
    ],

    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Compiler options
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
    reactRemoveProperties: process.env.NODE_ENV === 'production' ? { properties: ['^data-test'] } : false,
  },

  // Performance optimizations
  swcMinify: true,
  poweredByHeader: false,
  compress: true,

  // Environment variables validation
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT,
    NEXT_PUBLIC_API_TIMEOUT: process.env.NEXT_PUBLIC_API_TIMEOUT,
    NEXT_PUBLIC_CACHE_TTL: process.env.NEXT_PUBLIC_CACHE_TTL,
    NEXT_PUBLIC_ENABLE_BOOKING: process.env.NEXT_PUBLIC_ENABLE_BOOKING,
    NEXT_PUBLIC_ENABLE_SEARCH: process.env.NEXT_PUBLIC_ENABLE_SEARCH,
  },

  // Experimental features
  experimental: {
    optimizePackageImports: ['@tanstack/react-query', 'axios'],
  },

  // Headers for security and caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' }
        ]
      },
      {
        source: '/images/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ]
      }
    ];
  },
};

module.exports = nextConfig;

