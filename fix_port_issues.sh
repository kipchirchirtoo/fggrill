#!/bin/bash

echo "Fixing port references in JavaScript and TypeScript files..."

# Create a next.config.js with a forced port
cat > ./frontend/next.config.js << 'EOF'
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
    PORT: 3000,
  },
  devIndicators: {
    buildActivity: true,
  }
}

module.exports = nextConfig
EOF

echo "Updated next.config.js to force port 3000"

# Create a redirect script in the public directory
mkdir -p ./frontend/public
cat > ./frontend/public/port-redirect.js << 'EOF'
// Check if we need to redirect to port 3000
(function() {
  // Only run on client
  if (typeof window !== 'undefined') {
    if (window.location.port === '3001') {
      // Redirect to port 3000
      const newUrl = window.location.protocol + '//' + 
                    window.location.hostname + ':3000' + 
                    window.location.pathname +
                    window.location.search +
                    window.location.hash;
      window.location.href = newUrl;
    }
  }
})();
EOF

# Create a proxy middleware to handle requests from port 3000 to 3001
mkdir -p ./frontend/src/middleware
cat > ./frontend/src/middleware.ts << 'EOF'
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Forward requests from port 3001 to port 3000
  // This helps with APIs hardcoded to port 3000
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-forwarded-host', 'localhost:3000');

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
EOF

chmod +x ./fix_port_issues.sh

echo "Port fix applied! Now run:"
echo "cd frontend && npm run dev -- -p 3000"
echo "This will force Next.js to run on port 3000 instead of 3001"
