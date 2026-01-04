import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Point to the python-services/.env file
load_dotenv('/home/john/fggrill/python-services/.env')

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not url or not key:
    print(f"Missing Supabase credentials. URL: {url}, Key: {key is not None}")
    exit(1)

try:
    supabase: Client = create_client(url, key)
    # Try to list tables or just select from a known table
    res = supabase.table('journal_entries').select('id').limit(1).execute()
    print("Successfully connected to Supabase and queried journal_entries")
    print(res.data)
except Exception as e:
    print(f"Error: {e}")
