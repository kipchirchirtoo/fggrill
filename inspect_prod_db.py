import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load from the .env I created for python-services
load_dotenv(r'c:\Users\Administrator\OneDrive\Desktop\fggrill\python-services\.env')

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

print(f"URL: {url}")
print(f"Key identified: {'Yes' if key else 'No'}")

try:
    supabase: Client = create_client(url, key)
    
    # 1. Check categories
    print("\n--- Accounting Account Categories ---")
    try:
        res = supabase.table('accounting_account_categories').select('*').execute()
        for cat in res.data:
            print(f"- {cat['name']} (ID: {cat['id']})")
    except Exception as e:
        print(f"Error checking categories: {e}")

    # 2. Check approval_requests columns and joins
    print("\n--- Approval Requests (Limit 1) ---")
    try:
        res = supabase.table('approval_requests').select('*').limit(1).execute()
        if res.data:
            print(res.data[0])
        else:
            print("No approval requests found.")
    except Exception as e:
        print(f"Error checking approval_requests: {e}")

    # 3. Check staff tables
    print("\n--- Tables starting with 'staff' ---")
    try:
        # Query information_schema to list tables
        res = supabase.table('information_schema.tables').select('table_name').eq('table_schema', 'public').execute()
        for t in res.data:
            if 'staff' in t['table_name']:
                print(f"- {t['table_name']}")
    except Exception as e:
        print(f"Error listing tables: {e}")

except Exception as e:
    print(f"Global Error: {e}")
