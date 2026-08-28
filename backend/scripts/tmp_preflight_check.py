#!/usr/bin/env python3
"""Read-only pre-flight check before applying the RLS-hardening and
atomic-stock-decrement migrations. Imports the connection string from the
existing run-migration.py rather than duplicating it. Does not modify
anything."""
import psycopg2
from run_migration import DATABASE_URL

conn = psycopg2.connect(DATABASE_URL, connect_timeout=15)
conn.autocommit = True
cur = conn.cursor()

print("=== connectivity ===")
cur.execute("SELECT now(), current_database();")
print(cur.fetchone())

print("\n=== current RLS state on tables this migration will touch ===")
cur.execute("""
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
    WHERE relname IN ('pos_outlet_items','pos_shift_orders','pos_outlet_shifts',
                       'branch_stock','restaurant_menu_items',
                       'restaurant_menu_categories','restaurant_orders',
                       'restaurant_order_items')
    ORDER BY relname;
""")
for row in cur.fetchall():
    print(row)

print("\n=== row counts (sanity, nothing destructive) ===")
for t in ['pos_outlet_items', 'pos_shift_orders', 'pos_outlet_shifts', 'branch_stock', 'users']:
    cur.execute(f"SELECT count(*) FROM {t};")
    print(t, cur.fetchone()[0])

print("\n=== confirm current_branch_id() / the two new RPCs do not already exist (avoid clobbering something else with the same name) ===")
cur.execute("""
    SELECT proname FROM pg_proc
    WHERE proname IN ('current_branch_id','decrement_pos_outlet_item_stock',
                       'apply_pos_shift_stock_count_sale','cashier_acknowledge_item_void');
""")
print(cur.fetchall())

print("\n=== active connections (make sure we are not about to fight a long-running transaction) ===")
cur.execute("""
    SELECT count(*) FROM pg_stat_activity
    WHERE datname = current_database() AND state != 'idle';
""")
print('active non-idle connections:', cur.fetchone())

cur.close()
conn.close()
print("\nOK - preflight complete, no changes made.")
