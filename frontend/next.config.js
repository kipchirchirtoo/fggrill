/** @type {import('next').NextConfig} */
const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://api.hirall.com' : 'http://localhost:5000')
const apiBaseUrl = (
    /^https?:\/\//i.test(rawApiBaseUrl)
        ? rawApiBaseUrl
        : `${/^(localhost|127(?:\.\d{1,3}){3})(:\d+)?$/i.test(rawApiBaseUrl) ? 'http' : 'https'}://${rawApiBaseUrl}`
).replace(/\/$/, '')

// Security headers
const securityHeaders = [
    {
        key: 'X-Frame-Options',
        value: 'DENY'
    },
    {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
    },
    {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin'
    },
    {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()'
    },
    {
        key: 'X-XSS-Protection',
        value: '1; mode=block'
    },
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-inline for dev
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self' https://api.hirall.com https://services.hirall.com https://*.supabase.co wss://*.supabase.co",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; ')
    }
]

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
    // Security headers
    async headers() {
        return [
            {
                source: '/:path*',
                headers: securityHeaders,
            },
        ]
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
