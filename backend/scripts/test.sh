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

# Check if .env.test file exists
if [ ! -f ".env.test" ]; then
  print_message "$YELLOW" "Creating .env.test file..."
  if [ -f ".env.example" ]; then
    cp .env.example .env.test
    # Update test environment variables
    sed -i 's/NODE_ENV=.*/NODE_ENV=test/' .env.test
    sed -i 's/PORT=.*/PORT=5001/' .env.test
    sed -i 's/MONGODB_URI=.*/MONGODB_URI=mongodb:\/\/localhost:27017\/famous_gate_hotel_test/' .env.test
  else
    print_message "$RED" ".env.example file not found."
    exit 1
  fi
fi

# Build TypeScript files if needed
if [ ! -d "dist" ]; then
  print_message "$YELLOW" "Building TypeScript files..."
  npm run build
fi

# Run ESLint
print_message "$GREEN" "Running ESLint..."
npm run lint

# Check if ESLint was successful
if [ $? -ne 0 ]; then
  print_message "$RED" "ESLint found issues that need to be fixed."
  exit 1
fi

# Run tests with coverage
print_message "$GREEN" "Running tests with coverage..."
NODE_ENV=test jest --coverage --detectOpenHandles --forceExit

# Check if tests were successful
if [ $? -eq 0 ]; then
  print_message "$GREEN" "All tests passed successfully!"
else
  print_message "$RED" "Some tests failed."
  exit 1
fi
