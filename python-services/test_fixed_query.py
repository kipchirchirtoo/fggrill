
import os
import json
import urllib.request
import urllib.error

SUPABASE_URL = "https://utsvlihpudfraxzcmtle.supabase.co"
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

def test_fixed_query():
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

    print("\n--- Testing fixed query (no join) ---")
    status, result = call_supabase("/rest/v1/financial_audit_logs?select=*&order=created_at.desc&limit=100")
    if status == 200:
        print("SUCCESS: Query works without join.")
        print(f"Returned {len(result)} records")
        if result:
            print(f"Sample record: {result[0]}")
    else:
        print(f"FAILED: Status {status}, Response: {result}")

if __name__ == "__main__":
    test_fixed_query()
