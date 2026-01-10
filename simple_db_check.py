import psycopg2

DB_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Check accounting tables
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%account%' ORDER BY table_name")
print("ACCOUNTING TABLES:")
for row in cur.fetchall():
    print(row[0])

# Check approval tables
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE '%approval%' OR table_name LIKE '%request%') ORDER BY table_name")
print("\nAPPROVAL/REQUEST TABLES:")
for row in cur.fetchall():
    print(row[0])

# Check accounting_account_categories
cur.execute("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'accounting_account_categories')")
exists = cur.fetchone()[0]
print(f"\naccounting_account_categories EXISTS: {exists}")

# Check approval_requests
cur.execute("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'approval_requests')")
exists = cur.fetchone()[0]
print(f"approval_requests EXISTS: {exists}")

cur.close()
conn.close()
