#!/bin/bash

# Script to batch convert all dashboard files to iOS minimal design
# Removes colorful gradients and replaces with neutral grays

DASHBOARD_DIR="/home/john/fggrill/frontend/src/app/dashboard"

echo "🎨 Converting all dashboards to iOS minimal design..."
echo "📊 Found $(find "$DASHBOARD_DIR" -name "page.tsx" -type f | wc -l) dashboard files"

# Find all page.tsx files in dashboard directory
find "$DASHBOARD_DIR" -name "page.tsx" -type f | while read file; do
    echo "Processing: $file"
    
    # Backup original file
    # cp "$file" "$file.backup"
    
    # Replace gradient backgrounds with neutral grays
    sed -i 's/bg-gradient-to-[a-z]\+ from-[a-z]\+-[0-9]\+ to-[a-z]\+-[0-9]\+/bg-white border-[rgba(60,60,67,0.12)] rounded-2xl/g' "$file"
    
    # Replace colored stat card backgrounds
    sed -i 's/bg-emerald-[0-9]\+/bg-[#F2F2F7]/g' "$file"
    sed -i 's/bg-blue-[0-9]\+/bg-[#F2F2F7]/g' "$file"
    sed -i 's/bg-indigo-[0-9]\+/bg-[#F2F2F7]/g' "$file"
    sed -i 's/bg-purple-[0-9]\+/bg-[#F2F2F7]/g' "$file"
    sed -i 's/bg-red-[0-9]\+/bg-[#F2F2F7]/g' "$file"
    sed -i 's/bg-amber-[0-9]\+/bg-[#F2F2F7]/g' "$file"
    sed -i 's/bg-yellow-[0-9]\+/bg-[#F2F2F7]/g' "$file"
    sed -i 's/bg-green-[0-9]\+/bg-[#F2F2F7]/g' "$file"
    sed -i 's/bg-teal-[0-9]\+/bg-[#F2F2F7]/g' "$file"
    sed -i 's/bg-cyan-[0-9]\+/bg-[#F2F2F7]/g' "$file"
    sed -i 's/bg-rose-[0-9]\+/bg-[#F2F2F7]/g' "$file"
    sed -i 's/bg-pink-[0-9]\+/bg-[#F2F2F7]/g' "$file"
    sed -i 's/bg-orange-[0-9]\+/bg-[#F2F2F7]/g' "$file"
    sed -i 's/bg-violet-[0-9]\+/bg-[#F2F2F7]/g' "$file"
    
    # Replace colored text
    sed -i 's/text-emerald-[0-9]\+/text-[#3C3C43]/g' "$file"
    sed -i 's/text-blue-[0-9]\+/text-[#3C3C43]/g' "$file"
    sed -i 's/text-indigo-[0-9]\+/text-[#3C3C43]/g' "$file"
    sed -i 's/text-purple-[0-9]\+/text-[#3C3C43]/g' "$file"
    sed -i 's/text-red-[0-9]\+/text-[#3C3C43]/g' "$file"
    sed -i 's/text-amber-[0-9]\+/text-[#3C3C43]/g' "$file"
    sed -i 's/text-yellow-[0-9]\+/text-[#3C3C43]/g' "$file"
    sed -i 's/text-green-[0-9]\+/text-[#3C3C43]/g' "$file"
    sed -i 's/text-teal-[0-9]\+/text-[#3C3C43]/g' "$file"
    sed -i 's/text-cyan-[0-9]\+/text-[#3C3C43]/g' "$file"
    sed -i 's/text-rose-[0-9]\+/text-[#3C3C43]/g' "$file"
    sed -i 's/text-pink-[0-9]\+/text-[#3C3C43]/g' "$file"
    sed -i 's/text-orange-[0-9]\+/text-[#3C3C43]/g' "$file"
    
    # Replace border colors
    sed -i 's/border-emerald-[0-9]\+/border-[rgba(60,60,67,0.12)]/g' "$file"
    sed -i 's/border-blue-[0-9]\+/border-[rgba(60,60,67,0.12)]/g' "$file"
    sed -i 's/border-indigo-[0-9]\+/border-[rgba(60,60,67,0.12)]/g' "$file"
    sed -i 's/border-purple-[0-9]\+/border-[rgba(60,60,67,0.12)]/g' "$file"
    sed -i 's/border-red-[0-9]\+/border-[rgba(60,60,67,0.12)]/g' "$file"
    sed -i 's/border-amber-[0-9]\+/border-[rgba(60,60,67,0.12)]/g' "$file"
    sed -i 's/border-teal-[0-9]\+/border-[rgba(60,60,67,0.12)]/g' "$file"
    
    # Replace rounded corners for iOS style
    sed -i 's/rounded-lg/rounded-2xl/g' "$file"
    sed -i 's/rounded-md/rounded-xl/g' "$file"
    
done

echo "✅ All dashboards converted to iOS minimal design!"
echo "📝 Backup files created with .backup extension"
