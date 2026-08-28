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

# Check if ESLint is installed
if ! command -v eslint >/dev/null 2>&1; then
  print_message "$YELLOW" "ESLint not found. Installing ESLint..."
  npm install -g eslint
fi

# Run ESLint
print_message "$YELLOW" "Running ESLint..."
npm run lint

# Check if there were any errors
if [ $? -eq 0 ]; then
  print_message "$GREEN" "No linting errors found!"
else
  # Ask if user wants to fix automatically fixable issues
  read -p "Would you like to fix automatically fixable issues? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_message "$YELLOW" "Fixing linting issues..."
    npm run lint:fix
    
    # Check if fixes were successful
    if [ $? -eq 0 ]; then
      print_message "$GREEN" "Linting issues fixed successfully!"
    else
      print_message "$RED" "Some issues could not be fixed automatically. Please fix them manually."
      exit 1
    fi
  else
    print_message "$RED" "Please fix the linting issues manually."
    exit 1
  fi
fi
