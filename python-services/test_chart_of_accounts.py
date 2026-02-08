
import os
import json
import urllib.request
import urllib.error

SUPABASE_URL = "https://utsvlihpudfraxzcmtle.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY"

def test_chart_of_accounts():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    def call_supabase(path):
        url = f"{SUPABASE_URL}{path}"
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req) as response:
                return response.getcode(), json.loads(response.read().decode())
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()
        except Exception as e:
            return 0, str(e)

    print("\n--- Testing accounting_chart_of_accounts table ---")
    status, result = call_supabase("/rest/v1/accounting_chart_of_accounts?select=*&limit=1")
    if status == 200:
        print("SUCCESS: accounting_chart_of_accounts table exists.")
        if result:
            print(f"Columns: {list(result[0].keys())}")
    else:
        print(f"FAILED: Status {status}, Response: {result}")

    print("\n--- Testing accounting_account_categories table ---")
    status, result = call_supabase("/rest/v1/accounting_account_categories?select=*&limit=1")
    if status == 200:
        print("SUCCESS: accounting_account_categories table exists.")
        if result:
            print(f"Columns: {list(result[0].keys())}")
    else:
        print(f"FAILED: Status {status}, Response: {result}")

    print("\n--- Testing join query ---")
    status, result = call_supabase("/rest/v1/accounting_chart_of_accounts?select=*,category:accounting_account_categories(*)&limit=1")
    if status == 200:
        print("SUCCESS: Join query works.")
        print(f"Result: {result}")
    else:
        print(f"FAILED: Status {status}, Response: {result}")

if __name__ == "__main__":
    test_chart_of_accounts()
