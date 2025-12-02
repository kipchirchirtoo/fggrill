#!/bin/bash

echo "Fixing missing imports for iOS components..."

# Find all files using IOSButton without importing it
grep -r "IOSButton" --include="*.tsx" ./frontend/src/app | grep -v "import.*IOSButton" | awk -F: '{print $1}' | sort -u | while read file; do
  echo "Adding IOSButton import to $file"
  # Add import if not already present
  if ! grep -q "import.*IOSButton" "$file"; then
    # Find the last import line and append our import after it
    last_import_line=$(grep -n "import" "$file" | tail -n 1 | cut -d: -f1)
    sed -i "${last_import_line}a import { IOSButton } from '@/components/ui/ios-button';" "$file"
  fi
done

# Find all files using IOSCard without importing it
grep -r "IOSCard" --include="*.tsx" ./frontend/src/app | grep -v "import.*IOSCard" | awk -F: '{print $1}' | sort -u | while read file; do
  echo "Adding IOSCard import to $file"
  # Add import if not already present
  if ! grep -q "import.*IOSCard" "$file"; then
    # Find the last import line and append our import after it
    last_import_line=$(grep -n "import" "$file" | tail -n 1 | cut -d: -f1)
    sed -i "${last_import_line}a import { IOSCard } from '@/components/ui/ios-card';" "$file"
  fi
done

# Find all files using IOSBadge without importing it
grep -r "IOSBadge" --include="*.tsx" ./frontend/src/app | grep -v "import.*IOSBadge" | awk -F: '{print $1}' | sort -u | while read file; do
  echo "Adding IOSBadge import to $file"
  # Add import if not already present
  if ! grep -q "import.*IOSBadge" "$file"; then
    # Find the last import line and append our import after it
    last_import_line=$(grep -n "import" "$file" | tail -n 1 | cut -d: -f1)
    sed -i "${last_import_line}a import { IOSBadge } from '@/components/ui/ios-badge';" "$file"
  fi
done

# Find all files using IOSModal without importing it
grep -r "IOSModal" --include="*.tsx" ./frontend/src/app | grep -v "import.*IOSModal" | awk -F: '{print $1}' | sort -u | while read file; do
  echo "Adding IOSModal import to $file"
  # Add import if not already present
  if ! grep -q "import.*IOSModal" "$file"; then
    # Find the last import line and append our import after it
    last_import_line=$(grep -n "import" "$file" | tail -n 1 | cut -d: -f1)
    sed -i "${last_import_line}a import { IOSModal } from '@/components/ui/ios-modal';" "$file"
  fi
done

# Also fix imports for modal components
grep -r "IOSModalHeader\|IOSModalContent\|IOSModalFooter\|IOSModalTitle" --include="*.tsx" ./frontend/src/app | grep -v "import.*IOSModalHeader\|IOSModalContent\|IOSModalFooter\|IOSModalTitle" | awk -F: '{print $1}' | sort -u | while read file; do
  echo "Adding IOSModal subcomponents import to $file"
  # Add import if not already present
  if grep -q "import.*IOSModal" "$file" && ! grep -q "import.*IOSModalHeader" "$file"; then
    # Update existing import to include subcomponents
    sed -i "s/import { IOSModal } from '@\/components\/ui\/ios-modal';/import { IOSModal, IOSModalHeader, IOSModalTitle, IOSModalContent, IOSModalFooter } from '@\/components\/ui\/ios-modal';/" "$file"
  elif ! grep -q "import.*IOSModalHeader" "$file"; then
    # Find the last import line and append our import after it
    last_import_line=$(grep -n "import" "$file" | tail -n 1 | cut -d: -f1)
    sed -i "${last_import_line}a import { IOSModal, IOSModalHeader, IOSModalTitle, IOSModalContent, IOSModalFooter } from '@/components/ui/ios-modal';" "$file"
  fi
done

# Make the script executable
chmod +x ./fix_ios_imports.sh

echo "Import fixes completed!"
