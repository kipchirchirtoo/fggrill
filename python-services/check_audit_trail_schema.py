
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

def check_audit_trail():
    try:
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("Missing SUPABASE_URL or SUPABASE_KEY")
            return

        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        table_name = 'financial_audit_logs'
        
        print(f"\n--- Checking table: {table_name} ---")
        try:
            # Try a simple select to see if it works
            res = supabase.table(table_name).select('*').limit(1).execute()
            print(f"Table '{table_name}' exists and is accessible.")
            if res.data:
                print("Columns found in data:")
                for key in res.data[0].keys():
                    print(f"- {key}")
            else:
                print("Table is empty, cannot determine columns from data.")
                
        except Exception as query_error:
            print(f"Error querying table: {query_error}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_audit_trail()
