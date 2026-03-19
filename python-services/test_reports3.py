import os
from dotenv import load_dotenv
from supabase import create_client
import json

load_dotenv()
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')
client = create_client(url, key)

print("--- Room Supplies fix test ---")
try:
    # PostgREST uses * for wildcards
    qry = 'category.ilike.*room*,category.ilike.*amenit*,category.ilike.*linen*,category.ilike.*toiletry*,category.ilike.*housekeep*,category.ilike.*soap*,category.ilike.*clean*,category.ilike.*deterg*'
    res = client.table('simple_items').select('*').or_(qry).execute()
    print(f"Items found with *: {len(res.data)}")
    
    # Try just % inside string
    qry2 = 'category.ilike.%room%,category.ilike.%amenit%,category.ilike.%linen%,category.ilike.%toiletry%,category.ilike.%housekeep%'
    res2 = client.table('simple_items').select('*').or_(qry2).execute()
    print(f"Items found with %: {len(res2.data)}")
except Exception as e:
    print(e)

print("\n--- Stock Movement data inspect ---")
try:
    res = client.table('branch_stock_movements').select('*').limit(5).execute()
    print(f"branch_stock_movements sample:")
    for row in res.data:
        print(row)
        
    print("\nCheck store_stock_movements")
    try:
        res2 = client.table('store_stock_movements').select('*').limit(5).execute()
        print(f"store_stock_movements items: {len(res2.data)}")
    except Exception as e:
        print(f"store_stock_movements error: {e}")
        
except Exception as e:
    print(e)
