#!/bin/bash

# =====================================================
# Apply Comprehensive Database Indexing Migration
# =====================================================

set -e

echo "=========================================="
echo "Comprehensive Database Indexing Migration"
echo "=========================================="
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first."
    echo "   npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Navigate to backend directory
cd backend

echo "📋 Migration file: supabase/migrations/70_comprehensive_indexing.sql"
echo ""

# Show migration summary
echo "📊 Migration Summary:"
echo "   - 150+ indexes across all critical tables"
echo "   - Idempotency keys on financial transactions"
echo "   - Partial indexes for active/open records"
echo "   - BRIN index for audit logs (time-series)"
echo "   - Composite indexes for common query patterns"
echo "   - Table analysis function for statistics"
echo ""

# Confirm before proceeding
read -p "⚠️  This will create 150+ indexes. Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 1
fi

echo ""
echo "🚀 Applying migration..."
echo ""

# Apply migration
supabase db push

echo ""
echo "✅ Migration applied successfully!"
echo ""

# Run analyze
echo "📊 Running ANALYZE to update statistics..."
supabase db execute --sql "ANALYZE;"

echo ""
echo "=========================================="
echo "✅ Indexing Complete!"
echo "=========================================="
echo ""
echo "📈 Next Steps:"
echo "   1. Monitor index usage with provided queries"
echo "   2. Check query performance improvements"
echo "   3. Schedule weekly REINDEX and VACUUM (see migration file)"
echo "   4. Run analyze_all_tables() function weekly"
echo ""
echo "📊 Check index usage:"
echo "   supabase db execute --sql \"SELECT schemaname, tablename, indexname, idx_scan FROM pg_stat_user_indexes WHERE schemaname = 'public' ORDER BY idx_scan DESC LIMIT 20;\""
echo ""
