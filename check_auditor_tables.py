import psycopg2
import sys

DB_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

tables_to_check = [
    'restaurant_orders',
    'bar_orders',
    'payments',
    'stock_requisitions',
    'stock_requisition_items',
    'branch_stock',
    'branch_stock_movements',
    'reservations',
    'simple_items',
    'receipts',
    'housekeeping_tasks',
    'expenses'
]

try:
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    for table_name in tables_to_check:
        print(f"\n=== Checking {table_name} ===")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = %s
            AND table_schema = 'public'
            ORDER BY ordinal_position
        """, (table_name,))
        cols = cur.fetchall()
        if cols:
            print(f"Table EXISTS with {len(cols)} columns:")
            for col in cols:
                print(f"  - {col[0]}: {col[1]}")
            
            # Sample status values if status column exists
            status_col = next((c[0] for c in cols if c[0] in ['status', 'payment_status', 'movement_type']), None)
            if status_col:
                cur.execute(f"SELECT DISTINCT {status_col} FROM {table_name} LIMIT 10")
                statuses = cur.fetchall()
                print(f"  Distinct {status_col} values: {[s[0] for s in statuses]}")
                
            # Count records
            cur.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cur.fetchone()[0]
            print(f"  Total records: {count}")
        else:
            print("Table DOES NOT EXIST")
    
    cur.close()
    conn.close()
    sys.stdout.flush()
    
except Exception as e:
    print(f"Error: {e}")
    sys.stdout.flush()
    sys.exit(1)
