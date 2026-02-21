#!/usr/bin/env python3
"""
Test script to verify report data fetching is working correctly
Run this from the python-services directory
"""

import sys
import os

# Add python-services to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reports.database_fetcher import DatabaseFetcher
from datetime import datetime, timedelta

def test_report(db, report_type, filters, description):
    """Test a single report type"""
    print(f"\n{'='*60}")
    print(f"Testing: {description}")
    print(f"Report Type: {report_type}")
    print(f"Filters: {filters}")
    print(f"{'='*60}")
    
    try:
        data = db.fetch_report_data(report_type, filters)
        
        if data is None:
            print("❌ FAIL: Data is None!")
            return False
        
        if not isinstance(data, dict):
            print(f"❌ FAIL: Data is not a dict, it's {type(data)}")
            return False
        
        print(f"✅ Data structure returned: {type(data)}")
        print(f"   Keys: {list(data.keys())}")
        
        # Check for error
        if data.get('error'):
            print(f"⚠️  Warning: Data contains error: {data.get('error')}")
        
        # Check for has_data flag
        has_data = data.get('has_data', True)
        print(f"   Has Data: {has_data}")
        
        # Check for common data fields
        for key in ['items', 'voided_orders', 'bills', 'analysis', 'reconciliation_items']:
            if key in data:
                value = data[key]
                if isinstance(value, list):
                    print(f"   {key}: {len(value)} items")
                    if len(value) > 0 and isinstance(value[0], dict):
                        print(f"      First item keys: {list(value[0].keys())[:5]}...")
        
        # Check for numeric fields
        for key in ['total_value', 'total_revenue', 'total_items', 'total_exception_value']:
            if key in data:
                print(f"   {key}: {data[key]}")
        
        print("✅ PASS: Report data structure is valid")
        return True
        
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("="*60)
    print("REPORT DATA FETCHING TEST")
    print("="*60)
    
    # Initialize database fetcher
    print("\nInitializing Database Fetcher...")
    db = DatabaseFetcher()
    
    if db.client is None:
        print("❌ CRITICAL: Database client is None! Check your .env file")
        print("   Required: SUPABASE_URL and SUPABASE_SERVICE_KEY")
        return
    
    print("✅ Database connected")
    
    # Define test cases
    today = datetime.now().strftime('%Y-%m-%d')
    last_month = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    
    test_cases = [
        {
            'report_type': 'inventory_status',
            'filters': {'branch_id': 1},
            'description': 'Inventory Status - Central Store'
        },
        {
            'report_type': 'inventory_status',
            'filters': {'branch_id': 2},
            'description': 'Inventory Status - Branch 2'
        },
        {
            'report_type': 'exception_logs',
            'filters': {
                'branch_id': 2,
                'start_date': last_month,
                'end_date': today
            },
            'description': 'Exception Logs - Last 30 Days'
        },
        {
            'report_type': 'reconciliation_audit',
            'filters': {
                'branch_id': 2,
                'start_date': last_month,
                'end_date': today
            },
            'description': 'Reconciliation Audit - Last 30 Days'
        },
        {
            'report_type': 'branch_performance',
            'filters': {
                'branch_id': 2,
                'start_date': last_month,
                'end_date': today
            },
            'description': 'Branch Performance - Last 30 Days'
        },
        {
            'report_type': 'stock_usage',
            'filters': {
                'branch_id': 2,
                'start_date': last_month,
                'end_date': today
            },
            'description': 'Stock Usage - Last 30 Days'
        },
        {
            'report_type': 'employee_credit',
            'filters': {},
            'description': 'Employee Credit - All Branches'
        },
        {
            'report_type': 'sales_performance',
            'filters': {
                'branch_ids': [2],
                'start_date': last_month,
                'end_date': today
            },
            'description': 'Sales Performance - Branch 2'
        }
    ]
    
    # Run tests
    results = []
    for test_case in test_cases:
        result = test_report(
            db,
            test_case['report_type'],
            test_case['filters'],
            test_case['description']
        )
        results.append((test_case['description'], result))
    
    # Summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for description, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {description}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Report data fetching is working correctly.")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Check the output above for details.")

if __name__ == '__main__':
    main()
