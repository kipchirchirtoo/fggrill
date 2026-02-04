import psycopg2
import os

DATABASE_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

TABLES_TO_CHECK = [
    'payments', 'reservations', 'restaurant_orders', 'bar_orders', 'bookings', 
    'receipts', 'rooms', 'housekeeping_tasks', 'users', 'maintenance_requests', 
    'staff_attendance', 'payroll', 'simple_items', 'branch_stock', 'expenses', 
    'stock_history', 'branch_stock_movements', 'audit_config_consumption', 
    'inventory_items', 'stock_movements', 'suppliers', 'restaurant_order_items', 
    'restaurant_menu_items', 'stock_requests', 'stock_request_items', 
    'employee_credit_bills', 'staff_profiles', 'branches', 
    'conference_hall_bookings', 'conference_halls', 'kitchen_ledger_entries', 
    'kitchen_stock_ledger', 'kitchen_stock', 'store_supplier_invoices', 
    'store_suppliers', 'store_grni_control_account', 'store_grn', 
    'store_supplier_balances', 'stock_requisitions', 'stock_requisition_items'
]

def verify_tables():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        found_tables = []
        missing_tables = []
        
        for table in TABLES_TO_CHECK:
            cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = %s)", (table,))
            exists = cur.fetchone()[0]
            if exists:
                found_tables.append(table)
            else:
                missing_tables.append(table)
        
        print(f"Found {len(found_tables)} tables.")
        print(f"Missing {len(missing_tables)} tables: {', '.join(missing_tables)}")
        
        if found_tables:
            print("\nDetails for some key tables:")
            for table in found_tables[:10]: # Just check first 10 for brevity
                cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = %s", (table,))
                cols = cur.fetchall()
                print(f"\nTable: {table}")
                for col in cols:
                    print(f"  - {col[0]} ({col[1]})")
        
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_tables()
