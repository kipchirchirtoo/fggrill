#!/bin/bash

echo "Starting dashboard button fix..."
echo "This script will make all buttons and colors more minimal"

# Create a backup
BACKUP_DIR="./frontend/dashboard_backup_$(date +"%Y%m%d_%H%M%S")"
mkdir -p $BACKUP_DIR
cp -r ./frontend/src/app/dashboard $BACKUP_DIR/

echo "Backup created in $BACKUP_DIR"

# Find all instances of btn- classes and replace them with the minimal iOS style
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/btn-primary/bg-\[#007AFF\] text-white hover:bg-\[#007AFF\]\/90/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/btn-secondary/bg-\[#F2F2F7\] text-\[#007AFF\] hover:bg-\[#E5E5EA\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/btn-danger/bg-\[#FF3B30\] text-white hover:bg-\[#FF3B30\]\/90/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/btn-success/bg-\[#34C759\] text-white hover:bg-\[#34C759\]\/90/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/btn-outline/border border-\[#D1D1D6\] bg-white text-\[#007AFF\] hover:bg-\[#F2F2F7\]/g' {} \;

# Replace color variables with direct hex values
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-blue-500/bg-\[#007AFF\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-blue-600/bg-\[#007AFF\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-blue-700/bg-\[#007AFF\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-red-500/bg-\[#FF3B30\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-red-600/bg-\[#FF3B30\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-green-500/bg-\[#34C759\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-green-600/bg-\[#34C759\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-yellow-500/bg-\[#FF9500\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-yellow-600/bg-\[#FF9500\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-gray-500/bg-\[#8E8E93\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-gray-600/bg-\[#8E8E93\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-gray-700/bg-\[#8E8E93\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-gray-800/bg-\[#8E8E93\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-gray-900/bg-\[#8E8E93\]/g' {} \;

# Replace text colors
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/text-blue-500/text-\[#007AFF\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/text-blue-600/text-\[#007AFF\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/text-red-500/text-\[#FF3B30\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/text-red-600/text-\[#FF3B30\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/text-green-500/text-\[#34C759\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/text-green-600/text-\[#34C759\]/g' {} \;

# Fix borders
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/border-gray-200/border-\[#E5E5EA\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/border-gray-300/border-\[#E5E5EA\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/border-blue-500/border-\[#007AFF\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/border-blue-600/border-\[#007AFF\]/g' {} \;

# Update any remaining button variants to more minimal styles
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/variant="default"/variant="primary"/g' {} \;

# Update badge colors to use minimal style
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/<Badge variant="default"/<Badge variant="light" color="primary"/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/<Badge variant="secondary"/<Badge variant="light" color="secondary"/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/<Badge variant="destructive"/<Badge variant="light" color="danger"/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/<Badge variant="outline"/<Badge variant="outline" color="primary"/g' {} \;

# Make all shadows more minimal
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/shadow-lg/shadow-\[0_2px_14px_rgba\(0,0,0,0.06\)\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/shadow-md/shadow-\[0_2px_8px_rgba\(0,0,0,0.05\)\]/g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/shadow-sm/shadow-\[0_1px_3px_rgba\(0,0,0,0.04\)\]/g' {} \;

# Make bg-white more consistent
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/bg-white/bg-\[#FFFFFF\]/g' {} \;

echo "Creating more minimal button and card components..."

# Create a custom button component for dashboards that is extremely minimal
mkdir -p ./frontend/src/components/ui/minimal

cat > ./frontend/src/components/ui/minimal/button.tsx << 'EOF'
import React from 'react';
import { cn } from '@/lib/utils';

export interface MinimalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const MinimalButton = React.forwardRef<HTMLButtonElement, MinimalButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth = false, children, ...props }, ref) => {
    const variantStyles = {
      primary: "bg-[#007AFF] text-white hover:bg-[#007AFF]/90",
      secondary: "bg-[#F2F2F7] text-[#007AFF] hover:bg-[#E5E5EA]",
      outline: "bg-white border border-[#D1D1D6] text-[#007AFF] hover:bg-[#F2F2F7]",
      destructive: "bg-[#FF3B30] text-white hover:bg-[#FF3B30]/90",
      success: "bg-[#34C759] text-white hover:bg-[#34C759]/90",
      ghost: "text-[#007AFF] hover:bg-[#F2F2F7]",
    };
    
    const sizeStyles = {
      sm: "h-8 px-3 text-sm rounded-lg",
      md: "h-10 px-4 text-sm rounded-lg",
      lg: "h-11 px-5 text-base rounded-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center transition-colors focus:outline-none",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

MinimalButton.displayName = 'MinimalButton';

// Also export as Button to be a drop-in replacement
export const Button = MinimalButton;

export default MinimalButton;
EOF

# Create a card component that's more minimal
cat > ./frontend/src/components/ui/minimal/card.tsx << 'EOF'
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-[#E5E5EA] bg-[#FFFFFF]",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-medium",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[#8E8E93]", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
EOF

echo "Updating specific components in the dashboard..."

# Find all direct imports of Button and Card in dashboard and replace with our minimal versions
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec grep -l "import.*Button.*from" {} \; | xargs -I{} sed -i 's|import.*Button.*from.*|import { Button } from "@/components/ui/minimal/button";|g' {}
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec grep -l "import.*Card.*from" {} \; | xargs -I{} sed -i 's|import.*Card.*from.*|import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";|g' {}

echo "Making shadows and borders more minimal..."
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/shadow-\[/shadow-none /g' {} \;
find ./frontend/src/app/dashboard -name "*.tsx" -type f -exec sed -i 's/border-\[2px\]/border/g' {} \;

chmod +x ./fix_dashboard_buttons.sh

echo "Script completed!"
echo "Run this script to fix all dashboard buttons and reduce colors."
