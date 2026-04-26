#!/bin/bash

echo "🔥 FORCE RESTARTING BACKEND..."
echo ""

# Kill any running node processes on port 5000
echo "1. Killing processes on port 5000..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || echo "   No process found on port 5000"

# Remove compiled dist folder
echo "2. Removing dist folder..."
rm -rf dist
echo "   ✓ dist folder removed"

# Clear node module cache
echo "3. Clearing require cache..."
rm -rf node_modules/.cache 2>/dev/null || echo "   No cache to clear"

echo ""
echo "4. Starting fresh server..."
npm run dev

