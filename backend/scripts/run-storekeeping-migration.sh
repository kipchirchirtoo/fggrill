#!/bin/bash

# Load environment variables
source ../.env 2>/dev/null || true

# Check if Supabase URL is set
if [ -z "$SUPABASE_PROJECT_URL" ]; then
    echo "Error: SUPABASE_PROJECT_URL not set"
    exit 1
fi

# Extract database connection details from Supabase URL
PROJECT_REF=$(echo $SUPABASE_PROJECT_URL | sed 's/https:\/\///' | sed 's/.supabase.co//')

echo "Running storekeeping migrations..."
echo "Project: $PROJECT_REF"

# Run migrations using Supabase CLI or psql
# You'll need to install Supabase CLI: npm install -g supabase

# Option 1: Using Supabase CLI (recommended)
if command -v supabase &> /dev/null; then
    echo "Using Supabase CLI..."
    supabase db push
else
    echo "Supabase CLI not found. Please run migrations manually in Supabase Dashboard."
    echo "Go to: https://app.supabase.com/project/$PROJECT_REF/sql"
    echo "Then copy and paste the SQL from: backend/supabase/migrations/11_storekeeping_tables.sql"
fi
