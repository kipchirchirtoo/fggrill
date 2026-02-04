"""
Verification script to test report data fetching after database table redirections.
This script tests that reports now fetch real data from correct tables.
"""

import os
import sys
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from reports.database_fetcher import DatabaseFetcher

def test_daily_sales():
    """Test daily sales report data fetching"""
    print("\n=== Testing Daily Sales Report ===")
    fetcher = DatabaseFetcher()
    
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    
    filters = {
        'start_date': start_date,
        'end_date': end_date,
        'branch_id': 1
    }
    
    data = fetcher.fetch_report_data('daily_sales', filters)
    
    print(f"Total Revenue: {data.get('total_revenue', 0)}")
    print(f"Total Transactions: {data.get('total_transactions', 0)}")
    print(f"Categories: {len(data.get('categories', []))}")
    
    for cat in data.get('categories', []):
        print(f"  - {cat.get('name')}: {cat.get('total', 0)}")
    
    return data.get('total_revenue', 0) > 0 or data.get('total_transactions', 0) > 0

def test_occupancy():
    """Test occupancy report data fetching"""
    print("\n=== Testing Occupancy Report ===")
    fetcher = DatabaseFetcher()
    
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    
    filters = {
        'start_date': start_date,
        'end_date': end_date,
        'branch_id': 1
    }
    
    data = fetcher.fetch_report_data('occupancy', filters)
    
    print(f"Total Rooms: {data.get('total_rooms', 0)}")
    print(f"Occupied Rooms: {data.get('occupied_rooms', 0)}")
    print(f"Occupancy Rate: {data.get('occupancy_rate', 0):.1f}%")
    print(f"Room Types: {len(data.get('room_types', []))}")
    
    return data.get('total_rooms', 0) > 0

def test_financial_summary():
    """Test financial summary report data fetching"""
    print("\n=== Testing Financial Summary Report ===")
    fetcher = DatabaseFetcher()
    
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    
    filters = {
        'start_date': start_date,
        'end_date': end_date,
        'branch_id': 1
    }
    
    data = fetcher.fetch_report_data('financial_summary', filters)
    
    print(f"Total Revenue: {data.get('total_revenue', 0)}")
    print(f"  - Room Revenue: {data.get('room_revenue', 0)}")
    print(f"  - Restaurant Revenue: {data.get('restaurant_revenue', 0)}")
    print(f"  - Bar Revenue: {data.get('bar_revenue', 0)}")
    print(f"Total Expenses: {data.get('total_expenses', 0)}")
    print(f"Net Profit: {data.get('net_profit', 0)}")
    
    return data.get('total_revenue', 0) > 0

def test_stock_levels():
    """Test stock levels/reconciliation data fetching"""
    print("\n=== Testing Stock Levels Report ===")
    fetcher = DatabaseFetcher()
    
    filters = {
        'branch_id': 1
    }
    
    data = fetcher.fetch_stock_levels_data(1)
    
    print(f"Total Items: {len(data.get('items', []))}")
    print(f"Low Stock Items: {data.get('low_stock_count', 0)}")
    print(f"Out of Stock Items: {data.get('out_of_stock_count', 0)}")
    print(f"Total Variance Value: {data.get('total_variance_value', 0)}")
    
    if data.get('items'):
        print(f"\nSample items (first 3):")
        for item in data.get('items', [])[:3]:
            print(f"  - {item.get('item_name')}: Current={item.get('current_stock')}, Theoretical={item.get('theoretical_stock')}")
    
    return len(data.get('items', [])) > 0

def test_procurement_analysis():
    """Test procurement analysis data fetching"""
    print("\n=== Testing Procurement Analysis Report ===")
    fetcher = DatabaseFetcher()
    
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    
    filters = {
        'start_date': start_date,
        'end_date': end_date
    }
    
    data = fetcher._fetch_procurement_analysis(filters)
    
    print(f"Top Suppliers: {len(data.get('top_suppliers', []))}")
    for supplier in data.get('top_suppliers', [])[:5]:
        print(f"  - {supplier.get('name')}: {supplier.get('total_spend', 0)}")
    
    print(f"Price Trends: {len(data.get('price_trends', []))}")
    
    return len(data.get('top_suppliers', [])) > 0 or len(data.get('price_trends', [])) > 0

def main():
    """Run all verification tests"""
    print("=" * 60)
    print("REPORT DATA VERIFICATION SCRIPT")
    print("=" * 60)
    print("\nThis script verifies that reports fetch real data from the database")
    print("after table redirections (bookings -> reservations, etc.)\n")
    
    tests = [
        ("Daily Sales", test_daily_sales),
        ("Occupancy", test_occupancy),
        ("Financial Summary", test_financial_summary),
        ("Stock Levels", test_stock_levels),
        ("Procurement Analysis", test_procurement_analysis),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            has_data = test_func()
            results[test_name] = "✓ PASS" if has_data else "⚠ NO DATA"
        except Exception as e:
            results[test_name] = f"✗ ERROR: {str(e)}"
            print(f"Error: {e}")
    
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    
    for test_name, result in results.items():
        print(f"{test_name:30} {result}")
    
    print("\n" + "=" * 60)
    print("\nNOTE: 'NO DATA' means the query executed successfully but")
    print("returned no records. This is expected if the database is empty")
    print("or if there's no data for the selected date range.")
    print("\nAll tests should show 'PASS' or 'NO DATA', not 'ERROR'.")
    print("=" * 60)

if __name__ == '__main__':
    main()
