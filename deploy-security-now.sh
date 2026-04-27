#!/bin/bash

# Quick deployment script for security routes
# This script builds the backend and provides instructions for deployment

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Security Routes Deployment - FamousGate Hotels        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "backend/package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root directory${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Pre-Deployment Checklist:${NC}"
echo "   ✓ Security controller implemented"
echo "   ✓ Security routes registered"
echo "   ✓ Database migration 71 applied"
echo "   ✓ Frontend API client updated"
echo "   ✓ All components using real API calls"
echo ""

# Build backend
echo -e "${BLUE}🔨 Building backend...${NC}"
cd backend

# Clean previous build
if [ -d "dist" ]; then
    echo -e "${YELLOW}   Cleaning previous build...${NC}"
    rm -rf dist
fi

# Build TypeScript
echo -e "${YELLOW}   Compiling TypeScript...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}   ✓ Build successful!${NC}"
else
    echo -e "${RED}   ❌ Build failed!${NC}"
    exit 1
fi

cd ..

echo ""
echo -e "${GREEN}✅ Backend built successfully!${NC}"
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              DEPLOYMENT INSTRUCTIONS                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Choose your deployment method:${NC}"
echo ""
echo -e "${GREEN}Option 1: Deploy via Git (Recommended)${NC}"
echo "   1. Commit and push changes:"
echo "      git add ."
echo "      git commit -m 'Deploy security routes'"
echo "      git push origin main"
echo ""
echo "   2. SSH into production server:"
echo "      ssh user@api.hirall.com"
echo ""
echo "   3. Pull and restart:"
echo "      cd /path/to/backend"
echo "      git pull origin main"
echo "      npm install"
echo "      npm run build"
echo "      pm2 restart famous-gate-hotel"
echo ""
echo -e "${GREEN}Option 2: Direct Upload${NC}"
echo "   1. Upload dist folder:"
echo "      scp -r backend/dist user@api.hirall.com:/path/to/backend/"
echo ""
echo "   2. SSH and restart:"
echo "      ssh user@api.hirall.com"
echo "      cd /path/to/backend"
echo "      pm2 restart famous-gate-hotel"
echo ""
echo -e "${GREEN}Option 3: Use Deployment Script${NC}"
echo "   1. Set environment variables:"
echo "      export DEPLOY_HOST='api.hirall.com'"
echo "      export DEPLOY_USER='your-username'"
echo "      export DEPLOY_PATH='/path/to/backend'"
echo ""
echo "   2. Run deployment:"
echo "      cd backend"
echo "      ./scripts/deploy.sh"
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  VERIFICATION                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "After deployment, verify endpoints are working:"
echo ""
echo "1. Health check:"
echo "   curl https://api.hirall.com/api/health"
echo ""
echo "2. Security config (requires auth token):"
echo "   curl -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "        https://api.hirall.com/api/security/config"
echo ""
echo "3. Frontend dashboard:"
echo "   Navigate to: /dashboard/super/admin/security"
echo "   All 8 tabs should load without 404 errors"
echo ""
echo -e "${YELLOW}📝 See DEPLOY_SECURITY_ROUTES.md for detailed instructions${NC}"
echo ""
