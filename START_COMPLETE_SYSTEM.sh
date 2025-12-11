#!/bin/bash

echo "🚀 Starting Full Stack Famous Gate Hotel System..."
echo "================================================"

# Ensure we are in the root directory
cd /home/john/fggrill

# 1. Start Frontend and Backend using existing script
if [ -f "./START_ALL.sh" ]; then
    chmod +x ./START_ALL.sh
    ./START_ALL.sh
else
    echo "❌ START_ALL.sh not found!"
fi

# 2. Start Python Reporting Service
echo ""
echo "🔧 Starting Python Reporting Service..."
cd /home/john/fggrill/python-services
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "⚠️ No virtual environment found for python-services. Trying system python..."
fi

# Check if port 8002 is already in use
if lsof -i:8002 > /dev/null 2>&1; then
    echo "✅ Reporting Service already running on port 8002"
else
    export PYTHON_SERVICE_PORT=8002
    nohup python app.py > ../reporting_service.log 2>&1 &
    sleep 2
    if lsof -i:8002 > /dev/null 2>&1; then
        echo "✅ Reporting Service started successfully on port 8002"
    else
        echo "❌ Reporting Service failed to start. Check reporting_service.log"
    fi
fi

# 2.5 Start Gateway Service
echo ""
echo "🔧 Starting Gateway Service..."
cd /home/john/fggrill/python-services
# Use same venv
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
fi

# Check if port 5001 is already in use
if lsof -i:5001 > /dev/null 2>&1; then
    echo "✅ Gateway Service already running on port 5001"
else
    export PORT=5001
    nohup python gateway.py > ../gateway.log 2>&1 &
    sleep 2
    if lsof -i:5001 > /dev/null 2>&1; then
        echo "✅ Gateway Service started successfully on port 5001"
    else
        echo "❌ Gateway Service failed to start. Check gateway.log"
    fi
fi

# 3. Start Room Service
echo ""
echo "🔧 Starting Room Service..."
cd /home/john/fggrill/python-services/room_service
# Re-activate venv just in case, though we are in the same shell
if [ -d "../../python-services/.venv" ]; then
    source ../../python-services/.venv/bin/activate
elif [ -d "../../python-services/venv" ]; then
    source ../../python-services/venv/bin/activate
fi

# Check if port 8003 is already in use
if lsof -i:8003 > /dev/null 2>&1; then
    echo "✅ Room Service already running on port 8003"
else
    nohup python main.py > ../../room_service.log 2>&1 &
    sleep 2
    if lsof -i:8003 > /dev/null 2>&1; then
        echo "✅ Room Service started successfully on port 8003"
    else
        echo "❌ Room Service failed to start. Check room_service.log"
    fi
fi

# 3. Start Analytics Service
echo ""
echo "🔧 Starting Analytics Service..."
cd /home/john/fggrill/analytics-service
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "⚠️ No virtual environment found for analytics-service. Trying system python..."
fi

# Check if port 8001 is already in use
if lsof -i:8001 > /dev/null 2>&1; then
    echo "✅ Analytics Service already running on port 8001"
else
    nohup python app.py > ../analytics_service.log 2>&1 &
    sleep 2
    if lsof -i:8001 > /dev/null 2>&1; then
        echo "✅ Analytics Service started successfully on port 8001"
    else
        echo "❌ Analytics Service failed to start. Check analytics_service.log"
    fi
fi

echo ""
echo "================================================"
echo "🎉 SYSTEM STATUS:"
echo "   Frontend:  http://localhost:3001"
echo "   Backend:   http://localhost:5000"
echo "   Gateway:   http://localhost:5001 (All Python Services)
   Backend:   http://localhost:5000"
echo "================================================"
