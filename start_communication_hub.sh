#!/bin/bash

# Communication Hub Microservice Startup Script
# This script sets up and runs the Python FastAPI communication service

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$SCRIPT_DIR/python-services/communication_hub"

echo "🚀 Starting Communication Hub Microservice..."

cd "$SERVICE_DIR"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt --quiet

# Set default environment variables if not set
export COMMUNICATION_PORT=${COMMUNICATION_PORT:-8002}
export HOTEL_NAME=${HOTEL_NAME:-"Grand Hotel"}
export FROM_EMAIL=${FROM_EMAIL:-"noreply@hotel.com"}

echo "✅ Starting Communication Hub on port $COMMUNICATION_PORT..."

# Run the service
python main.py
