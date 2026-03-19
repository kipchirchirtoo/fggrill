
import os
import sys
from datetime import datetime, timedelta
import json

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from reports.database_fetcher import DatabaseFetcher

def test_revenue_reconciliation():
    """Test revenue reconciliation report data fetching"""
    print("\n=== Testing Revenue Reconciliation Report ===")
    fetcher = DatabaseFetcher()
    
    # Use dates from the user's screenshot if possible, or recent ones
    # The screenshot showed 11/17/2025 -> 03/19/2026
    start_date = "2025-11-17"
    end_date = "2026-03-19"
    
    filters = {
        'start_date': start_date,
        'end_date': end_date,
        'branch_id': 0 # All branches
    }
    
    print(f"Fetching data for {start_date} to {end_date}...")
    try:
        data = fetcher.fetch_report_data('revenue_reconciliation', filters)
        
        print(f"Total Revenue (Payments): {data.get('total_revenue', 0)}")
        print(f"Total Sales (Orders/Rooms): {data.get('sales', 0)}")
        print(f"Variance: {data.get('variance', 0)}")
        print(f"Transactions Count: {len(data.get('transactions', []))}")
        print(f"Cashier Summaries: {len(data.get('cashier_summaries', []))}")
        print(f"Departments: {json.dumps(data.get('departments', {}), indent=2)}")
        print(f"Payment Modes: {json.dumps(data.get('payment_modes', {}), indent=2)}")
        
        if not data.get('transactions') and data.get('total_revenue') == 0:
            print("\nWARNING: No payment data found!")
            
    except Exception as e:
        print(f"ERROR during fetch: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(main_dir)
    test_revenue_reconciliation()
