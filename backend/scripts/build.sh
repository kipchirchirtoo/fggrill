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

# Clean dist directory
print_message "$YELLOW" "Cleaning dist directory..."
rm -rf dist

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  print_message "$YELLOW" "Installing dependencies..."
  npm install
fi

# Run ESLint
print_message "$GREEN" "Running ESLint..."
npm run lint

# Check if ESLint was successful
if [ $? -ne 0 ]; then
  print_message "$RED" "ESLint found issues that need to be fixed."
  exit 1
fi

# Build TypeScript files
print_message "$GREEN" "Building TypeScript files..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
  print_message "$GREEN" "Build completed successfully!"

  # Copy necessary files to dist
  print_message "$YELLOW" "Copying additional files..."
  cp package.json dist/
  cp .env.example dist/
  cp -r scripts dist/
  mkdir -p dist/logs dist/uploads

  print_message "$GREEN" "Project is ready for deployment!"
else
  print_message "$RED" "Build failed."
  exit 1
fi
