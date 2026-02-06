
import os
import sys
from dotenv import load_dotenv

# Add current directory to path so we can import reports.database_fetcher
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load env vars
load_dotenv()

from reports.database_fetcher import DatabaseFetcher

def test_connection():
    print("Testing Database Connection...")
    fetcher = DatabaseFetcher()
    
    if not fetcher.client:
        print("FAILED: Client not initialized (check env vars)")
        return
    
    print("SUCCESS: Client initialized")
    
    # Test Expenses (Fixed column)
    print("\nTesting Expenses Fetch (checking 'expense_date' column)...")
    try:
        # Fetch last 30 days
        filters = {'branch_id': 1} # Assuming branch 1 exists
        data = fetcher._fetch_expenses(filters)
        # We just want to see if it errors out
        print(f"SUCCESS: Fetched {len(data.get('work_orders', [])) if 'work_orders' in data else 'data'} expenses (Data type: {type(data)})")
    except Exception as e:
        print(f"FAILED: Expenses fetch error: {e}")

    # Test Orders (Branch ID check)
    print("\nTesting Restaurant Orders Fetch (checking 'branch_id')...")
    try:
        filters = {'branch_id': 1}
        data = fetcher._fetch_daily_sales(filters)
        print(f"SUCCESS: Fetched sales data. Total Revenue: {data.get('total_revenue', 0)}")
    except Exception as e:
        print(f"FAILED: Orders fetch error: {e}")

    # Test Bar Orders
    print("\nTesting Bar Orders Fetch...")
    try:
        data = fetcher.client.table('bar_orders').select('*').limit(1).execute()
        print(f"SUCCESS: Bar orders table exists. Rows: {len(data.data or [])}")
    except Exception as e:
        print(f"FAILED: Bar orders fetch error: {e}")

if __name__ == "__main__":
    test_connection()
