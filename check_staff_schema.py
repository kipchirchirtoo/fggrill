import psycopg2
import os

# Corrected URL from user prompt
DATABASE_URL = "postgresql://postgres.utsvzlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"

def check_schema(table_name):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table_name}'")
        columns = cur.fetchall()
        
        print(f"Columns in {table_name}:")
        for col in columns:
            print(f"- {col[0]} ({col[1]})")
            
        conn.close()
        
    except Exception as e:
        print(f"Error checking {table_name}: {e}")

if __name__ == "__main__":
    check_schema('users')
    print("\n" + "="*20 + "\n")
    check_schema('staff_profiles')
