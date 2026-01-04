import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('/home/john/fggrill/python-services/.env')

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

try:
    supabase: Client = create_client(url, key)
    # Query information_schema to list tables
    res = supabase.rpc('get_tables', {}).execute()
    print("Tables:")
    print(res.data)
except Exception as e:
    # If RPC fails, try a direct query on information_schema
    try:
        res = supabase.table('information_schema.tables').select('table_name').eq('table_schema', 'public').execute()
        print("Tables (from information_schema):")
        for t in res.data:
            print(f"- {t['table_name']}")
    except Exception as e2:
        print(f"Error: {e2}")
