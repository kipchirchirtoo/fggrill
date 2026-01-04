import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('/home/john/fggrill/python-services/.env')

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

try:
    supabase: Client = create_client(url, key)
    # PostgREST doesn't give schema easily, but we can try to get one row and see keys
    res = supabase.table('revenue_entries').select('*').limit(1).execute()
    if res.data:
        print("Columns in revenue_entries:")
        print(res.data[0].keys())
    else:
        print("revenue_entries is empty, cannot infer columns easily via select *")
        # Try to insert a dummy row and rollback? No, let's try to find where it's defined.
except Exception as e:
    print(f"Error: {e}")
