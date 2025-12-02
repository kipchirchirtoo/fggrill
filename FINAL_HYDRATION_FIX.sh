#!/bin/bash

echo "🔥 COMPLETE HYDRATION FIX - NUCLEAR OPTION 🔥"
echo "=============================================="
echo ""

# Kill all node processes
echo "1️⃣ Killing all Node processes..."
pkill -9 node 2>/dev/null || true
sleep 2

# Navigate to frontend
cd /home/john/fggrill/frontend

# Remove ALL cache and build artifacts
echo "2️⃣ Removing ALL caches and builds..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .swc
rm -rf tsconfig.tsbuildinfo
rm -rf out

# Clear npm cache
echo "3️⃣ Clearing npm cache..."
npm cache clean --force

echo "4️⃣ Reinstalling dependencies..."
npm install

echo ""
echo "✅ COMPLETE! Now do the following:"
echo ""
echo "  1. Start dev server:"
echo "     cd /home/john/fggrill/frontend && npm run dev"
echo ""
echo "  2. In your browser:"
echo "     - Open DevTools (F12)"
echo "     - Go to Application tab"
echo "     - Click 'Clear storage'"
echo "     - Check ALL boxes"
echo "     - Click 'Clear site data'"
echo "     - Close DevTools"
echo "     - Hard refresh: Ctrl+Shift+R"
echo ""
echo "  3. If STILL seeing errors:"
echo "     - Try incognito/private mode"
echo "     - Or different browser"
echo ""
