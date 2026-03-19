import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')
client = create_client(url, key)

print("--- Print store_stock_movements with store_items join ---")
try:
    res = client.table('store_stock_movements').select('*, item:store_items(name, item_code)').limit(2).execute()
    for row in res.data:
        print(row)
except Exception as e:
    print(e)
