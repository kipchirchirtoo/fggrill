/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  images: {
    unoptimized: true
  },
  // Force port 3000 to match client-side code expectations
  async headers() {
    return [];
  },
  env: {
    NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
    PORT: '3000',
  },
  devIndicators: {
    buildActivity: true,
  }
}

module.exports = nextConfig
