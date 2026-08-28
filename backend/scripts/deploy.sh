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

# Check if required environment variables are set
if [ -z "$DEPLOY_HOST" ] || [ -z "$DEPLOY_USER" ] || [ -z "$DEPLOY_PATH" ]; then
  print_message "$RED" "Please set DEPLOY_HOST, DEPLOY_USER, and DEPLOY_PATH environment variables."
  exit 1
fi

# Check if SSH key exists
if [ ! -f ~/.ssh/id_rsa ]; then
  print_message "$RED" "SSH key not found. Please set up SSH key authentication first."
  exit 1
fi

# Build the project
print_message "$GREEN" "Building project..."
./scripts/build.sh

if [ $? -ne 0 ]; then
  print_message "$RED" "Build failed. Aborting deployment."
  exit 1
fi

# Create deployment directory structure
print_message "$YELLOW" "Creating deployment package..."
DEPLOY_PACKAGE="deploy-$(date +%Y%m%d_%H%M%S).tar.gz"

cd dist
tar -czf ../$DEPLOY_PACKAGE .
cd ..

# Upload deployment package
print_message "$GREEN" "Uploading deployment package..."
scp $DEPLOY_PACKAGE $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/

if [ $? -ne 0 ]; then
  print_message "$RED" "Failed to upload deployment package."
  rm $DEPLOY_PACKAGE
  exit 1
fi

# Deploy on remote server
print_message "$GREEN" "Deploying on remote server..."
ssh $DEPLOY_USER@$DEPLOY_HOST << EOF
  cd $DEPLOY_PATH
  
  # Create backup of current deployment
  if [ -d "current" ]; then
    mv current backup_\$(date +%Y%m%d_%H%M%S)
  fi

  # Create new deployment directory
  mkdir -p current
  tar -xzf $DEPLOY_PACKAGE -C current

  # Install dependencies
  cd current
  npm install --production

  # Copy environment file if it doesn't exist
  if [ ! -f .env ]; then
    cp .env.example .env
    print_message "$YELLOW" "Please update .env file with production settings."
  fi

  # Create required directories
  mkdir -p logs uploads/images uploads/documents uploads/videos

  # Set permissions
  chmod -R 755 .
  chmod -R 777 logs uploads

  # Restart application
  pm2 reload famous-gate-hotel || pm2 start dist/server.js --name famous-gate-hotel

  # Clean up old backups (keep last 5)
  cd ..
  ls -dt backup_* | tail -n +6 | xargs -r rm -rf
  
  # Remove deployment package
  rm $DEPLOY_PACKAGE
EOF

if [ $? -eq 0 ]; then
  print_message "$GREEN" "Deployment completed successfully!"
  
  # Clean up local deployment package
  rm $DEPLOY_PACKAGE
else
  print_message "$RED" "Deployment failed."
  rm $DEPLOY_PACKAGE
  exit 1
fi
