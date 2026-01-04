import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('/home/john/fggrill/python-services/.env')

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

try:
    supabase: Client = create_client(url, key)
    res = supabase.table('accounting_chart_of_accounts').select('id').limit(1).execute()
    if not res.data:
        print("accounting_chart_of_accounts is empty")
    else:
        print("accounting_chart_of_accounts has data")
except Exception as e:
    print(f"Error: {e}")
