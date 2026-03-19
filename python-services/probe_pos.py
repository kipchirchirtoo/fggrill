
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('python-services/.env')
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
s = create_client(url, key)

table = s.table('pos_transactions')
cols_to_try = ['amount', 'total_amount', 'total', 'price', 'value', 'grand_total']

print("--- Probing POS Transactions Column ---")
for c in cols_to_try:
    try:
        res = table.select(c).limit(1).execute()
        print(f"SUCCESS: {c} exists")
    except Exception as e:
        msg = str(e)
        if "does not exist" in msg:
            print(f"FAILED: {c} does not exist")
        else:
            print(f"ERROR on {c}: {msg[:100]}")
