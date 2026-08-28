#!/usr/bin/env python3
"""
Execute canonical tables consolidation migration
"""
import psycopg2
from psycopg2 import sql
import sys

DATABASE_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def run_migration():
    """Execute the canonical tables consolidation migration"""
    
    print("🔄 Executing Canonical Tables Consolidation Migration...\n")
    
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cursor = conn.cursor()
    
    try:
        # Start transaction
        cursor.execute("BEGIN;")
        print("✅ Transaction started")
        
        # 1. Add order_type column to pos_shift_orders
        print("\n📝 Adding order_type column to pos_shift_orders...")
        cursor.execute("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'pos_shift_orders' AND column_name = 'order_type'
                ) THEN
                    ALTER TABLE pos_shift_orders ADD COLUMN order_type VARCHAR(50) DEFAULT 'general';
                    RAISE NOTICE 'Added order_type column to pos_shift_orders';
                ELSE
                    RAISE NOTICE 'order_type column already exists in pos_shift_orders';
                END IF;
            END $$;
        """)
        print("✅ order_type column handled")
        
        # 2. Add deprecation comments
        deprecations = [
            ('inventory_items', 'Use simple_items instead'),
            ('store_items', 'Use simple_items instead'),
            ('cashier_shifts', 'Use cashier_transactions instead'),
            ('cashier_shift_logs', 'Use cashier_transactions instead'),
            ('pos_outlet_shifts', 'Use cashier_transactions instead'),
            ('cashier_logbooks', 'Use cashier_transactions instead'),
            ('shift_transactions', 'Use cashier_transactions instead'),
            ('stock_counts', 'Use central_stock_take_items instead'),
            ('stock_takes', 'Use central_stock_take_items instead'),
            ('staff_credit_bills', 'Use unpaid_bills instead'),
            ('restaurant_bills', 'Use unpaid_bills instead'),
            ('restaurant_orders', 'Use pos_shift_orders instead'),
            ('bar_orders', 'Use pos_shift_orders instead'),
            ('pos_transactions', 'Use pos_shift_orders instead'),
        ]
        
        print("\n📝 Adding deprecation comments...")
        for table_name, message in deprecations:
            comment = f"DEPRECATED - {message}. Data migrated on 2025-01-14."
            cursor.execute(
                sql.SQL("COMMENT ON TABLE {} IS %s;").format(
                    sql.Identifier(table_name)
                ),
                (comment,)
            )
        print(f"✅ Added deprecation comments to {len(deprecations)} tables")
        
        # Commit transaction
        cursor.execute("COMMIT;")
        print("\n✅ Transaction committed successfully")
        
        # Verify changes
        print("\n📊 Verifying changes...\n")
        
        # Check order_type column
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pos_shift_orders' AND column_name = 'order_type'
        """)
        result = cursor.fetchone()
        if result:
            print(f"✅ order_type column verified: {result[0]} ({result[1]})")
        else:
            print("⚠️  order_type column not found")
        
        # Check deprecation comments
        cursor.execute("""
            SELECT tablename, obj_description((schemaname || '.' || tablename)::regclass, 'pg_class')
            FROM pg_tables 
            WHERE schemaname = 'public'
            AND tablename IN (
                'inventory_items', 'store_items', 'cashier_shifts', 'cashier_shift_logs',
                'pos_outlet_shifts', 'cashier_logbooks', 'shift_transactions',
                'stock_counts', 'stock_takes', 'staff_credit_bills', 'restaurant_bills',
                'restaurant_orders', 'bar_orders', 'pos_transactions'
            )
            ORDER BY tablename
        """)
        
        results = cursor.fetchall()
        print(f"\n✅ Deprecation comments applied to {len(results)} tables:")
        for table_name, description in results:
            if description and 'DEPRECATED' in description:
                print(f"   ✅ {table_name}")
            else:
                print(f"   ⚠️  {table_name} - comment not set")
        
        print("\n" + "=" * 60)
        print("MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 60)
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        cursor.execute("ROLLBACK;")
        cursor.close()
        conn.close()
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
