import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
s = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

# Check what columns payments has and if branch_id exists
r = s.table('payments').select('*').limit(3).execute()
if r.data:
    print('payments columns:', list(r.data[0].keys()))
    for row in r.data:
        print(f"  branch_id={row.get('branch_id')} booking_id={row.get('booking_id')} restaurant_order_id={row.get('restaurant_order_id')} bar_order_id={row.get('bar_order_id')}")

print()

# Simulate the fetcher with no branch filter (all branches)
r2 = s.table('payments').select('*').gte('created_at','2026-01-01T00:00:00').lte('created_at','2026-03-24T23:59:59').in_('status',['completed','pending','verified','approved']).execute()
all_payments = r2.data or []
print(f'Total payments fetched: {len(all_payments)}')

branch_ids = []  # no filter = all branches
total_revenue = 0
transactions = []

for payment in all_payments:
    pid = payment.get('branch_id')
    # Apply Branch Filter
    if branch_ids and (pid not in branch_ids):
        continue
    amount = float(payment.get('amount', 0) or 0)
    total_revenue += amount
    transactions.append(payment)

print(f'After branch filter: {len(transactions)} transactions, total={total_revenue}')
print()
print('First 3 transactions:')
for t in transactions[:3]:
    print(f"  amount={t.get('amount')} method={t.get('payment_method')} branch_id={t.get('branch_id')}")
