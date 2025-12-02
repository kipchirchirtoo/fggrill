#!/bin/bash

echo "🚀 Starting Famous Gate Hotel System..."
echo "======================================="
echo ""

# Check if backend is already running
if lsof -i:5000 > /dev/null 2>&1; then
    echo "✅ Backend already running on port 5000"
else
    echo "🔧 Starting Backend Server..."
    cd /home/john/fggrill/backend
    nohup npm start > ../backend.log 2>&1 &
    sleep 3
    
    if lsof -i:5000 > /dev/null 2>&1; then
        echo "✅ Backend started successfully!"
    else
        echo "❌ Backend failed to start. Check backend.log"
        exit 1
    fi
fi

echo ""

# Check if frontend is already running  
if lsof -i:3001 > /dev/null 2>&1; then
    echo "✅ Frontend already running on port 3001"
else
    echo "🔧 Starting Frontend Server..."
    cd /home/john/fggrill/frontend
    nohup npm run dev > ../frontend.log 2>&1 &
    sleep 3
    
    if lsof -i:3001 > /dev/null 2>&1; then
        echo "✅ Frontend started successfully!"
    else
        echo "❌ Frontend failed to start. Check frontend.log"
    fi
fi

echo ""
echo "======================================="
echo "✅ ALL SERVICES STARTED!"
echo "======================================="
echo ""
echo "📍 Access Points:"
echo "   Frontend: http://localhost:3001"
echo "   Backend:  http://localhost:5000"
echo "   Health:   http://localhost:5000/api/health"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f /home/john/fggrill/backend.log"
echo "   Frontend: tail -f /home/john/fggrill/frontend.log"
echo ""
echo "🛑 To stop services:"
echo "   lsof -ti:5000 | xargs kill  # Stop backend"
echo "   lsof -ti:3001 | xargs kill  # Stop frontend"
echo ""
