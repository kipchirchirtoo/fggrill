
import os
import sys
from dotenv import load_dotenv
from supabase import create_client
import json

load_dotenv()

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_KEY')
client = create_client(url, key)

def check_payments():
    print("Checking last 20 payments...")
    res = client.table('payments').select('*').order('created_at', desc=True).limit(20).execute()
    
    if not res.data:
        print("No payments found.")
        return

    print(f"{'CREATED_AT':<25} {'STATUS':<15} {'AMOUNT':<10} {'METHOD':<15}")
    print("-" * 65)
    for r in res.data:
        print(f"{str(r.get('created_at')):<25} {str(r.get('status')):<15} {str(r.get('amount')):<10} {str(r.get('payment_method')):<15}")

if __name__ == '__main__':
    check_payments()
