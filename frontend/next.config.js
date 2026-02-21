/** @type {import('next').NextConfig} */
const nextConfig = {
    // Only use 'export' for production builds (Electron)
    // In development, use standard Next.js server for dynamic routes
    output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        unoptimized: true,
    },
}

module.exports = nextConfig
