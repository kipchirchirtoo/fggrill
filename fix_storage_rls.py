import psycopg2
import sys

# Reusing the DB URL from existence run_migration.py
DB_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def log(msg):
    print(msg)

# The SQL from backend/supabase/migrations/20260127_fix_storage_rls.sql
migration_sql = """
-- Ensure 'profile' bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile', 'profile', true)
ON CONFLICT (id) DO NOTHING;

-- DROP EXISTING POLICIES IF THEY EXIST
DROP POLICY IF EXISTS "Allow public select" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update own photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own photos" ON storage.objects;

-- 1. Policy for viewing profile photos (Public)
CREATE POLICY "Allow public select"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile');

-- 2. Policy for uploading profile photos (Authenticated users)
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile' AND
  (name LIKE auth.uid()::text || '-%')
);

-- 3. Policy for updating own profile photos
CREATE POLICY "Allow users to update own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile' AND
  (name LIKE auth.uid()::text || '-%')
);

-- 4. Policy for deleting own profile photos
CREATE POLICY "Allow users to delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile' AND
  (name LIKE auth.uid()::text || '-%')
);
"""

log("Connecting to production database...")
try:
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()

    log("Running storage RLS migration...")
    cur.execute(migration_sql)
    log("SUCCESS: Storage RLS migration completed successfully!")

    # Verify policies
    log("\nVerifying policies...")
    cur.execute("SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';")
    policies = cur.fetchall()
    log("Current storage.objects policies:")
    for p in policies:
        log(f"- {p[0]}")

except Exception as e:
    log(f"\nERROR: Migration failed: {e}")
    import traceback
    log(traceback.format_exc())
    sys.exit(1)
finally:
    if 'cur' in locals(): cur.close()
    if 'conn' in locals(): conn.close()
