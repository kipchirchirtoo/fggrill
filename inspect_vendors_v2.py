import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load from the .env I created for python-services
load_dotenv(r'c:\Users\Administrator\OneDrive\Desktop\fggrill\python-services\.env')

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

output_file = "vendor_check.txt"

with open(output_file, "w") as f:
    f.write(f"URL: {url}\n")
    f.write(f"Key found: {'Yes' if key else 'No'}\n\n")

    try:
        supabase: Client = create_client(url, key)
        
        # 1. Check vendors
        f.write("--- Accounting Vendors ---\n")
        try:
            res = supabase.table('accounting_vendors').select('*').execute()
            if res.data:
                for vendor in res.data:
                    f.write(f"- {vendor['name']} (ID: {vendor['id']})\n")
            else:
                f.write("No vendors found in accounting_vendors.\n")
        except Exception as e:
            f.write(f"Error checking vendors: {e}\n")

        # 2. Check table info
        f.write("\n--- Table names in public ---\n")
        try:
            res = supabase.table('information_schema.tables').select('table_name').eq('table_schema', 'public').execute()
            for t in res.data:
                f.write(f"- {t['table_name']}\n")
        except Exception as e:
            f.write(f"Error listing tables: {e}\n")

    except Exception as e:
        f.write(f"Global Error: {e}\n")

print(f"Done. Check {output_file}")
