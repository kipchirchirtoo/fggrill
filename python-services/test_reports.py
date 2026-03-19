import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')
client = create_client(url, key)

print("--- Testing Room Supplies ---")
try:
    res = client.table('simple_items').select('*').limit(5).execute()
    print("Sample items from simple_items:")
    for item in res.data:
        print(f"SKU: {item.get('sku')} | Category: {item.get('category')} | Name: {item.get('item_name')}")
        
    print("\nExecuting original query:")
    items = client.table('simple_items').select('*')\
        .or_('category.ilike.%room%,category.ilike.%amenity%,category.ilike.%linen%,category.ilike.%toiletry%,category.ilike.%housekeeping%')\
        .execute()
    print(f"Found {len(items.data)} items matching room supplies categories.")
except Exception as e:
    print(f"Room supplies error: {e}")

print("\n--- Testing Stock Movement ---")
try:
    res = client.table('stock_history').select('*').limit(5).execute()
    print(f"Items in stock_history: {len(res.data)}")
    if res.data:
        print(f"First item: keys={res.data[0].keys()}")

    print("\nExecuting original query with join:")
    # This might fail if the foreign key is missing
    movements = client.table('stock_history').select('*, item:simple_items(item_name)').limit(5).execute()
    print(f"Successfully joined stock_history and simple_items")
except Exception as e:
    print(f"Stock movement error: {e}")
