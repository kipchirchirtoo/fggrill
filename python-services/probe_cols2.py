import os
from dotenv import load_dotenv
from supabase import create_client
load_dotenv()
s = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))

def probe(table, col):
    try:
        s.table(table).select(col).limit(1).execute()
        print(f"  OK: {table}.{col}")
    except Exception as e:
        print(f"  MISSING: {table}.{col}")

print("restaurant_orders:")
for c in ['staff_id', 'created_by', 'waiter_id', 'user_id', 'cashier_id']:
    probe('restaurant_orders', c)

print("bar_orders:")
for c in ['staff_id', 'created_by', 'waiter_id', 'user_id', 'cashier_id']:
    probe('bar_orders', c)

print("pos_transactions:")
for c in ['created_by', 'cashier_id', 'user_id', 'staff_id']:
    probe('pos_transactions', c)

print("reservations:")
for c in ['created_by', 'staff_id', 'user_id']:
    probe('reservations', c)
