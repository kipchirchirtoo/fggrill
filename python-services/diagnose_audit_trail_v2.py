
import os
import json
import urllib.request
import urllib.error

# Hardcoded for now since reading .env without helper is tedious
SUPABASE_URL = "https://utsvlihpudfraxzcmtle.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY"

def diagnose():
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

    # 1. Check if table exists
    print("\n--- Phase 1: Checking financial_audit_logs table ---")
    status, result = call_supabase("/rest/v1/financial_audit_logs?select=*&limit=1")
    if status == 200:
        print("SUCCESS: financial_audit_logs table exists.")
        if result:
            print(f"Columns: {list(result[0].keys())}")
        else:
            print("Table is empty.")
    else:
        print(f"FAILED: Status {status}, Response: {result}")

    # 2. Check staff_profiles table
    print("\n--- Phase 2: Checking staff_profiles table ---")
    status, result = call_supabase("/rest/v1/staff_profiles?select=id,first_name,last_name&limit=1")
    if status == 200:
        print("SUCCESS: staff_profiles table exists.")
    else:
        print(f"FAILED: Status {status}, Response: {result}")

    # 3. Test the exact join query
    print("\n--- Phase 3: Testing exact join query ---")
    # select=*,staff:staff_profiles(id,first_name,last_name)
    status, result = call_supabase("/rest/v1/financial_audit_logs?select=*,staff:staff_profiles(id,first_name,last_name)&limit=1")
    if status == 200:
        print("SUCCESS: Join query works.")
        print(f"Result sample: {result}")
    else:
        print(f"FAILED: Status {status}, Response: {result}")

if __name__ == "__main__":
    diagnose()
