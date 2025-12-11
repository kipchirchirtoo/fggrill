#!/bin/bash

# Room Service Startup Script
# Runs the Room Availability & Occupancy microservice

cd "$(dirname "$0")/python-services/room_service"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt --quiet

# Copy environment variables from parent if .env doesn't exist
if [ ! -f ".env" ] && [ -f "../../backend/.env" ]; then
    echo "Copying environment variables from backend..."
    grep -E "^SUPABASE_" ../../backend/.env > .env
fi

# Run the service
echo "Starting Room Service on port 8003..."
uvicorn main:app --host 0.0.0.0 --port 8003 --reload
