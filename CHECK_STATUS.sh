#!/bin/bash

echo "🔍 Famous Gate Hotel System Status"
echo "===================================="
echo ""

# Check Backend
echo "🔧 Backend Server (Port 5000):"
if lsof -i:5000 > /dev/null 2>&1; then
    echo "   Status: ✅ RUNNING"
    HEALTH=$(curl -s http://localhost:5000/api/health 2>/dev/null)
    if [ -n "$HEALTH" ]; then
        echo "   Health: ✅ OK"
        echo "   Response: $HEALTH" | head -c 80
        echo ""
    else
        echo "   Health: ⚠️  Not responding"
    fi
else
    echo "   Status: ❌ NOT RUNNING"
fi

echo ""

# Check Frontend
echo "🎨 Frontend Server (Port 3001):"
if lsof -i:3001 > /dev/null 2>&1; then
    echo "   Status: ✅ RUNNING"
    echo "   URL: http://localhost:3001"
else
    echo "   Status: ❌ NOT RUNNING"
fi

echo ""

# Check Database
echo "💾 Database (Supabase):"
if curl -s "https://utsvlihpudfraxzcmtle.supabase.co" > /dev/null 2>&1; then
    echo "   Status: ✅ REACHABLE"
else
    echo "   Status: ⚠️  Cannot reach"
fi

echo ""
echo "===================================="

# Summary
BACKEND_OK=$(lsof -i:5000 > /dev/null 2>&1 && echo "1" || echo "0")
FRONTEND_OK=$(lsof -i:3001 > /dev/null 2>&1 && echo "1" || echo "0")

if [ "$BACKEND_OK" = "1" ] && [ "$FRONTEND_OK" = "1" ]; then
    echo "✅ ALL SYSTEMS OPERATIONAL"
elif [ "$BACKEND_OK" = "0" ]; then
    echo "⚠️  BACKEND NOT RUNNING - Run: ./START_ALL.sh"
elif [ "$FRONTEND_OK" = "0" ]; then
    echo "⚠️  FRONTEND NOT RUNNING - Run: ./START_ALL.sh"
else
    echo "❌ SERVICES DOWN - Run: ./START_ALL.sh"
fi

echo "===================================="
echo ""
