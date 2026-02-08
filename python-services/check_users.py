
import os
import json
import urllib.request
import urllib.error

SUPABASE_URL = "https://utsvlihpudfraxzcmtle.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY"

def check_users():
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

    print("\n--- users columns ---")
    status, result = call_supabase("/rest/v1/users?select=*&limit=1")
    if status == 200 and result:
        print(f"Columns: {list(result[0].keys())}")
    else:
        print(f"FAILED or EMPTY: Status {status}, Result: {result}")

if __name__ == "__main__":
    check_users()
