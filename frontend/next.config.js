/** @type {import('next').NextConfig} */
const nextConfig = {
    // Only use 'export' for Electron builds, not for Vercel
    // Vercel needs server-side rendering for dynamic routes
    output: process.env.BUILD_FOR_ELECTRON === 'true' ? 'export' : undefined,
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
