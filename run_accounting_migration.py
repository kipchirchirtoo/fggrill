import psycopg2
import os

# Corrected URL from user prompt
DATABASE_URL = "postgresql://postgres.utsvzlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def run_migration(file_path):
    try:
        # Connect with SSL mode require and disable certificate verification if needed
        # In psycopg2, we can use sslmode='require'
        conn = psycopg2.connect(DATABASE_URL, sslmode='require')
        conn.autocommit = True
        cur = conn.cursor()
        
        with open(file_path, 'r') as f:
            sql = f.read()
            
        print(f"Running migration from {file_path}...")
        cur.execute(sql)
        print("Migration successful!")
        
        conn.close()
        
    except Exception as e:
        print(f"Error running migration: {e}")

if __name__ == "__main__":
    run_migration('/home/john/fggrill/python-services/migrations/003_accounting_schema.sql')
