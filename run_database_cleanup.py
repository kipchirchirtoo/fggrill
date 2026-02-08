"""
Database Cleanup Script for Client Handover
Removes all data except superadmin login credentials
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
load_dotenv('backend/.env')

# Get Supabase credentials
SUPABASE_URL = os.getenv('SUPABASE_PROJECT_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERROR: Missing Supabase credentials!")
    print("Please set SUPABASE_PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def execute_sql(sql: str, description: str = ""):
    """Execute SQL and handle errors"""
    try:
        if description:
            print(f"⏳ {description}...")
        result = supabase.rpc('exec_sql', {'query': sql}).execute()
        if description:
            print(f"✅ {description} - Done")
        return result
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def verify_superadmin():
    """Verify superadmin exists before cleanup"""
    print("\n🔍 Verifying superadmin user exists...")
    try:
        result = supabase.table('users').select('id, email, first_name, last_name, role').eq('role', 'super_admin').execute()
        
        if not result.data or len(result.data) == 0:
            print("❌ ERROR: No superadmin user found!")
            print("Cannot proceed with cleanup - you would be locked out!")
            return False
        
        print(f"✅ Found {len(result.data)} superadmin user(s):")
        for user in result.data:
            print(f"   - {user['email']} ({user['first_name']} {user['last_name']})")
        return True
    except Exception as e:
        print(f"❌ Error checking for superadmin: {e}")
        return False

def cleanup_database():
    """Execute the database cleanup"""
    
    print("\n" + "="*60)
    print("DATABASE CLEANUP FOR CLIENT HANDOVER")
    print("="*60)
    print("\n⚠️  WARNING: This will DELETE ALL DATA except superadmin!")
    print("⚠️  This action is IRREVERSIBLE!")
    print("\n")
    
    # Verify superadmin exists
    if not verify_superadmin():
        return False
    
    # Final confirmation
    print("\n" + "="*60)
    response = input("Type 'DELETE ALL DATA' to confirm: ")
    if response != "DELETE ALL DATA":
        print("\n❌ Cleanup cancelled.")
        return False
    
    print("\n🚀 Starting database cleanup...\n")
    
    # Delete transactional data
    tables_to_clean = [
        # Financial & Accounting
        ('finance_daily_log_lines', 'Finance daily log lines'),
        ('finance_daily_logs', 'Finance daily logs'),
        ('accounting_journal_entries', 'Accounting journal entries'),
        ('mpesa_transaction_logs', 'M-Pesa transaction logs'),
        ('payment_receipts', 'Payment receipts'),
        ('bills', 'Bills'),
        ('invoices', 'Invoices'),
        
        # Staff Financial
        ('staff_credit_bills', 'Staff credit bills'),
        ('staff_loan_payments', 'Staff loan payments'),
        ('staff_loans', 'Staff loans'),
        ('staff_advances', 'Staff advances'),
        ('staff_payroll', 'Staff payroll'),
        
        # Kitchen
        ('kitchen_variance_reasons', 'Kitchen variance reasons'),
        ('kitchen_portion_ledger', 'Kitchen portion ledger'),
        ('kitchen_portion_stock', 'Kitchen portion stock'),
        ('kitchen_food_controls', 'Kitchen food controls'),
        ('kitchen_daily_variance', 'Kitchen daily variance'),
        ('kitchen_wastage', 'Kitchen wastage'),
        ('kitchen_usage', 'Kitchen usage'),
        ('recipe_items', 'Recipe items'),
        ('recipes', 'Recipes'),
        ('kitchen_grn_items', 'Kitchen GRN items'),
        ('kitchen_grn', 'Kitchen GRNs'),
        ('kitchen_requisition_items', 'Kitchen requisition items'),
        ('kitchen_requisitions', 'Kitchen requisitions'),
        ('kitchen_stock_ledger', 'Kitchen stock ledger'),
        ('kitchen_stock', 'Kitchen stock'),
        
        # POS & Orders
        ('order_items', 'Order items'),
        ('orders', 'Orders'),
        ('pos_sessions', 'POS sessions'),
        ('pool_table_tokens', 'Pool table tokens'),
        
        # Restaurant
        ('restaurant_bills', 'Restaurant bills'),
        ('bar_stock_movements', 'Bar stock movements'),
        ('restaurant_inventory', 'Restaurant inventory'),
        
        # Reservations
        ('room_bookings', 'Room bookings'),
        ('reservations', 'Reservations'),
        ('guest_profiles', 'Guest profiles'),
        
        # Housekeeping
        ('housekeeping_tasks', 'Housekeeping tasks'),
        ('room_maintenance', 'Room maintenance'),
        ('laundry_records', 'Laundry records'),
        
        # Inventory
        ('stock_history', 'Stock history'),
        ('dispatch_items', 'Dispatch items'),
        ('dispatch_notes', 'Dispatch notes'),
        ('dispatch_returns', 'Dispatch returns'),
        ('dispatch_tracking', 'Dispatch tracking'),
        ('stock_request_items', 'Stock request items'),
        ('stock_requests', 'Stock requests'),
        ('stock_levels', 'Stock levels'),
        ('stock_take_items', 'Stock take items'),
        ('stock_takes', 'Stock takes'),
        ('stock_out_records', 'Stock out records'),
        ('simple_transfer_items', 'Simple transfer items'),
        ('simple_shop_items', 'Simple shop items'),
        ('branch_stock_movements', 'Branch stock movements'),
        ('inventory_items', 'Inventory items'),
        ('simple_items', 'Simple items'),
        
        # Procurement
        ('purchase_order_items', 'Purchase order items'),
        ('purchase_orders', 'Purchase orders'),
        ('grn_items', 'GRN items'),
        ('goods_received_notes', 'Goods received notes'),
        ('supplier_invoices', 'Supplier invoices'),
        ('supplier_payments', 'Supplier payments'),
        ('suppliers', 'Suppliers'),
        
        # Maintenance
        ('maintenance_requests', 'Maintenance requests'),
        ('maintenance_schedules', 'Maintenance schedules'),
        ('vehicle_maintenance', 'Vehicle maintenance'),
        
        # Vehicles & Drivers
        ('drivers', 'Drivers'),
        ('vehicles', 'Vehicles'),
        
        # Staff
        ('staff_attendance', 'Staff attendance'),
        ('staff_leave', 'Staff leave'),
    ]
    
    for table, description in tables_to_clean:
        try:
            result = supabase.table(table).delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
            print(f"✅ Cleaned: {description}")
        except Exception as e:
            # Table might not exist, continue
            print(f"⚠️  Skipped: {description} (table may not exist)")
    
    # Delete staff profiles (except superadmin)
    print("\n⏳ Removing staff profiles (except superadmin)...")
    try:
        superadmin_ids = supabase.table('users').select('id').eq('role', 'super_admin').execute()
        superadmin_id_list = [u['id'] for u in superadmin_ids.data]
        
        supabase.table('staff_profiles').delete().not_.in_('user_id', superadmin_id_list).execute()
        print("✅ Staff profiles cleaned")
    except Exception as e:
        print(f"⚠️  Could not clean staff profiles: {e}")
    
    # Delete users (except superadmin)
    print("\n⏳ Removing users (except superadmin)...")
    try:
        supabase.table('users').delete().neq('role', 'super_admin').execute()
        print("✅ Users cleaned (superadmin preserved)")
    except Exception as e:
        print(f"❌ Error cleaning users: {e}")
        return False
    
    # Reset sequences
    print("\n⏳ Resetting sequences...")
    try:
        supabase.table('sku_categories').update({'current_serial': 0}).neq('code', 'NONE').execute()
        supabase.table('order_sequences').delete().neq('sequence_type', 'NONE').execute()
        supabase.table('simple_sequences').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        print("✅ Sequences reset")
    except Exception as e:
        print(f"⚠️  Could not reset sequences: {e}")
    
    # Verification
    print("\n" + "="*60)
    print("VERIFICATION")
    print("="*60)
    
    try:
        users = supabase.table('users').select('email, role').execute()
        print(f"\n✅ Remaining users: {len(users.data)}")
        for user in users.data:
            print(f"   - {user['email']} ({user['role']})")
        
        # Check some major tables
        tables_to_check = ['orders', 'bills', 'reservations', 'inventory_items', 'suppliers']
        print("\n📊 Data counts:")
        for table in tables_to_check:
            try:
                count = supabase.table(table).select('id', count='exact').execute()
                print(f"   - {table}: {count.count} records")
            except:
                print(f"   - {table}: N/A")
        
        print("\n" + "="*60)
        print("✅ DATABASE CLEANUP COMPLETED SUCCESSFULLY!")
        print("="*60)
        print("\n📝 Next steps:")
        print("   1. Update superadmin password")
        print("   2. Clear Supabase Storage buckets")
        print("   3. Test login with superadmin credentials")
        print("   4. Deliver to client")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error during verification: {e}")
        return False

if __name__ == "__main__":
    try:
        success = cleanup_database()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n❌ Cleanup cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
