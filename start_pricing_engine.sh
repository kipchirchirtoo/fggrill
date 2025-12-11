#!/bin/bash

# Navigate to service directory
cd python-services/pricing_engine

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Run service
echo "Starting Pricing Engine on port 8001..."
export PRICING_PORT=8001
python main.py
