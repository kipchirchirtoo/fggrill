import psycopg2
import json

DB_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def fetch_stock_info():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cursor = conn.cursor()

    result = {}

    # Get enum item_category
    cursor.execute("""
        SELECT enumlabel FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = 'item_category'
        ORDER BY enumsortorder;
    """)
    result['stock_categories (enum)'] = [row[0] for row in cursor.fetchall()]

    # Find tables related to stock
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name LIKE '%stock%'
    """)
    stock_tables = [row[0] for row in cursor.fetchall()]
    
    # Also find table 'items' or similar
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name LIKE '%item%'
    """)
    item_tables = [row[0] for row in cursor.fetchall()]

    all_target_tables = list(set(stock_tables + item_tables))
    result['found_tables'] = all_target_tables

    # Fetch 5 sample rows from each
    result['samples'] = {}
    for table in all_target_tables:
        cursor.execute(f"SELECT * FROM public.{table} LIMIT 5")
        colnames = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        # Convert objects to string for JSON serialization
        rows_str = []
        for row in rows:
            rows_str.append([str(x) if x is not None else None for x in row])
        result['samples'][table] = {
            'columns': colnames,
            'data': rows_str
        }

    with open('stock_data_results.json', 'w') as f:
        json.dump(result, f, indent=2)

    print("Success. Written to stock_data_results.json")
    cursor.close()
    conn.close()

if __name__ == "__main__":
    fetch_stock_info()
