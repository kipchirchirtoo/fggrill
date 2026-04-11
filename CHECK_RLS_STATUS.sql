-- Check Row Level Security (RLS) Status for All Tables
-- This query shows which tables have RLS enabled and which don't

SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ ENABLED'
        ELSE '❌ DISABLED'
    END as rls_status,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY 
    rowsecurity DESC,
    tablename;

-- Count summary
SELECT 
    CASE 
        WHEN rowsecurity THEN 'RLS Enabled'
        ELSE 'RLS Disabled'
    END as status,
    COUNT(*) as table_count
FROM pg_tables
WHERE schemaname = 'public'
GROUP BY rowsecurity;

-- List tables WITHOUT RLS (Security Risk!)
SELECT 
    tablename as "⚠️ Tables Without RLS"
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false
ORDER BY tablename;

-- Check for policies on RLS-enabled tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
