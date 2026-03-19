
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('python-services/.env')
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
s = create_client(url, key)

def probe(table_name, cols):
    print(f"\n--- Probing {table_name} ---")
    table = s.table(table_name)
    for c in cols:
        try:
            table.select(c).limit(1).execute()
            print(f"SUCCESS: {table_name}.{c} exists")
        except Exception as e:
            print(f"FAILED: {table_name}.{c}")

probe('pos_transactions', ['amount', 'total_amount', 'total'])
probe('bar_orders', ['amount', 'total_amount', 'total'])
probe('restaurant_orders', ['amount', 'total_amount', 'total'])
probe('outside_catering_bookings', ['amount', 'total_amount', 'total'])
probe('restaurant_pool_token_sales', ['amount', 'total_amount', 'total', 'amount_per_token'])
