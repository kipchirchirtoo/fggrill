import os
import psycopg2
from dotenv import load_dotenv
import json

load_dotenv('backend/.env')

def check_schema():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print("DATABASE_URL not found in .env")
        return

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        tables = ['accounting_ar_invoices', 'accounting_bank_transactions', 'accounting_customers', 'customers', 'users']
        print("Checking schemas for relevant tables:")
        
        for table in tables:
            try:
                print(f"\n--- {table} ---")
                cur.execute(f"""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = '{table}'
                    ORDER BY ordinal_position
                """)
                columns = cur.fetchall()
                if not columns:
                    print("Table not found.")
                else:
                    for col in columns:
                        print(f"{col[0]}: {col[1]}")
            except Exception as e:
                print(f"Error checking schema for {table}: {e}")
                conn.rollback()

        print("\nChecking for foreign key constraints on accounting_ar_invoices:")
        cur.execute("""
            SELECT
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM 
                information_schema.key_column_usage AS kcu 
                JOIN information_schema.constraint_column_usage AS ccu 
                  ON ccu.constraint_name = kcu.constraint_name 
            WHERE kcu.table_name = 'accounting_ar_invoices';
        """)
        fks = cur.fetchall()
        print(json.dumps(fks, indent=2))

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Connection error: {e}")

if __name__ == "__main__":
    check_schema()
