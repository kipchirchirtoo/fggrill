#!/bin/bash

# FG Grill Hotel - Python Microservices Startup Script
# This script starts all Python microservices for the booking system

echo "🚀 Starting FG Grill Hotel Python Microservices..."

# Check if Docker is available
if command -v docker-compose &> /dev/null; then
    echo "📦 Using Docker Compose to start unified service..."
    docker-compose up -d
    
    echo "⏳ Waiting for service to be ready..."
    sleep 5
    
    # Health check
    echo "🔍 Checking service health..."
    if curl -f http://localhost:5001/health &> /dev/null; then
        echo "✅ Unified Python Service (Port 5001) - Healthy"
    else
        echo "❌ Unified Python Service (Port 5001) - Unhealthy"
    fi
    
else
    echo "🐍 Starting unified service with Python..."
    
    # Start Unified Service with Gunicorn (Production)
    echo "Starting Unified Python Service (Gunicorn) on port 5001..."
    
    # Use gunicorn for production performance (4 workers)
    # Ensure gunicorn is installed: pip install gunicorn
    gunicorn --workers 4 --timeout 120 --bind 0.0.0.0:5001 app:app > logs/unified_service.log 2>&1 &
    
    UNIFIED_PID=$!
    echo $UNIFIED_PID > pids/unified_service.pid
    
    echo "⏳ Waiting for service to start..."
    sleep 5
    
    # Health check
    echo "🔍 Checking service health..."
    if curl -f http://localhost:5001/health &> /dev/null; then
        echo "✅ Unified Python Service (Port 5001) - Healthy"
    else
        echo "❌ Unified Python Service (Port 5001) - Unhealthy"
    fi
fi

echo ""
echo "🎉 FG Grill Hotel Unified Python Service Started!"
echo ""
echo "📋 Service URL: http://localhost:5001"
echo "📊 Health Check: http://localhost:5001/health"
echo ""
echo "🔧 To stop service:"
echo "   • Docker: docker-compose down"
echo "   • Manual: kill $(cat pids/unified_service.pid)"
echo ""
