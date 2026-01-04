import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('/home/john/fggrill/python-services/.env')

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

try:
    supabase: Client = create_client(url, key)
    res = supabase.table('accounting_bank_transactions').select('id').limit(1).execute()
    print("accounting_bank_transactions exists")
    print(res.data)
except Exception as e:
    print(f"Error: {e}")
