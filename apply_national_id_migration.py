import os
import psycopg2

def apply_migration():
    # Use environment variable directly or hardcoded for this specific run
    db_url = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
    if not db_url:
        print("DATABASE_URL not found.")
        return

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        migration_path = r"c:\Users\user\Desktop\fggrill\backend\supabase\migrations\20260128_add_national_id_to_staff.sql"
        
        with open(migration_path, 'r') as f:
            sql = f.read()
            
        print(f"Applying migration from {migration_path}...")
        cur.execute(sql)
        conn.commit()
        print("Migration applied successfully!")
        
        # Verify the change
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'staff_profiles' AND column_name = 'national_id';")
        result = cur.fetchone()
        if result:
            print(f"Verification: Column '{result[0]}' exists in 'staff_profiles'.")
        else:
            print("Verification failed: Column 'national_id' not found.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error applying migration: {e}")

if __name__ == "__main__":
    apply_migration()
