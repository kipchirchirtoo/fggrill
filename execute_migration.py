import psycopg2
import os

DB_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

# Read migration file
migration_file = 'backend/migrations/20260109_create_accounting_tables.txt'
with open(migration_file, 'r', encoding='utf-8') as f:
    migration_sql = f.read()

print(f"Running migration: {migration_file}")
print("=" * 60)

try:
    # Connect to database
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()
    
    # Execute migration
    cur.execute(migration_sql)
    conn.commit()
    
    print("SUCCESS: Migration executed")
    print("=" * 60)
    
    # Verify results
    print("\nVerification:")
    
    # Check accounting_account_categories
    cur.execute("SELECT COUNT(*) FROM accounting_account_categories")
    count = cur.fetchone()[0]
    print(f"  accounting_account_categories: {count} rows")
    
    # List categories
    cur.execute("SELECT name FROM accounting_account_categories ORDER BY name")
    categories = [row[0] for row in cur.fetchall()]
    print(f"  Categories: {', '.join(categories)}")
    
    # Check approval_requests table exists
    cur.execute("""
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_name = 'approval_requests'
    """)
    exists = cur.fetchone()[0]
    print(f"  approval_requests table: {'EXISTS' if exists else 'NOT FOUND'}")
    
    # Check category_id column
    cur.execute("""
        SELECT COUNT(*) 
        FROM information_schema.columns 
        WHERE table_name = 'accounting_chart_of_accounts' 
        AND column_name = 'category_id'
    """)
    exists = cur.fetchone()[0]
    print(f"  category_id column: {'EXISTS' if exists else 'NOT FOUND'}")
    
    print("\n" + "=" * 60)
    print("MIGRATION COMPLETED SUCCESSFULLY")
    print("=" * 60)
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"\nERROR: {e}")
    if 'conn' in locals():
        conn.rollback()
        conn.close()
    raise
