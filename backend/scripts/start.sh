#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to print colored messages
print_message() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Check if Node.js is installed
if ! command_exists node; then
  print_message "$RED" "Node.js is not installed. Please install Node.js first."
  exit 1
fi

# Check if npm is installed
if ! command_exists npm; then
  print_message "$RED" "npm is not installed. Please install npm first."
  exit 1
fi

# Check if TypeScript is installed globally
if ! command_exists tsc; then
  print_message "$YELLOW" "TypeScript is not installed globally. Installing..."
  npm install -g typescript
fi

# Create necessary directories
mkdir -p logs uploads/images uploads/documents uploads/videos

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  print_message "$YELLOW" "Installing dependencies..."
  npm install
fi

# Build TypeScript files
print_message "$GREEN" "Building TypeScript files..."
npm run build

# Check if .env file exists
if [ ! -f ".env" ]; then
  print_message "$YELLOW" "Creating .env file from .env.example..."
  if [ -f ".env.example" ]; then
    cp .env.example .env
    print_message "$GREEN" "Created .env file. Please update it with your configuration."
  else
    print_message "$RED" ".env.example file not found."
    exit 1
  fi
fi

# Start the server based on NODE_ENV
NODE_ENV=$(grep NODE_ENV .env | cut -d '=' -f2 || echo "development")

if [ "$NODE_ENV" = "development" ]; then
  print_message "$GREEN" "Starting server in development mode..."
  npm run dev
else
  print_message "$GREEN" "Starting server in production mode..."
  npm start
fi
