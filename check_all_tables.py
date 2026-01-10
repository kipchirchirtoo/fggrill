import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('backend/.env')

def check_counts():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print("DATABASE_URL not found in .env")
        return

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        tables = ['suppliers', 'accounting_vendors', 'store_suppliers', 'vendors']
        print("Checking record counts for vendor-related tables:")
        
        for table in tables:
            try:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                count = cur.fetchone()[0]
                print(f"{table}: {count} records")
            except Exception as e:
                print(f"{table}: Table not found or error: {e}")
                conn.rollback()

        print("\nChecking schema for suppliers table:")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'suppliers'
        """)
        columns = cur.fetchall()
        for col in columns:
            print(f"  {col[0]}: {col[1]}")

        print("\nChecking schema for accounting_ap_bills table:")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'accounting_ap_bills'
        """)
        columns = cur.fetchall()
        for col in columns:
            print(f"  {col[0]}: {col[1]}")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Connection error: {e}")

if __name__ == "__main__":
    check_counts()
