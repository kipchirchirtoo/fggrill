import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('/home/john/fggrill/python-services/.env')

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

try:
    supabase: Client = create_client(url, key)
    res = supabase.table('expenses').select('*').limit(1).execute()
    if res.data:
        print("Columns in expenses:")
        print(res.data[0].keys())
    else:
        print("expenses is empty")
except Exception as e:
    print(f"Error: {e}")
