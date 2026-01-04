import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:5001/api/accounting"

def test_accounting_api():
    print("Testing Accounting API with Database Persistence...")
    
    # 1. Create a journal entry
    entry_data = {
        'date': datetime.now().strftime('%Y-%m-%d'),
        'reference': f'TEST-{datetime.now().strftime("%H%M%S")}',
        'description': 'Test transaction for verification',
        'debit_account': '1000 - Cash',
        'credit_account': '4000 - Expenses',
        'amount': 500.0,
        'department': 'Test Dept',
        'category': 'expense'
    }
    
    print(f"\nCreating entry: {entry_data['reference']}...")
    res = requests.post(f"{BASE_URL}/journal-entries", json=entry_data)
    print(f"Status Code: {res.status_code}")
    print(f"Response: {res.json()}")
    
    if res.status_code != 200:
        print("Failed to create entry")
        return
    
    entry_id = res.json()['data']['id']
    
    # 2. Fetch all entries and verify the new one exists
    print("\nFetching entries...")
    res = requests.get(f"{BASE_URL}/journal-entries")
    print(f"Status Code: {res.status_code}")
    entries = res.json().get('data', [])
    
    found = False
    for entry in entries:
        if entry['id'] == entry_id:
            found = True
            print(f"Found created entry: {entry['reference']}")
            break
    
    if found:
        print("SUCCESS: Entry created and fetched from database!")
    else:
        print("FAILURE: Created entry not found in list")

if __name__ == "__main__":
    test_accounting_api()
