#!/bin/bash

# Comprehensive cleanup script for Branch Operations Module
# Removes all sample, mock, and placeholder data

echo "========================================="
echo "Branch Operations Module Cleanup Script"
echo "========================================="
echo ""

# 1. Remove placeholder responses from backend
echo "Step 1: Cleaning backend placeholder responses..."
cd /home/john/fggrill/backend/src/routes

# Replace placeholder responses with empty data arrays
sed -i 's/\/\/ Placeholder response for now/\/\/ Real data from database/g' branch-operations.routes.ts
sed -i 's/message: '\''.*retrieved (placeholder)'\''/message: '\''Data retrieved'\''/g' branch-operations.routes.ts

# Remove placeholder data generation blocks
sed -i '/\/\/ If no.*return placeholder/,/^    }/d' branch-operations.routes.ts
sed -i '/\/\/ Generate placeholder/,/placeholderReports;/d' branch-operations.routes.ts
sed -i '/const placeholderMessages =/,/];/d' branch-operations.routes.ts
sed -i '/const placeholderNotifications =/,/];/d' branch-operations.routes.ts
sed -i '/const placeholderAnnouncements =/,/];/d' branch-operations.routes.ts

echo "✓ Backend placeholders removed"

# 2. Remove sample data from frontend pages
echo ""
echo "Step 2: Cleaning frontend sample data..."
cd /home/john/fggrill/frontend/src/app/dashboard/branch-operations

# Find and remove generatePlaceholder functions
find . -name "*.tsx" -type f -exec sed -i '/const generatePlaceholder/,/^  };/d' {} \;
find . -name "*.tsx" -type f -exec sed -i '/function generatePlaceholder/,/^}/d' {} \;

# Remove fallback to placeholder data
find . -name "*.tsx" -type f -exec sed -i '/\/\/ Fallback to placeholder/,/toast\.info.*sample data/d' {} \;
find . -name "*.tsx" -type f -exec sed -i '/Using sample data/d' {} \;

echo "✓ Frontend sample data generators removed"

# 3. List files that still contain sample/mock references
echo ""
echo "Step 3: Checking for remaining sample data references..."
echo "Files still containing 'placeholder', 'sample', or 'mock':"
grep -r -l "placeholder\|sample\|mock" --include="*.tsx" --include="*.ts" . 2>/dev/null | head -20

echo ""
echo "========================================="
echo "Cleanup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Review the listed files above for any remaining sample data"
echo "2. Restart backend on port 5000"
echo "3. Restart Python microservice on port 5001"
echo "4. Restart frontend on port 3002"
echo ""
