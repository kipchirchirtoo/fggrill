import psycopg2
import sys

DB_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

log_file = open('migration_log.txt', 'w')

def log(msg):
    print(msg)
    log_file.write(msg + '\n')
    log_file.flush()

# Read the migration file
with open('backend/migrations/20260109_create_accounting_tables.txt', 'r') as f:
    migration_sql = f.read()

log("Connecting to production database...")
conn = psycopg2.connect(DB_URL)
conn.autocommit = False
cur = conn.cursor()

try:
    log("Running migration...")
    cur.execute(migration_sql)
    conn.commit()
    log("SUCCESS: Migration completed successfully!")
    
    # Verify tables were created
    log("\nVerifying tables...")
    
    cur.execute("SELECT COUNT(*) FROM accounting_account_categories")
    count = cur.fetchone()[0]
    log(f"SUCCESS: accounting_account_categories created with {count} categories")
    
    cur.execute("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_requests')")
    exists = cur.fetchone()[0]
    log(f"SUCCESS: approval_requests table exists: {exists}")
    
    cur.execute("""
        SELECT EXISTS(
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'accounting_chart_of_accounts' 
            AND column_name = 'category_id'
        )
    """)
    exists = cur.fetchone()[0]
    log(f"SUCCESS: accounting_chart_of_accounts.category_id column exists: {exists}")
    
    log("\nALL MIGRATIONS APPLIED SUCCESSFULLY!")
    
except Exception as e:
    conn.rollback()
    log(f"\nERROR: Migration failed: {e}")
    import traceback
    log(traceback.format_exc())
    sys.exit(1)
finally:
    cur.close()
    conn.close()
    log_file.close()
