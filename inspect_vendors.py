import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load from the .env I created for python-services
load_dotenv(r'c:\Users\Administrator\OneDrive\Desktop\fggrill\python-services\.env')

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

try:
    supabase: Client = create_client(url, key)
    
    # 1. Check vendors
    print("\n--- Accounting Vendors ---")
    try:
        res = supabase.table('accounting_vendors').select('*').execute()
        if res.data:
            for vendor in res.data:
                print(f"- {vendor['name']} (ID: {vendor['id']})")
        else:
            print("No vendors found in accounting_vendors.")
    except Exception as e:
        print(f"Error checking vendors: {e}")

    # 2. Check if there are other vendor tables
    print("\n--- Searching for other vendor-like tables ---")
    try:
        res = supabase.table('information_schema.tables').select('table_name').eq('table_schema', 'public').execute()
        for t in res.data:
            if 'vendor' in t['table_name'] or 'supplier' in t['table_name'] or 'contact' in t['table_name']:
                print(f"- {t['table_name']}")
    except Exception as e:
        print(f"Error listing tables: {e}")

except Exception as e:
    print(f"Global Error: {e}")
