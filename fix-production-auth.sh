#!/bin/bash

# EMERGENCY PRODUCTION AUTH FIX
# Run this to fix authentication immediately

echo "🚨 EMERGENCY PRODUCTION AUTH FIX"
echo "=================================="
echo ""
echo "This will fix authentication by setting passwords for all users"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Cancelled."
    exit 1
fi

echo ""
echo "Running fix..."
echo ""

cd backend
node fix-all-user-passwords.js

echo ""
echo "=================================="
echo "✅ FIX COMPLETE"
echo "=================================="
echo ""
echo "Default password: Allan@13900"
echo ""
echo "Test login now:"
echo "  curl -X POST https://api.hirall.com/api/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"admin@example.com\",\"password\":\"Allan@13900\"}'"
echo ""
echo "⚠️  IMPORTANT: Notify all users to change their passwords!"
echo ""
