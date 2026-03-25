import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
s = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

# Check payment_verifications
try:
    r = s.table('payment_verifications').select('*').order('recorded_at', desc=True).limit(5).execute()
    print('payment_verifications count:', len(r.data or []))
    if r.data:
        print('columns:', list(r.data[0].keys()))
        for row in r.data[:3]:
            print(f"  recorded_at={row.get('recorded_at')} amount={row.get('amount')} method={row.get('payment_method')} branch={row.get('branch_id')}")
    else:
        print('  (no data)')
except Exception as e:
    print('payment_verifications error:', e)

print()

# Check payments in date range
try:
    r2 = s.table('payments').select('*').gte('created_at','2026-01-01T00:00:00').lte('created_at','2026-03-24T23:59:59').in_('status',['completed','pending','verified','approved']).execute()
    print('payments in range (2026-01-01 to 2026-03-24):', len(r2.data or []))
    if r2.data:
        for row in r2.data[:3]:
            print(f"  created_at={row.get('created_at')} amount={row.get('amount')} status={row.get('status')}")
except Exception as e:
    print('payments error:', e)
