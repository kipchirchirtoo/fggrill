import psycopg2

DB_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def check_all_constraints():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    for table in ['simple_items', 'store_items', 'branch_stock']:
        cur.execute(f"""
            SELECT
                conname AS constraint_name,
                contype AS constraint_type,
                pg_get_constraintdef(c.oid) AS constraint_def
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE n.nspname = 'public' AND contype IN ('p', 'u')
            AND conrelid = 'public.{table}'::regclass;
        """)
        print(f"\nConstraints for {table}:")
        for row in cur.fetchall():
            print(row)

    cur.close()
    conn.close()

if __name__ == "__main__":
    check_all_constraints()
