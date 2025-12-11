#!/bin/bash

echo "🔧 Setting up Python Environments..."

# Setup python-services
echo "📦 Setting up python-services..."
cd /home/john/fggrill/python-services
if [ ! -d ".venv" ]; then
    echo "Creating .venv for python-services..."
    python3 -m venv .venv
fi
source .venv/bin/activate
echo "Installing dependencies for python-services..."
pip install -r requirements.txt
deactivate

# Setup analytics-service
echo "📦 Setting up analytics-service..."
cd /home/john/fggrill/analytics-service
if [ ! -d ".venv" ]; then
    echo "Creating .venv for analytics-service..."
    python3 -m venv .venv
fi
source .venv/bin/activate
echo "Installing dependencies for analytics-service..."
pip install -r requirements.txt
deactivate

echo "✅ Python environments setup complete!"
