import os
import psycopg2
from dotenv import load_dotenv

print("Loading .env from backend/.env...")
load_dotenv('backend/.env')

def inspect_data():
    db_url = os.environ.get('DATABASE_URL')
    print(f"DATABASE_URL: {db_url}")
    if not db_url:
        print("DATABASE_URL not found in .env")
        return

    try:
        print("Connecting to DB...")
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        print("--- Suppliers (First 5) ---")
        cur.execute("SELECT id, name FROM suppliers LIMIT 5")
        suppliers = cur.fetchall()
        print(f"Found {len(suppliers)} suppliers")
        for s in suppliers:
            print(f"ID: {s[0]}, Name: {s[1]}")

        print("\n--- Accounting Vendors (First 5) ---")
        cur.execute("SELECT id, vendor_code, vendor_name FROM accounting_vendors LIMIT 5")
        vendors = cur.fetchall()
        print(f"Found {len(vendors)} vendors")
        for v in vendors:
            print(f"ID: {v[0]}, Code: {v[1]}, Name: {v[2]}")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_data()
