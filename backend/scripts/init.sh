#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Check if Node.js is installed
if ! command -v node >/dev/null 2>&1; then
  print_message "$RED" "Node.js is not installed. Please install Node.js first."
  exit 1
fi

# Check if npm is installed
if ! command -v npm >/dev/null 2>&1; then
  print_message "$RED" "npm is not installed. Please install npm first."
  exit 1
fi

# Create necessary directories
print_message "$YELLOW" "Creating necessary directories..."
mkdir -p logs uploads/{images,documents,videos}

# Install dependencies
print_message "$YELLOW" "Installing dependencies..."
npm install

# Create environment file if it doesn't exist
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

# Make scripts executable
print_message "$YELLOW" "Making scripts executable..."
chmod +x scripts/*.sh

# Build TypeScript files
print_message "$YELLOW" "Building TypeScript files..."
npm run build

print_message "$GREEN" "Project initialized successfully!"
print_message "$GREEN" "You can now run 'npm run dev' to start the development server."
