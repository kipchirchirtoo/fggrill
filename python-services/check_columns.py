
import os
import json
import urllib.request
import urllib.error

SUPABASE_URL = "https://utsvlihpudfraxzcmtle.supabase.co"
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

def check_columns():
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

    print("\n--- staff_profiles columns ---")
    status, result = call_supabase("/rest/v1/staff_profiles?select=*&limit=1")
    if status == 200 and result:
        print(f"Columns: {list(result[0].keys())}")
    else:
        print(f"FAILED or EMPTY: Status {status}, Result: {result}")

    print("\n--- financial_audit_logs columns ---")
    status, result = call_supabase("/rest/v1/financial_audit_logs?select=*&limit=1")
    if status == 200 and result:
        print(f"Columns: {list(result[0].keys())}")
    else:
        # If empty, try to get from another row or explain
        print(f"Status {status}, Result: {result}")
        if status == 200 and not result:
             print("Table exists but it is empty. Trying to find any reference in code for columns.")

if __name__ == "__main__":
    check_columns()
