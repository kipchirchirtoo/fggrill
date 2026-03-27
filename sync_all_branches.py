import psycopg2

DB_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def sync_all_branches():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()
    
    try:
        # Get all branch IDs
        cur.execute("SELECT id, name FROM public.branches")
        branches = cur.fetchall()
        branch_ids = [b[0] for b in branches]
        
        # Get all SKUs from simple_items
        cur.execute("SELECT sku FROM public.simple_items")
        skus = [s[0] for s in cur.fetchall()]
        
        total_items = len(skus)
        total_branches = len(branch_ids)
        expected_total = total_items * total_branches
        
        print(f"Syncing {total_items} items across {total_branches} branches...")
        print(f"Target total records in branch_stock: {expected_total}")
        
        count = 0
        for b_id in branch_ids:
            for sku in skus:
                cur.execute("""
                    INSERT INTO public.branch_stock (branch_id, item_sku, quantity)
                    VALUES (%s, %s, 0)
                    ON CONFLICT (branch_id, item_sku) DO NOTHING
                """, (b_id, sku))
                count += 1
            print(f"Completed branch ID {b_id}...")
            
        # Final count verification
        cur.execute("SELECT count(*) FROM public.branch_stock")
        final_count = cur.fetchone()[0]
        
        print(f"\nSync complete.")
        print(f"Final records in branch_stock: {final_count}")
        
    except Exception as e:
        print(f"Sync failed: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    sync_all_branches()
