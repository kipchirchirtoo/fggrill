
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

def inspect_columns():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    supabase = create_client(url, key)
    
    print("--- POS Transactions ---")
    try:
        res = supabase.table('pos_transactions').select('*').limit(1).execute()
        if res.data:
            print(f"Columns: {list(res.data[0].keys())}")
        else:
            print("No data in pos_transactions")
    except Exception as e:
        print(f"Error inspecting pos_transactions: {e}")
        
    print("\n--- Bar Orders ---")
    try:
        res = supabase.table('bar_orders').select('*').limit(1).execute()
        if res.data:
            print(f"Columns: {list(res.data[0].keys())}")
        else:
            print("No data in bar_orders")
    except Exception as e:
        print(f"Error inspecting bar_orders: {e}")

    print("\n--- Restaurant Orders ---")
    try:
        res = supabase.table('restaurant_orders').select('*').limit(1).execute()
        if res.data:
            print(f"Columns: {list(res.data[0].keys())}")
        else:
            print("No data in restaurant_orders")
    except Exception as e:
        print(f"Error inspecting restaurant_orders: {e}")

if __name__ == '__main__':
    inspect_columns()
