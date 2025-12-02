#!/bin/bash

echo "🔧 Fixing Hydration Errors..."

# Stop any running dev server
echo "1️⃣ Stopping dev server..."
pkill -f "next dev" 2>/dev/null || true

# Clear Next.js cache
echo "2️⃣ Clearing Next.js cache..."
rm -rf .next
rm -rf node_modules/.cache

# Clear node modules cache (optional but recommended)
echo "3️⃣ Clearing build artifacts..."
rm -rf tsconfig.tsbuildinfo

# Reinstall dependencies to ensure clean state
echo "4️⃣ Reinstalling dependencies..."
npm install

echo "✅ Cache cleared! Now restart your dev server with:"
echo "   npm run dev"
