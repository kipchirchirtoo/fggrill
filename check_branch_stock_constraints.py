import psycopg2

DB_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def check_constraints():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    # Check constraints
    cur.execute("""
        SELECT
            conname AS constraint_name,
            contype AS constraint_type,
            pg_get_constraintdef(c.oid) AS constraint_def
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public' AND contype IN ('p', 'u')
        AND conrelid = 'public.branch_stock'::regclass;
    """)
    print("Constraints for branch_stock:")
    for row in cur.fetchall():
        print(row)
        
    # Check unique indexes
    cur.execute("""
        SELECT
            i.relname AS index_name,
            a.attname AS column_name
        FROM
            pg_class t,
            pg_class i,
            pg_index ix,
            pg_attribute a
        WHERE
            t.oid = ix.indrelid
            AND i.oid = ix.indexrelid
            AND a.attrelid = t.oid
            AND a.attnum = ANY(ix.indkey)
            AND t.relkind = 'r'
            AND t.relname = 'branch_stock'
            AND ix.indisunique = true;
    """)
    print("\nUnique Indexes for branch_stock:")
    for row in cur.fetchall():
        print(row)

    cur.close()
    conn.close()

if __name__ == "__main__":
    check_constraints()
