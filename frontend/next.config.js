/** @type {import('next').NextConfig} */
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://api.hirall.com' : 'http://localhost:5000')).replace(/\/$/, '')

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
    // Proxy API requests to backend server
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${apiBaseUrl}/api/:path*`,
            },
        ];
    },
}

module.exports = nextConfig
