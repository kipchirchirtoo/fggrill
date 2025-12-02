#!/bin/bash

echo "Starting iOS UI update process..."
echo "This script will update UI components to use the iOS-style design system"

# Create a backup first
BACKUP_DIR="./frontend/backup_$(date +"%Y%m%d_%H%M%S")"
mkdir -p $BACKUP_DIR
cp -r ./frontend/src/components $BACKUP_DIR/
cp -r ./frontend/src/app/layout.tsx $BACKUP_DIR/

echo "Backup created successfully in $BACKUP_DIR"

# Update imports in dashboard layout files
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/import { Button } from "@\/components\/ui\/button"/import { IOSButton as Button } from "@\/components\/ui\/ios-button"/' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@\/components\/ui\/card"/import { IOSCard as Card, IOSCardContent as CardContent, IOSCardDescription as CardDescription, IOSCardFooter as CardFooter, IOSCardHeader as CardHeader, IOSCardTitle as CardTitle } from "@\/components\/ui\/ios-card"/' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/import { Input } from "@\/components\/ui\/input"/import { IOSInput as Input } from "@\/components\/ui\/ios-input"/' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/import { Badge } from "@\/components\/ui\/badge"/import { IOSBadge as Badge } from "@\/components\/ui\/ios-badge"/' {} \;

# Update imports in components
find ./frontend/src/components -name "*.tsx" -type f -exec sed -i 's/import { Button } from "@\/components\/ui\/button"/import { IOSButton as Button } from "@\/components\/ui\/ios-button"/' {} \;
find ./frontend/src/components -name "*.tsx" -type f -exec sed -i 's/import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@\/components\/ui\/card"/import { IOSCard as Card, IOSCardContent as CardContent, IOSCardDescription as CardDescription, IOSCardFooter as CardFooter, IOSCardHeader as CardHeader, IOSCardTitle as CardTitle } from "@\/components\/ui\/ios-card"/' {} \;
find ./frontend/src/components -name "*.tsx" -type f -exec sed -i 's/import { Input } from "@\/components\/ui\/input"/import { IOSInput as Input } from "@\/components\/ui\/ios-input"/' {} \;
find ./frontend/src/components -name "*.tsx" -type f -exec sed -i 's/import { Badge } from "@\/components\/ui\/badge"/import { IOSBadge as Badge } from "@\/components\/ui\/ios-badge"/' {} \;

# Update class names to use iOS specific styles
find ./frontend/src/app -name "*.tsx" -type f -exec sed -i 's/rounded-lg/rounded-ios-lg/g' {} \;
find ./frontend/src/components -name "*.tsx" -type f -exec sed -i 's/rounded-lg/rounded-ios-lg/g' {} \;

# Add iOS fonts to className attributes
find ./frontend/src/app -name "*.tsx" -type f -exec sed -i 's/font-semibold/font-semibold font-sf-pro-display/g' {} \;
find ./frontend/src/components -name "*.tsx" -type f -exec sed -i 's/font-semibold/font-semibold font-sf-pro-display/g' {} \;

# Fix any hydration issues by adding suppressHydrationWarning to html tag if not already present
if ! grep -q "suppressHydrationWarning" ./frontend/src/app/layout.tsx; then
  sed -i 's/<html lang="en">/<html lang="en" suppressHydrationWarning>/g' ./frontend/src/app/layout.tsx
  sed -i 's/<body>/<body suppressHydrationWarning>/g' ./frontend/src/app/layout.tsx
fi

echo "Creating iOS demo page..."
# Create a demo page route for the design system
mkdir -p ./frontend/src/app/ios-design-demo

cat > ./frontend/src/app/ios-design-demo/page.tsx << 'EOF'
import { IOSDesignDemo } from '@/components/ui/ios-demo';

export default function IOSDesignDemoPage() {
  return <IOSDesignDemo />;
}
EOF

# Find all dashboard TypeScript files
DASHBOARD_DIR="./frontend/src/app/dashboard"

# Counter for updated files
UPDATED=0

# Find all .tsx files in dashboard directory
find "$DASHBOARD_DIR" -name "*.tsx" -type f | while read -r file; do
  # Check if file contains old UI imports
  if grep -q "from '@/components/ui/card'" "$file" || \
     grep -q "from '@/components/ui/button'" "$file" || \
     grep -q "from '@/components/ui/badge'" "$file"; then
    
    echo "📝 Updating: $file"
    
    # Create backup
    cp "$file" "$file.backup"
    
    # Step 1: Update imports
    sed -i "s|import { Card } from '@/components/ui/card';|import { IOSCard } from '@/components/ui/ios-card';|g" "$file"
    sed -i "s|import { Button } from '@/components/ui/button';|import { IOSButton } from '@/components/ui/ios-button';|g" "$file"
    sed -i "s|import { Badge } from '@/components/ui/badge';|import { IOSBadge } from '@/components/ui/ios-badge';|g" "$file"
    
    # Step 2: Update component usage (whole word replacement)
    sed -i 's/\bCard\b/IOSCard/g' "$file"
    sed -i 's/\bButton\b/IOSButton/g' "$file"
    sed -i 's/\bBadge\b/IOSBadge/g' "$file"
    
    # Step 3: Fix any broken import combinations
    sed -i "s|IOSCard, CardContent|IOSCard|g" "$file"
    sed -i "s|IOSCard, CardHeader|IOSCard|g" "$file"
    sed -i "s|IOSCard, CardTitle|IOSCard|g" "$file"
    
    ((UPDATED++))
  fi
done

# Make script executable
chmod +x ./update_all_dashboards_to_ios.sh

echo "✅ Updated $UPDATED dashboard files!"
echo "🎨 All dashboards now use iOS-styled UI components"
echo ""
echo "UI update completed!"
echo "You can now view the iOS design system demo at /ios-design-demo"
echo "Start the development server with: cd frontend && npm run dev"
echo ""
echo "Backups saved in $BACKUP_DIR and with .backup extension"
echo "Run: find . -name '*.backup' -delete to remove file backups if everything looks good"
