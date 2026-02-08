
import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

def diagnose():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Missing SUPABASE_URL or SUPABASE_KEY")
        return

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    # 1. Check if table exists
    print("\n--- Phase 1: Checking financial_audit_logs table ---")
    url = f"{SUPABASE_URL}/rest/v1/financial_audit_logs?select=*"
    try:
        response = requests.get(url, headers=headers, params={"limit": 1})
        if response.status_code == 200:
            print("SUCCESS: financial_audit_logs table exists.")
            if response.data:
                print(f"Columns: {list(response.json()[0].keys())}")
            else:
                print("Table is empty.")
        else:
            print(f"FAILED: Status {response.status_code}, Response: {response.text}")
    except Exception as e:
        print(f"ERROR: {e}")

    # 2. Check staff_profiles table
    print("\n--- Phase 2: Checking staff_profiles table ---")
    url = f"{SUPABASE_URL}/rest/v1/staff_profiles?select=id,first_name,last_name"
    try:
        response = requests.get(url, headers=headers, params={"limit": 1})
        if response.status_code == 200:
            print("SUCCESS: staff_profiles table exists.")
        else:
            print(f"FAILED: Status {response.status_code}, Response: {response.text}")
    except Exception as e:
        print(f"ERROR: {e}")

    # 3. Test the exact join query
    print("\n--- Phase 3: Testing exact join query ---")
    # Query: select('*, staff:staff_profiles(id, first_name, last_name)')
    # In REST API, this is select=*,staff:staff_profiles(id,first_name,last_name)
    url = f"{SUPABASE_URL}/rest/v1/financial_audit_logs?select=*,staff:staff_profiles(id,first_name,last_name)"
    try:
        response = requests.get(url, headers=headers, params={"limit": 1})
        if response.status_code == 200:
            print("SUCCESS: Join query works.")
            print(f"Result: {response.json()}")
        else:
            print(f"FAILED: Status {response.status_code}, Response: {response.text}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    diagnose()
