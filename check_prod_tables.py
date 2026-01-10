import psycopg2
import sys

DB_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

try:
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    print("=== Checking for accounting-related tables ===")
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%account%'
        ORDER BY table_name
    """)
    tables = cur.fetchall()
    print(f"\nAccounting tables found: {len(tables)}")
    for table in tables:
        print(f"  - {table[0]}")
    
    print("\n=== Checking for approval-related tables ===")
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND (table_name LIKE '%approval%' OR table_name LIKE '%request%')
        ORDER BY table_name
    """)
    tables = cur.fetchall()
    print(f"\nApproval/Request tables found: {len(tables)}")
    for table in tables:
        print(f"  - {table[0]}")
    
    # Check if accounting_account_categories exists
    print("\n=== Checking accounting_account_categories ===")
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'accounting_account_categories'
        ORDER BY ordinal_position
    """)
    cols = cur.fetchall()
    if cols:
        print("Table EXISTS with columns:")
        for col in cols:
            print(f"  - {col[0]}: {col[1]}")
    else:
        print("Table DOES NOT EXIST")
    
    # Check if approval_requests exists
    print("\n=== Checking approval_requests ===")
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'approval_requests'
        ORDER BY ordinal_position
    """)
    cols = cur.fetchall()
    if cols:
        print("Table EXISTS with columns:")
        for col in cols:
            print(f"  - {col[0]}: {col[1]}")
    else:
        print("Table DOES NOT EXIST")
    
    # Check accounting_chart_of_accounts
    print("\n=== Checking accounting_chart_of_accounts ===")
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'accounting_chart_of_accounts'
        ORDER BY ordinal_position
    """)
    cols = cur.fetchall()
    if cols:
        print("Table EXISTS with columns:")
        for col in cols:
            print(f"  - {col[0]}: {col[1]}")
        
        # Check if it has category_id
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'accounting_chart_of_accounts'
            AND column_name = 'category_id'
        """)
        cat_col = cur.fetchone()
        if cat_col:
            print(f"\n  ✓ Has category_id column: {cat_col[1]}")
        else:
            print("\n  ✗ Missing category_id column!")
    else:
        print("Table DOES NOT EXIST")
    
    cur.close()
    conn.close()
    sys.stdout.flush()
    
except Exception as e:
    print(f"Error: {e}")
    sys.stdout.flush()
    sys.exit(1)
