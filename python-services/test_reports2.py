import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')
client = create_client(url, key)

print("--- Distinct Categories in simple_items ---")
try:
    res = client.table('simple_items').select('category').execute()
    categories = set(item.get('category') for item in res.data if item.get('category'))
    print("\n".join(categories))
except Exception as e:
    print(e)

print("\n--- Stock Move tables ---")
try:
    res = client.table('branch_stock_movements').select('*').limit(5).execute()
    print(f"Items in branch_stock_movements: {len(res.data)}")
    
    res2 = client.table('store_stock_movements').select('*').limit(5).execute() if False else None
    # Let's check if store_stock_movements exists
except Exception as e:
    print(e)
