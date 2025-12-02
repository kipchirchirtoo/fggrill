#!/bin/bash

echo "🛑 Stopping Famous Gate Hotel System..."
echo "========================================"
echo ""

# Stop Backend
if lsof -i:5000 > /dev/null 2>&1; then
    echo "🔴 Stopping Backend (port 5000)..."
    lsof -ti:5000 | xargs kill -9 2>/dev/null
    sleep 1
    echo "✅ Backend stopped"
else
    echo "ℹ️  Backend not running"
fi

echo ""

# Stop Frontend
if lsof -i:3001 > /dev/null 2>&1; then
    echo "🔴 Stopping Frontend (port 3001)..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    sleep 1
    echo "✅ Frontend stopped"
else
    echo "ℹ️  Frontend not running"
fi

echo ""
echo "========================================"
echo "✅ ALL SERVICES STOPPED"
echo "========================================"
echo ""
echo "To restart: ./START_ALL.sh"
echo ""
