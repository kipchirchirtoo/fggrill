import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('/home/john/fggrill/python-services/.env')

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

try:
    supabase: Client = create_client(url, key)
    # Try to get one row or use a trick to get column names
    # Since it's empty, we can try to insert a row with invalid data to see error or just use a known RPC if available
    # But let's try to find the definition in the SQL file first as it's more reliable
    print("Checking SQL definition for accounting_journal_entries...")
except Exception as e:
    print(f"Error: {e}")
