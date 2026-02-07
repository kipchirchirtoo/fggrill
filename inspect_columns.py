import psycopg2
import os

DB_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def find_branch_id_in_tables():
    print("\n--- Searching for 'branch_id' in all accounting/bank tables ---")
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        cur.execute("""
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE (table_name LIKE 'accounting_%' OR table_name LIKE 'bank_%')
            AND column_name = 'branch_id'
        """)
        results = cur.fetchall()
        for table, col in results:
            print(f"{table}: {col}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

find_branch_id_in_tables()
